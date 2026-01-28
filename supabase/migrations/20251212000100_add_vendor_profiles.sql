-- Create vendor_profiles table for public vendor information
CREATE TABLE public.vendor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  about TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vendor profiles"
  ON public.vendor_profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Vendors can insert their profile"
  ON public.vendor_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Vendors can update their profile"
  ON public.vendor_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create storage bucket for vendor logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-logos', 'vendor-logos', true);

CREATE POLICY "Vendors can upload their own logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Vendors can update their own logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Vendors can delete their own logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow public read access to vendor logos
CREATE POLICY "Public can view vendor logos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'vendor-logos');

CREATE TRIGGER update_vendor_profiles_updated_at
  BEFORE UPDATE ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
