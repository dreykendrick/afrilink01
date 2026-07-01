CREATE POLICY "Users can read their own vendor logo"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'vendor-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own product images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own affiliate avatar"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'affiliate-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);