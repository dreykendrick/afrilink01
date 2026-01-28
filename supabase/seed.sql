-- Seed approved marketplace products for the first available vendor
WITH vendor_seed AS (
  SELECT user_id
  FROM public.user_roles
  WHERE role = 'vendor'
  LIMIT 1
), product_seed AS (
  SELECT * FROM (
    VALUES
      ('Lagos Luxe Tote', 'Handcrafted leather tote with premium stitching and ample space.', 45000, 12, 'Fashion', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&q=80'),
      ('Savanna Glow Skincare Set', 'Natural shea and baobab body care trio for radiant skin.', 28500, 15, 'Beauty', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=80'),
      ('Kente Statement Runner', 'Woven table runner inspired by West African heritage patterns.', 19500, 10, 'Home', 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=1200&q=80'),
      ('AfriLink Wireless Earbuds', 'Noise-isolating earbuds with 24-hour battery life.', 52000, 14, 'Electronics', 'https://images.unsplash.com/photo-1518448706723-ef53d0f8edaf?w=1200&q=80'),
      ('Heritage Coffee Blend', 'Single-origin dark roast with cocoa and citrus notes.', 12000, 9, 'Food & Drink', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&q=80'),
      ('Urban Nomad Backpack', 'Weather-resistant backpack with laptop sleeve and hidden pocket.', 38000, 11, 'Accessories', 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=1200&q=80'),
      ('Accra Artisan Candle', 'Soy candle infused with ginger, lemongrass, and vanilla.', 8500, 8, 'Home', 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=1200&q=80'),
      ('Nomad Fitness Kit', 'Compact resistance bands and foam roller for travel workouts.', 21000, 10, 'Fitness', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80'),
      ('Coastal Linen Shirt', 'Breathable linen shirt tailored for warm climates.', 26000, 12, 'Fashion', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80'),
      ('Copper Geo Earrings', 'Handmade copper earrings with modern geometric silhouette.', 9000, 13, 'Jewelry', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200&q=80')
  ) AS seed(title, description, price, commission, category, image_url)
)
INSERT INTO public.products (
  vendor_id,
  title,
  description,
  price,
  commission,
  category,
  image_url,
  image_urls,
  status,
  sales
)
SELECT
  vendor_seed.user_id,
  product_seed.title,
  product_seed.description,
  product_seed.price,
  product_seed.commission,
  product_seed.category,
  product_seed.image_url,
  ARRAY[product_seed.image_url],
  'approved',
  0
FROM vendor_seed
CROSS JOIN product_seed
WHERE EXISTS (SELECT 1 FROM vendor_seed)
  AND NOT EXISTS (SELECT 1 FROM public.products WHERE status = 'approved');
