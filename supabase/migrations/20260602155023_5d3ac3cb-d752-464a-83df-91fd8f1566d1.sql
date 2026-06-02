
-- Roll back the overly broad policies and views from the previous step
DROP POLICY IF EXISTS "Public can read limited vendor fields" ON public.vendor_profiles;
DROP POLICY IF EXISTS "Public can read limited affiliate link fields" ON public.affiliate_links;
DROP VIEW IF EXISTS public.vendor_profiles_public;
DROP VIEW IF EXISTS public.affiliate_links_public;

-- Narrow public lookup for vendor info needed by product pages
CREATE OR REPLACE FUNCTION public.get_vendor_public_info(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  business_name text,
  city text,
  pickup_location text,
  vendor_type text,
  logo_url text,
  verification_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, business_name, city, pickup_location, vendor_type, logo_url, verification_status
  FROM public.vendor_profiles
  WHERE user_id = p_user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_public_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_public_info(uuid) TO anon, authenticated;

-- Affiliate link resolver: returns only safe fields and bumps click count
CREATE OR REPLACE FUNCTION public.resolve_affiliate_link(p_code text)
RETURNS TABLE (id uuid, product_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_product uuid;
BEGIN
  SELECT al.id, al.product_id INTO v_id, v_product
  FROM public.affiliate_links al
  WHERE al.code = p_code
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.affiliate_links
  SET clicks = COALESCE(clicks, 0) + 1
  WHERE id = v_id;

  RETURN QUERY SELECT v_id, v_product;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_affiliate_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_affiliate_link(text) TO anon, authenticated;
