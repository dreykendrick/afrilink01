
-- =========================================================
-- 1) VENDOR_PROFILES: restrict public exposure to safe columns via a view
-- =========================================================
DROP POLICY IF EXISTS "Anyone can view vendor city for delivery" ON public.vendor_profiles;

CREATE OR REPLACE VIEW public.vendor_profiles_public AS
SELECT user_id, city, pickup_location, vendor_type, business_name, logo_url, verification_status
FROM public.vendor_profiles;

GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- =========================================================
-- 2) AFFILIATE_LINKS: restrict public exposure via a view
-- =========================================================
DROP POLICY IF EXISTS "Anyone can lookup affiliate links" ON public.affiliate_links;

CREATE OR REPLACE VIEW public.affiliate_links_public AS
SELECT id, code, product_id, clicks
FROM public.affiliate_links;

GRANT SELECT ON public.affiliate_links_public TO anon, authenticated;

-- =========================================================
-- 3) USER_ROLES: prevent self-assigning admin role
-- =========================================================
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

CREATE POLICY "Users can insert own non-admin roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role <> 'admin'::app_role);

-- =========================================================
-- 4) TRANSACTIONS: remove open authenticated INSERT policy
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.transactions;
-- Admin INSERT policy and SECURITY DEFINER RPCs remain for legitimate writes.

-- =========================================================
-- 5) Revoke EXECUTE on internal wallet/ledger SECURITY DEFINER functions
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, integer, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet_for_payout(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_or_create_wallet(text, uuid, text) FROM PUBLIC, anon, authenticated;

-- =========================================================
-- 6) STORAGE: remove broad public SELECT (prevents bucket listing).
--     Buckets remain public, so files are still served via direct URL.
-- =========================================================
DROP POLICY IF EXISTS "Affiliate avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Vendor logos are publicly accessible" ON storage.objects;
