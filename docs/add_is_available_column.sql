-- Run this SQL in Cloud View > Run SQL to add the is_available column to products
-- This enables the availability toggle feature for vendors

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;

-- Update existing products to be available by default
UPDATE products SET is_available = TRUE WHERE is_available IS NULL;
