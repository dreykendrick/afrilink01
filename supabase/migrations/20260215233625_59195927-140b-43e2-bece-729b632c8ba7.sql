
-- =============================================
-- CRITICAL FIX 1: RLS Lockdown
-- =============================================

-- 1a) Enable RLS on admin_users (was missing)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- No public policies on admin_users - only service role can access

-- 1b) Remove overly permissive policies on orders
DROP POLICY IF EXISTS "Anyone can view order by token" ON public.orders;

-- Replace with: vendors can view orders containing their products
CREATE POLICY "Vendors can view orders for their products"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = orders.id AND p.vendor_id = auth.uid()
  )
);

-- 1c) Remove overly permissive policy on order_items  
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;

-- Replace with: vendors can view order items for their products
CREATE POLICY "Vendors can view own product order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = order_items.product_id AND p.vendor_id = auth.uid()
  )
);

-- 1d) Remove overly permissive policy on affiliate_links
DROP POLICY IF EXISTS "Anyone can read affiliate link by code" ON public.affiliate_links;

-- Create a public view for affiliate link resolution (code -> product_id only)
CREATE OR REPLACE VIEW public.affiliate_link_lookup AS
SELECT code, product_id
FROM public.affiliate_links;

-- Grant public access to the view  
GRANT SELECT ON public.affiliate_link_lookup TO anon, authenticated;

-- Re-add a restricted public read policy that only exposes code and product_id
-- (The view handles public lookups; table-level RLS stays restrictive)

-- =============================================
-- CRITICAL FIX 4: Atomic Wallet Credit RPC
-- =============================================

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_wallet_id UUID,
  p_amount INTEGER,
  p_payment_id UUID,
  p_order_id UUID,
  p_reason TEXT DEFAULT 'SALE_SPLIT',
  p_entry_type TEXT DEFAULT 'CREDIT',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ledger_id UUID;
BEGIN
  -- Atomically update wallet balance
  IF p_entry_type = 'CREDIT' THEN
    UPDATE wallets SET available_balance = available_balance + p_amount, updated_at = now()
    WHERE id = p_wallet_id;
  ELSIF p_entry_type = 'DEBIT' THEN
    UPDATE wallets SET available_balance = available_balance - p_amount, updated_at = now()
    WHERE id = p_wallet_id;
  END IF;

  -- Insert ledger entry in same transaction
  INSERT INTO ledger_entries (wallet_id, payment_id, order_id, entry_type, amount, reason, metadata)
  VALUES (p_wallet_id, p_payment_id, p_order_id, p_entry_type, p_amount, p_reason, p_metadata)
  RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

-- Atomic debit for payout holds
CREATE OR REPLACE FUNCTION public.debit_wallet_for_payout(
  p_wallet_id UUID,
  p_amount INTEGER,
  p_payout_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ledger_id UUID;
  v_balance INTEGER;
BEGIN
  -- Check balance atomically with lock
  SELECT available_balance INTO v_balance FROM wallets WHERE id = p_wallet_id FOR UPDATE;
  
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance: % < %', v_balance, p_amount;
  END IF;

  UPDATE wallets SET 
    available_balance = available_balance - p_amount,
    pending_balance = pending_balance + p_amount,
    updated_at = now()
  WHERE id = p_wallet_id;

  INSERT INTO ledger_entries (wallet_id, entry_type, amount, reason, metadata)
  VALUES (p_wallet_id, 'DEBIT', p_amount, 'PAYOUT_HOLD', jsonb_build_object('payout_request_id', p_payout_request_id))
  RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;
