-- ============================================
-- WALLET + LEDGER + PAYMENTS SYSTEM MIGRATION
-- ============================================

-- 1. ADD affiliate_percent column to products (vendor-defined commission rate)
-- Note: existing 'commission' column is being used, but let's ensure it's clear
-- We'll use the existing 'commission' column as the affiliate percent

-- 2. CREATE payments table for payment tracking
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'BRIQ',
  provider_payment_id TEXT UNIQUE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_gross INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TZS',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')),
  mode TEXT NOT NULL DEFAULT 'STUB' CHECK (mode IN ('STUB', 'LIVE')),
  raw_payload JSONB,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. CREATE wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('PLATFORM', 'VENDOR', 'AFFILIATE')),
  owner_id UUID, -- NULL for PLATFORM wallet
  currency TEXT NOT NULL DEFAULT 'TZS',
  available_balance INTEGER NOT NULL DEFAULT 0,
  pending_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_type, owner_id, currency)
);

-- 4. CREATE ledger_entries table
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('CREDIT', 'DEBIT')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (reason IN ('SALE_SPLIT', 'PAYOUT_HOLD', 'PAYOUT_RELEASE', 'REFUND', 'ADJUSTMENT')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for idempotency on payment splits
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_payment_wallet_reason_idx 
ON public.ledger_entries(payment_id, wallet_id, reason) 
WHERE payment_id IS NOT NULL;

-- 5. CREATE payout_requests table (extends/replaces withdrawals for new flow)
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  destination_type TEXT NOT NULL CHECK (destination_type IN ('MOBILE_MONEY', 'BANK')),
  destination_details JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'FAILED')),
  admin_note TEXT,
  processed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Create the PLATFORM wallet (singleton)
INSERT INTO public.wallets (owner_type, owner_id, currency)
VALUES ('PLATFORM', NULL, 'TZS')
ON CONFLICT (owner_type, owner_id, currency) DO NOTHING;

-- 7. Enable RLS on all new tables
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for payments
CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update payments" ON public.payments
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Public can insert payments" ON public.payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view their order payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      JOIN public.products p ON p.id = oi.product_id
      WHERE o.id = payments.order_id
      AND p.vendor_id = auth.uid()
    )
  );

-- 9. RLS Policies for wallets
CREATE POLICY "Admins can view all wallets" ON public.wallets
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all wallets" ON public.wallets
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "System can insert wallets" ON public.wallets
  FOR INSERT WITH CHECK (true);

-- 10. RLS Policies for ledger_entries
CREATE POLICY "Admins can view all ledger entries" ON public.ledger_entries
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own wallet ledger" ON public.ledger_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.wallets w
      WHERE w.id = ledger_entries.wallet_id
      AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "System can insert ledger entries" ON public.ledger_entries
  FOR INSERT WITH CHECK (true);

-- 11. RLS Policies for payout_requests
CREATE POLICY "Admins can view all payout requests" ON public.payout_requests
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update payout requests" ON public.payout_requests
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own payout requests" ON public.payout_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own payout requests" ON public.payout_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 12. Create updated_at triggers
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_payout_requests_updated_at
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 13. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_wallets_owner ON public.wallets(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_id ON public.ledger_entries(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_order_id ON public.ledger_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_wallet ON public.payout_requests(wallet_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON public.payout_requests(user_id);

-- 14. Function to get or create a user's wallet
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(
  p_owner_type TEXT,
  p_owner_id UUID,
  p_currency TEXT DEFAULT 'TZS'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to find existing wallet
  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE owner_type = p_owner_type
    AND (owner_id = p_owner_id OR (p_owner_id IS NULL AND owner_id IS NULL))
    AND currency = p_currency;
  
  -- Create if not exists
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (owner_type, owner_id, currency)
    VALUES (p_owner_type, p_owner_id, p_currency)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  RETURN v_wallet_id;
END;
$$;