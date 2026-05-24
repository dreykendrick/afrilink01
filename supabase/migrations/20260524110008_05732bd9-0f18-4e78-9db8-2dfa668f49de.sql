-- Auto-generate vendor_code for new vendor_profiles
CREATE OR REPLACE FUNCTION public.set_vendor_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.vendor_code IS NULL OR NEW.vendor_code = '' THEN
    NEW.vendor_code := 'VND-' || substr(replace(NEW.user_id::text, '-', ''), 1, 8);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_vendor_code ON public.vendor_profiles;
CREATE TRIGGER trg_set_vendor_code
BEFORE INSERT OR UPDATE ON public.vendor_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_vendor_code();

-- Backfill existing vendors
UPDATE public.vendor_profiles
SET vendor_code = 'VND-' || substr(replace(user_id::text, '-', ''), 1, 8)
WHERE vendor_code IS NULL OR vendor_code = '';