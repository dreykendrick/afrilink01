
-- 1. Products: Make "Anyone can view approved products" PERMISSIVE (needed for anon affiliate link visitors)
DROP POLICY IF EXISTS "Anyone can view approved products" ON public.products;
CREATE POLICY "Anyone can view approved products"
ON public.products
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING ((status = 'approved') AND (is_available = true));

-- 2. Vendor profiles: Add PERMISSIVE read for delivery calculation during checkout
DROP POLICY IF EXISTS "Anyone can view vendor city for delivery" ON public.vendor_profiles;
CREATE POLICY "Anyone can view vendor city for delivery"
ON public.vendor_profiles
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- 3. Order items: Change INSERT to PERMISSIVE
DROP POLICY IF EXISTS "Order items can be inserted with valid order" ON public.order_items;
CREATE POLICY "Order items can be inserted with valid order"
ON public.order_items
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (order_id IS NOT NULL)
  AND (product_id IS NOT NULL)
  AND (price >= (0)::numeric)
);

-- 4. Transactions: Allow authenticated users to insert (needed for affiliate commission during checkout)
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.transactions;
CREATE POLICY "Authenticated users can insert transactions"
ON public.transactions
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. Affiliate links: Allow anyone to look up by code (needed during checkout to resolve affiliate)
DROP POLICY IF EXISTS "Anyone can lookup affiliate links" ON public.affiliate_links;
CREATE POLICY "Anyone can lookup affiliate links"
ON public.affiliate_links
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);
