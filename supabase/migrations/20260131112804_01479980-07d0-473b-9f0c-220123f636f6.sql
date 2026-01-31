-- Fix the permissive INSERT policy to be more restrictive
DROP POLICY IF EXISTS "System can insert notification logs" ON vendor_notifications_log;

-- Only allow inserts where vendor_id matches an actual vendor
CREATE POLICY "Insert notification logs for valid vendors"
  ON vendor_notifications_log FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = vendor_id AND role = 'vendor')
  );

-- Add slug generation function
CREATE OR REPLACE FUNCTION generate_slug(p_title TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result_slug TEXT;
  counter INTEGER := 0;
  base_slug TEXT;
BEGIN
  base_slug := lower(regexp_replace(regexp_replace(p_title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  result_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM products p WHERE p.slug = result_slug) LOOP
    counter := counter + 1;
    result_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN result_slug;
END;
$$;

-- Trigger to auto-generate slug on product insert
CREATE OR REPLACE FUNCTION set_product_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_product_slug ON products;
CREATE TRIGGER trigger_set_product_slug
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_product_slug();