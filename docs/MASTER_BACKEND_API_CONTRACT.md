# AfriLink Master Backend API Contract

This document defines the API contract for connecting Admin Panel and Checkout Web App to the Main App backend.

## Environment Variables for External Apps

### Checkout Web App (.env)
```env
VITE_API_BASE_URL=https://ckklirhhwndijsjpmnfe.supabase.co/functions/v1
VITE_SUPABASE_URL=https://ckklirhhwndijsjpmnfe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2xpcmhod25kaWpzanBtbmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxOTUsImV4cCI6MjA4NTE3OTE5NX0.Z_RwkN3M8q2exVSUUULJBllHB0WXBWpODQcG1-xHaDU
```

### Admin Panel (.env)
```env
VITE_SUPABASE_URL=https://ckklirhhwndijsjpmnfe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2xpcmhod25kaWpzanBtbmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxOTUsImV4cCI6MjA4NTE3OTE5NX0.Z_RwkN3M8q2exVSUUULJBllHB0WXBWpODQcG1-xHaDU
VITE_ADMIN_ACTIONS_URL=https://ckklirhhwndijsjpmnfe.supabase.co/functions/v1/admin-actions
```

---

## Checkout API Endpoints

Base URL: `https://ckklirhhwndijsjpmnfe.supabase.co/functions/v1/checkout-api`

### 1. List Approved Products
```
GET /checkout-api/products
```

**Response:**
```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "title": "Product Name",
      "description": "...",
      "price": 50000,
      "commission": 10,
      "category": "Electronics",
      "image_url": "https://...",
      "image_urls": ["..."],
      "slug": "product-name",
      "vendor_name": "Vendor Business Name",
      "vendor_city": "Dar es Salaam"
    }
  ]
}
```

### 2. Get Product Detail
```
GET /checkout-api/products/:slug
GET /checkout-api/products/:uuid
```

**Response:**
```json
{
  "success": true,
  "product": {
    "id": "uuid",
    "title": "Product Name",
    "description": "...",
    "price": 50000,
    "commission": 10,
    "category": "Electronics",
    "image_url": "https://...",
    "image_urls": ["..."],
    "slug": "product-name",
    "vendor_name": "Vendor Business Name",
    "vendor_city": "Dar es Salaam",
    "pickup_available": true
  }
}
```

### 3. Get Delivery Fees
```
GET /checkout-api/delivery-fees
GET /checkout-api/delivery-fees?city=Dar%20es%20Salaam
```

**Response:**
```json
{
  "success": true,
  "zones": [
    { "city": "Dar es Salaam", "zone_name": "Central", "base_fee": 5000 }
  ],
  "cross_city": [
    { "from_city": "Dar es Salaam", "to_city": "Arusha", "fee": 25000 }
  ]
}
```

### 4. Create Order
```
POST /checkout-api/orders
Content-Type: application/json
```

**Request Body:**
```json
{
  "products": [
    { "product_id": "uuid", "quantity": 1 }
  ],
  "buyer_name": "John Doe",
  "buyer_email": "john@example.com",
  "buyer_phone": "+255712345678",
  "buyer_city": "Dar es Salaam",
  "buyer_address": "123 Main Street",
  "buyer_notes": "Optional notes",
  "delivery_type": "delivery",
  "affiliate_code": "ABC123",
  "checkout_session_id": "unique-session-uuid"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "order_id": "uuid",
  "total_amount": 55000,
  "delivery_fee": 5000,
  "payment_status": "pending_payment"
}
```

**Idempotency:** If `checkout_session_id` already exists, returns existing order with `already_exists: true`.

### 5. Confirm Payment
```
POST /checkout-api/confirm-payment
Content-Type: application/json
```

**Request Body:**
```json
{
  "order_id": "uuid",
  "payment_reference": "TXN123456789"
}
```

**Response:**
```json
{
  "success": true,
  "order_id": "uuid",
  "status": "processing",
  "payment_status": "payment_confirmed"
}
```

**Side Effects:**
- Sends SMS notification to vendor via Briq
- Logs notification in `vendor_notifications_log`
- Updates `vendor_notified_at` timestamp

**Idempotency:** Same `payment_reference` returns `already_confirmed: true`.

### 6. Get Receipt
```
GET /checkout-api/receipt/:orderId
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "customer_name": "John Doe",
    "customer_email": "john@example.com",
    "customer_phone": "+255712345678",
    "delivery_city": "Dar es Salaam",
    "delivery_address": "123 Main Street",
    "delivery_type": "delivery",
    "delivery_fee": 5000,
    "total_amount": 55000,
    "status": "processing",
    "payment_status": "payment_confirmed",
    "created_at": "2026-01-31T...",
    "order_items": [
      {
        "quantity": 1,
        "price": 50000,
        "products": { "title": "Product Name", "image_url": "..." }
      }
    ]
  }
}
```

### 7. Confirm Delivery
```
POST /checkout-api/confirm-delivery
Content-Type: application/json
```

**Request Body:**
```json
{
  "order_id": "uuid",
  "token": "confirmation-token-from-email"
}
```

**Response:**
```json
{
  "success": true,
  "status": "confirmed"
}
```

**Idempotency:** Already confirmed orders return `already_confirmed: true`.

---

## Admin Actions API

Base URL: `https://ckklirhhwndijsjpmnfe.supabase.co/functions/v1/admin-actions`

**Authentication:** Requires Bearer token from authenticated admin user.

```
POST /admin-actions
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Available Actions

#### Get Dashboard Stats
```json
{
  "action": "get_dashboard_stats",
  "targetTable": "stats"
}
```

#### Approve/Reject Product
```json
{
  "action": "approve_product",
  "targetTable": "products",
  "targetId": "product-uuid"
}
```

```json
{
  "action": "reject_product",
  "targetTable": "products",
  "targetId": "product-uuid"
}
```

#### Approve/Reject Application
```json
{
  "action": "approve_application",
  "targetTable": "applications",
  "targetId": "application-uuid"
}
```

#### Process Withdrawal
```json
{
  "action": "process_withdrawal",
  "targetTable": "withdrawals",
  "targetId": "withdrawal-uuid",
  "data": { "status": "approved" }
}
```

#### Verify User
```json
{
  "action": "verify_user",
  "targetTable": "profiles",
  "targetId": "user-uuid"
}
```

#### Update Order Status
```json
{
  "action": "update_order_status",
  "targetTable": "orders",
  "targetId": "order-uuid",
  "data": { "status": "vendor_notified" }
}
```

---

## Direct Database Access (Supabase Client)

Admin panel can use Supabase client directly for read operations:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// With user session (admin must be logged in)
const { data: products } = await supabase
  .from('products')
  .select('*')
  .order('created_at', { ascending: false });
```

### Tables Available to Admin

| Table | Read | Write |
|-------|------|-------|
| profiles | ✅ via RLS | ✅ via admin-actions |
| products | ✅ via RLS | ✅ via admin-actions |
| orders | ✅ via RLS | ✅ via admin-actions |
| order_items | ✅ via RLS | ❌ |
| applications | ✅ via RLS | ✅ via admin-actions |
| withdrawals | ✅ via RLS | ✅ via admin-actions |
| transactions | ✅ via RLS | ✅ via admin-actions |
| vendor_profiles | ✅ via RLS | ✅ via admin-actions |
| affiliate_profiles | ✅ via RLS | ✅ via admin-actions |
| affiliate_links | ✅ via RLS | ❌ |
| notifications | ✅ via RLS | ✅ via admin-actions |
| user_roles | ✅ via RLS | ✅ via admin-actions |
| admin_actions | ✅ via RLS | Automatic (audit log) |
| delivery_zones | ✅ via RLS | ✅ via RLS |
| cross_city_fees | ✅ via RLS | ✅ via RLS |
| vendor_notifications_log | ✅ via RLS | ❌ |

---

## Order Status Flow

```
pending → processing → vendor_notified → out_for_delivery → delivered_pending_confirmation → confirmed
                                                         ↘ disputed
                     ↘ cancelled
```

## Payment Status Flow

```
pending_payment → payment_confirmed
               ↘ payment_failed
```

---

## Smoke Test Checklist

### 1. Product Visibility
- [ ] Create product in Main App as vendor
- [ ] Admin approves product via admin-actions
- [ ] Product appears in `GET /checkout-api/products`

### 2. Order Creation
- [ ] Call `POST /checkout-api/orders` with valid data
- [ ] Order appears in Main App vendor dashboard
- [ ] Order has `payment_status: pending_payment`

### 3. Payment Confirmation
- [ ] Call `POST /checkout-api/confirm-payment`
- [ ] Vendor receives SMS (check `vendor_notifications_log`)
- [ ] Order status updates to `vendor_notified`
- [ ] Admin sees order with `payment_status: payment_confirmed`

### 4. Delivery Confirmation
- [ ] Call `POST /checkout-api/confirm-delivery` with correct token
- [ ] Order status updates to `confirmed`
- [ ] Calling again returns `already_confirmed: true`

---

## Schema Changes Summary

### New Columns Added to `orders`
- `payment_status` (TEXT, default 'pending_payment')
- `vendor_notified_at` (TIMESTAMPTZ, nullable)
- `buyer_notes` (TEXT, nullable)
- `payment_reference` (TEXT, nullable)
- `checkout_session_id` (TEXT, unique)

### New Columns Added to `products`
- `slug` (TEXT, unique) - auto-generated from title

### New Tables Created
- `delivery_zones` (city, zone_name, base_fee, is_active)
- `cross_city_fees` (from_city, to_city, fee, is_active)
- `vendor_notifications_log` (order_id, vendor_id, notification_type, recipient_phone, message_content, provider, provider_response, status, sent_at)

### New Indexes
- `idx_orders_checkout_session_id` (idempotency)
- `idx_orders_payment_reference`
- `idx_orders_payment_status`
- `idx_products_slug_unique`
- `idx_vendor_notifications_order_type` (prevent duplicate notifications)

---

## Rollback SQL

```sql
-- To rollback schema changes (run in Supabase SQL Editor if needed)

-- Remove new order columns
ALTER TABLE orders DROP COLUMN IF EXISTS payment_status;
ALTER TABLE orders DROP COLUMN IF EXISTS vendor_notified_at;
ALTER TABLE orders DROP COLUMN IF EXISTS buyer_notes;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_reference;
ALTER TABLE orders DROP COLUMN IF EXISTS checkout_session_id;

-- Remove product slug
ALTER TABLE products DROP COLUMN IF EXISTS slug;
DROP TRIGGER IF EXISTS trigger_set_product_slug ON products;
DROP FUNCTION IF EXISTS set_product_slug();
DROP FUNCTION IF EXISTS generate_slug(TEXT);

-- Remove new tables
DROP TABLE IF EXISTS vendor_notifications_log;
DROP TABLE IF EXISTS cross_city_fees;
DROP TABLE IF EXISTS delivery_zones;
```
