-- Add verification fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN phone_verified boolean DEFAULT false,
ADD COLUMN email_verified boolean DEFAULT false,
ADD COLUMN photo_verified boolean DEFAULT false,
ADD COLUMN verification_photo_url text,
ADD COLUMN verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'));

-- Create storage bucket for verification photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-photos', 'verification-photos', false);

-- RLS policies for verification photos bucket
CREATE POLICY "Users can upload their own verification photo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own verification photo"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own verification photo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'verification-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own verification photo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);