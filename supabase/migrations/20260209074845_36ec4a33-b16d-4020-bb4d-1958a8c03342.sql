-- Fix permissive RLS policies - restrict INSERT operations to service role context
-- These tables are meant to be written by edge functions using service role key

-- Drop the overly permissive insert policies
DROP POLICY IF EXISTS "Public can insert payments" ON public.payments;
DROP POLICY IF EXISTS "System can insert wallets" ON public.wallets;
DROP POLICY IF EXISTS "System can insert ledger entries" ON public.ledger_entries;

-- Payments: Only edge functions (via service role) or admins should create payments
-- Since edge functions bypass RLS with service role, we just need a restrictive policy
CREATE POLICY "Only admins can insert payments via client" ON public.payments
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- Wallets: Only edge functions (via service role) or admins should create wallets
CREATE POLICY "Only admins can insert wallets via client" ON public.wallets
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- Ledger entries: Only edge functions (via service role) or admins should create entries
CREATE POLICY "Only admins can insert ledger entries via client" ON public.ledger_entries
  FOR INSERT WITH CHECK (is_admin(auth.uid()));