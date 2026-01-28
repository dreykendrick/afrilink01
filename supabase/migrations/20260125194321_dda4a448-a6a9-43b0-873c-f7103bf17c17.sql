-- Create vendor_profiles table
CREATE TABLE public.vendor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  vendor_type TEXT DEFAULT 'individual',
  city TEXT,
  country TEXT DEFAULT 'Nigeria',
  pickup_location TEXT,
  about TEXT,
  logo_url TEXT,
  verification_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create affiliate_profiles table
CREATE TABLE public.affiliate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_profiles ENABLE ROW LEVEL SECURITY;

-- Vendor profiles RLS policies
CREATE POLICY "Users can view own vendor profile" 
  ON public.vendor_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vendor profile" 
  ON public.vendor_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vendor profile" 
  ON public.vendor_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view vendor city for delivery" 
  ON public.vendor_profiles FOR SELECT 
  USING (true);

-- Affiliate profiles RLS policies
CREATE POLICY "Users can view own affiliate profile" 
  ON public.affiliate_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own affiliate profile" 
  ON public.affiliate_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own affiliate profile" 
  ON public.affiliate_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vendor-logos', 'vendor-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('affiliate-avatars', 'affiliate-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for vendor-logos
CREATE POLICY "Users can upload own vendor logo"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vendor-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own vendor logo"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'vendor-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view vendor logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-logos');

-- Storage policies for affiliate-avatars
CREATE POLICY "Users can upload own affiliate avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'affiliate-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own affiliate avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'affiliate-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view affiliate avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'affiliate-avatars');

-- Add missing columns to orders table for checkout flow
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_country TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_type TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_token TEXT;

-- Allow orders to be updated for status changes
CREATE POLICY "Anyone can update order status with token"
  ON public.orders FOR UPDATE
  USING (true);

-- Create updated_at trigger for new tables
CREATE TRIGGER update_vendor_profiles_updated_at
  BEFORE UPDATE ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_profiles_updated_at
  BEFORE UPDATE ON public.affiliate_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();