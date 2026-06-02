
ALTER VIEW public.vendor_profiles_public SET (security_invoker = true);
ALTER VIEW public.affiliate_links_public SET (security_invoker = true);

-- These views need read access to the underlying tables for anon/authenticated:
-- Add permissive SELECT policies that expose only what the views select.
-- (Views with security_invoker run against caller's RLS.)
CREATE POLICY "Public can read limited vendor fields"
ON public.vendor_profiles
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public can read limited affiliate link fields"
ON public.affiliate_links
FOR SELECT
TO anon, authenticated
USING (true);
