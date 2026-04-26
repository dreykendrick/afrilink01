ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS vendor_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_vendor_code
  ON public.vendor_profiles (vendor_code);