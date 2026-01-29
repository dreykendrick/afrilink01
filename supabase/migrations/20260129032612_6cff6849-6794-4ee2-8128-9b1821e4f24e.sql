-- Create vendor-logos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-logos', 'vendor-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create affiliate-avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('affiliate-avatars', 'affiliate-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create product-images bucket (for product uploads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for vendor-logos
CREATE POLICY "Users can upload their own vendor logo"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'vendor-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own vendor logo"
ON storage.objects FOR UPDATE
USING (bucket_id = 'vendor-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vendor logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'vendor-logos');

-- RLS policies for affiliate-avatars
CREATE POLICY "Users can upload their own affiliate avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'affiliate-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own affiliate avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'affiliate-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Affiliate avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'affiliate-avatars');

-- RLS policies for product-images
CREATE POLICY "Users can upload their own product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Product images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');