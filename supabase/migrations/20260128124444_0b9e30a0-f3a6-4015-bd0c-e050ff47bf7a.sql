-- Fix function search_path for handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Drop overly permissive policies and replace with more restrictive ones

-- Fix orders INSERT policy: Allow anyone to insert but track the order
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
CREATE POLICY "Public can insert orders" ON public.orders 
FOR INSERT WITH CHECK (
  customer_email IS NOT NULL AND 
  customer_name IS NOT NULL AND
  total_amount >= 0
);

-- Fix order_items INSERT policy
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Order items can be inserted with valid order" ON public.order_items 
FOR INSERT WITH CHECK (
  order_id IS NOT NULL AND
  product_id IS NOT NULL AND
  price >= 0
);