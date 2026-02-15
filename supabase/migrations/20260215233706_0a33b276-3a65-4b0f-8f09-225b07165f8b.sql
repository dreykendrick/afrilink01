
-- Fix security definer view by making it use invoker security
DROP VIEW IF EXISTS public.affiliate_link_lookup;
CREATE VIEW public.affiliate_link_lookup
WITH (security_invoker = true)
AS SELECT code, product_id FROM public.affiliate_links;

GRANT SELECT ON public.affiliate_link_lookup TO anon, authenticated;

-- Add a restrictive RLS policy that allows anon to read affiliate_links
-- but ONLY the code and product_id columns via the view
-- Since the view uses security_invoker, we need a policy for anon/authenticated
CREATE POLICY "Public can read affiliate link code and product"
ON public.affiliate_links
FOR SELECT
USING (true);
-- Note: This allows SELECT but the view only exposes code + product_id.
-- The other policies (Users can view own) remain for authenticated users to see full data.
-- Actually, this would re-expose all columns. Let's use a different approach:
-- Drop this and instead use the checkout-api edge function (service role) for link resolution.

DROP POLICY IF EXISTS "Public can read affiliate link code and product" ON public.affiliate_links;
