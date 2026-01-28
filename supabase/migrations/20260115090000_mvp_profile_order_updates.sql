-- Expand vendor_profiles for onboarding and make fields optional until setup completes
ALTER TABLE public.vendor_profiles
  ALTER COLUMN business_name DROP NOT NULL,
  ALTER COLUMN country DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS vendor_type text,
  ADD COLUMN IF NOT EXISTS pickup_location text,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'));

-- Create affiliate_profiles table for public affiliate information
CREATE TABLE IF NOT EXISTS public.affiliate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.affiliate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own affiliate profile"
  ON public.affiliate_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Affiliates can insert their profile"
  ON public.affiliate_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Affiliates can update their profile"
  ON public.affiliate_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER IF NOT EXISTS update_affiliate_profiles_updated_at
  BEFORE UPDATE ON public.affiliate_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add checkout and confirmation fields to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_country TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_type TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_token TEXT;

CREATE INDEX IF NOT EXISTS orders_confirmation_token_idx
  ON public.orders (confirmation_token);
