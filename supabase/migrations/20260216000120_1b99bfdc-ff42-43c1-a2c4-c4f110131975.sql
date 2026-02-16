-- Add purchase_mode column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS purchase_mode text NOT NULL DEFAULT 'affiliate';

-- Add comment for documentation
COMMENT ON COLUMN public.orders.purchase_mode IS 'Purchase mode: affiliate (commission applies) or marketplace (no affiliate attribution)';