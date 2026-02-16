
-- Fix: Change orders INSERT policy from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;

CREATE POLICY "Public can insert orders"
ON public.orders
FOR INSERT
TO authenticated, anon
WITH CHECK (
  (customer_email IS NOT NULL)
  AND (customer_name IS NOT NULL)
  AND (total_amount >= (0)::numeric)
);
