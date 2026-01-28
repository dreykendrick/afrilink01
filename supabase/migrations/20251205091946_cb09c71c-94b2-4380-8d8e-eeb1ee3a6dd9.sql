-- Create products table for vendors
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  commission INTEGER NOT NULL DEFAULT 10,
  category TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sales INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own products
CREATE POLICY "Vendors can view their own products"
ON public.products
FOR SELECT
USING (auth.uid() = vendor_id);

-- Vendors can insert their own products
CREATE POLICY "Vendors can insert their own products"
ON public.products
FOR INSERT
WITH CHECK (auth.uid() = vendor_id);

-- Vendors can update their own products
CREATE POLICY "Vendors can update their own products"
ON public.products
FOR UPDATE
USING (auth.uid() = vendor_id);

-- Vendors can delete their own products
CREATE POLICY "Vendors can delete their own products"
ON public.products
FOR DELETE
USING (auth.uid() = vendor_id);

-- Public can view approved products (for marketplace)
CREATE POLICY "Public can view approved products"
ON public.products
FOR SELECT
USING (status = 'approved');

-- Create trigger for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();