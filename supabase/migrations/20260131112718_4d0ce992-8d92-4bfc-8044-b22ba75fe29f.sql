-- =====================================================
-- MASTER BACKEND SCHEMA EXTENSIONS (Part 1)
-- For Admin Panel + Checkout Web App Support
-- =====================================================

-- 1) Extend orders table with payment tracking + vendor notification
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending_payment',
  ADD COLUMN IF NOT EXISTS vendor_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS buyer_notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT UNIQUE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_checkout_session_id ON orders(checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference) WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- 2) Delivery zones pricing table
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  base_fee NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(city, zone_name)
);

-- Cross-city delivery fees
CREATE TABLE IF NOT EXISTS cross_city_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_city, to_city)
);

-- 3) Vendor notifications log (separate from user notifications)
CREATE TABLE IF NOT EXISTS vendor_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES profiles(id),
  notification_type TEXT NOT NULL DEFAULT 'sms',
  recipient_phone TEXT NOT NULL,
  message_content TEXT,
  provider TEXT DEFAULT 'briq',
  provider_response JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate notifications per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_notifications_order_type 
  ON vendor_notifications_log(order_id, notification_type) 
  WHERE status IN ('sent', 'delivered');

-- 4) Add slug to products for SEO-friendly URLs
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique ON products(slug) WHERE slug IS NOT NULL;

-- =====================================================
-- RLS POLICIES FOR NEW TABLES
-- =====================================================

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_city_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_notifications_log ENABLE ROW LEVEL SECURITY;

-- Delivery zones: Public read, admin write
CREATE POLICY "Anyone can read active delivery zones"
  ON delivery_zones FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage delivery zones"
  ON delivery_zones FOR ALL USING (is_admin(auth.uid()));

-- Cross-city fees: Public read, admin write
CREATE POLICY "Anyone can read active cross-city fees"
  ON cross_city_fees FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage cross-city fees"
  ON cross_city_fees FOR ALL USING (is_admin(auth.uid()));

-- Vendor notifications log
CREATE POLICY "Vendors can view own notification logs"
  ON vendor_notifications_log FOR SELECT USING (vendor_id = auth.uid());

CREATE POLICY "Admins can view all notification logs"
  ON vendor_notifications_log FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "System can insert notification logs"
  ON vendor_notifications_log FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update notification logs"
  ON vendor_notifications_log FOR UPDATE USING (is_admin(auth.uid()));