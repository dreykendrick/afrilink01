-- Bug Fix B: Add checkout_session_id column to prevent duplicate orders
-- This column stores a unique idempotency key per checkout session
-- 
-- RUN THIS IN SUPABASE SQL EDITOR BEFORE USING THE APP

ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_session_id TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_checkout_session_id ON orders(checkout_session_id) WHERE checkout_session_id IS NOT NULL;

-- ============================================
-- ROLLBACK SQL (run if you need to undo):
-- ============================================
-- DROP INDEX IF EXISTS idx_orders_checkout_session_id;
-- ALTER TABLE orders DROP COLUMN IF EXISTS checkout_session_id;
