# PART 9 — API Reference (Winger backend)

This document is the exhaustive contract reference for building a Flutter client
against the existing Supabase project + edge functions used by the Winger web app.
Base Supabase URL is `VITE_SUPABASE_URL` (project `ckklirhhwndijsjpmnfe`), anon key
is `VITE_SUPABASE_PUBLISHABLE_KEY`. All edge functions are reachable at
`${SUPABASE_URL}/functions/v1/<function-name><path>`.

Secrets referenced by name only (never print values): `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ANON_KEY`, `BRIQ_API_KEY`, `BRIQ_DEVELOPER_APP_ID`, `BRIQ_BASE_URL`,
`BRIQ_WEBHOOK_SECRET`, `ORDER_GUARDIAN_API_KEY`, `ORDER_GUARDIAN_BASE_URL`,
`LOVABLE_API_KEY`, `VITE_APP_URL`, `PLATFORM_FEE_PERCENT`, `MIN_WITHDRAWAL_TZS`,
`PAYMENT_PROVIDER_MODE`.

---

## (a) Direct PostgREST table access (client `supabase.from(...)`)

All calls use `@supabase/supabase-js` against `public` schema. RLS applies
whenever the **anon/publishable key + user JWT** client is used (the `supabase`
singleton in `src/integrations/supabase/client.ts`). Edge functions frequently
use the **service role** client (`adminClient`) which bypasses RLS — those are
documented in section (c), not here.

### `notifications`
- **Read** (`useNotifications` hook): `select('*')`, `.eq('user_id', user.id)`, `.order('created_at', {ascending:false})`, `.limit(20)`. Screen: notification bell dropdown (all dashboards).
- **Update** (`markAsRead`): `.update({read:true}).eq('id', notificationId)`.
- **Update** (`markAllAsRead`): `.update({read:true}).eq('user_id', user.id).eq('read', false)`.
- **Delete** (`deleteNotification`): `.delete().eq('id', notificationId)`.
- **Delete all** (`clearAll`): `.delete().eq('user_id', user.id)`.
- RLS: users can only see/modify rows where `user_id = auth.uid()`. Rows are inserted server-side only (edge functions using service role) — clients never insert into `notifications` directly.

### `products`
- **Update** (`EditProductModal`): vendor edits own product — `.update(updateData).eq('id', product.id)`. RLS restricts update to `vendor_id = auth.uid()` (status/approval fields should be protected by RLS/trigger so vendors cannot self-approve).
- Reads for storefront/browsing go through `checkout-api` edge function (service role), not directly from the client, to enforce `status='approved' AND is_available=true` filtering safely and to attach vendor info.

### `withdrawals` (legacy path, superseded by `payout_requests` + Order Guardian)
- **Insert** (`WithdrawModal`): `.insert({...})` — user creates a withdrawal request row directly. RLS: `user_id = auth.uid()` on insert.

### `affiliate_profiles`
- **Upsert** (`AffiliateProfileSetup`): `.upsert({user_id, display_name, ...})`. RLS: `user_id = auth.uid()`.

### `profiles`
- **Update** (`PhoneVerificationFlow`, `RegistrationFlow`): `.update({phone, phone_verified})`.eq('id', userId)`. RLS: `id = auth.uid()`.

### `vendor_profiles` / `affiliate_profiles` (onboarding)
- **Upsert** (`RegistrationFlow`): creates the role-specific profile row after signup. RLS: `user_id = auth.uid()`.

### `user_roles`
- **Read** (`useAuth.fetchUserRoles`): `select('role').eq('user_id', userId)` — list of roles for the multi-role switcher.
- **Insert** (`useAuth.addRole`): `.insert({user_id, role})` — adding a second role (e.g. vendor also becomes affiliate). RLS should allow only self-insert and rely on an `applications` approval elsewhere for gating (see admin-actions `approve_application`, which also inserts rows via service role).

### `transactions`
- **Insert** (`OrderConfirmationPage`): informational client-recorded transaction rows tied to buyer-view confirmation actions (legacy code path — most financial truth now lives in `ledger_entries`/`wallets` written server-side).

### `wallets`
- **Read** (`WalletSection`, realtime): not directly selected by table name from client in current code except for realtime subscription filters — actual balance reads go through `payments-api` (`GET /wallet`) or `order-guardian` (`GET /wallet`). Realtime channel subscribes on `wallets` filtered by `owner_id=eq.<userId>` purely to trigger a refetch.

### Views
- `affiliate_link_lookup` (view over `affiliate_links`): used server-side for resolving affiliate codes; no direct client `.from()` call found, exposed via RPC `resolve_affiliate_link`.

> General RLS pattern across this schema: every user-owned table restricts
> `select/insert/update/delete` to rows where an owner column equals
> `auth.uid()` (`user_id`, `owner_id`, `vendor_id`, `affiliate_id`, `id` for profiles).
> Admin bypass is implemented via `has_role`/`is_admin` SQL functions checked in
> RLS policies, and edge functions additionally enforce admin checks in code
> before doing privileged writes with the service-role key.

---

## (b) RPCs (`supabase.rpc(...)`)

All RPCs live in the `public` schema and are `SECURITY DEFINER` Postgres
functions. They are called both from edge functions (service role) and
occasionally could be called from the client with a JWT, but in the current
codebase only edge functions invoke them.

| RPC | Params | Returns | Purpose | Security |
|---|---|---|---|---|
| `get_or_create_wallet` | `p_owner_type: 'PLATFORM'|'VENDOR'|'AFFILIATE'`, `p_owner_id: uuid|null`, `p_currency?: string ('TZS')` | `uuid` (wallet id) | Idempotently fetch or create the wallet row for an owner. Called during payment split and payout flows. | SECURITY DEFINER; only called server-side with service role. |
| `credit_wallet` | `p_wallet_id`, `p_amount`, `p_payment_id`, `p_order_id`, `p_reason`, `p_entry_type?`, `p_metadata?` | `uuid` (ledger entry id) | Atomically increments `wallets.available_balance` and inserts a `ledger_entries` row. Used for platform/affiliate/vendor payout splits after a payment is confirmed. Enforces idempotency via unique constraints (duplicate-key errors are treated as already-applied). | SECURITY DEFINER; service role only. |
| `debit_wallet_for_payout` | `p_wallet_id`, `p_amount`, `p_payout_request_id` | `uuid` | Atomically decrements wallet balance and records the debit ledger entry when a payout/withdrawal is requested. | SECURITY DEFINER; service role only. |
| `generate_slug` | `p_title: string` | `string` | Generates a URL-safe unique product slug. | Used server-side on product creation. |
| `get_order_by_token` | `p_order_id`, `p_token` | table row of `{id, status, total_amount, created_at, affiliate_link_id}` | Public, tokenized read of order status without auth (buyer confirmation link). | SECURITY DEFINER — bypasses RLS but requires matching `confirmation_token`. |
| `get_order_items_by_token` | `p_order_id`, `p_token` | rows `{id, product_id, product_title, price, quantity, vendor_id, commission_amount}` | Same tokenized pattern for order line items (buyer confirmation page). | Same as above. |
| `get_vendor_public_info` | `p_user_id` | row `{user_id, business_name, city, logo_url, pickup_location, vendor_type, verification_status}` | Public storefront vendor card info without exposing full `vendor_profiles` row. | SECURITY DEFINER, safe fields only. |
| `has_role` | `_user_id`, `_role: app_role` | `boolean` | Role check used inside RLS policies and edge functions. | SECURITY DEFINER. |
| `is_admin` | `_user_id` | `boolean` | Admin check, used by `admin-actions` edge function and RLS policies. | SECURITY DEFINER. |
| `confirm_delivery_with_token` | `p_order_id`, `p_token` | `json` | Alternate/legacy tokenized delivery confirmation (see also `checkout-api POST /confirm-delivery` which does the same via direct table update). | SECURITY DEFINER. |
| `report_delivery_issue_with_token` | `p_order_id`, `p_token` | `json` | Buyer reports a delivery problem using the confirmation token (no auth). | SECURITY DEFINER. |
| `resolve_affiliate_link` | `p_code` | rows `{id, product_id}` | Resolves an affiliate code to its link/product for click tracking and checkout attribution. | SECURITY DEFINER, public-safe read. |

`app_role` enum: `'vendor' | 'affiliate' | 'admin'`.

---

## (c) Edge Functions

Conventions: All functions respond to `OPTIONS` with CORS `200 ok`. CORS allows
`*` origin and headers `authorization, x-client-info, apikey, content-type`
(some functions add Supabase client platform headers). All success/error bodies
are JSON. No built-in retry — clients should implement their own
timeout/retry policy (edge functions have Supabase's default ~150s execution
limit; the Flutter client should apply e.g. a 15–30s timeout with 1 retry
for idempotent GETs).

### 1. `checkout-api` (public, `verify_jwt = false`)
Base: `${SUPABASE_URL}/functions/v1/checkout-api`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/debug/product/:id` | none | Debug-only, returns raw existence/status of a product (no filters). Should not be used in production Flutter client. |
| GET | `/products` | none | List all approved & available products for the public storefront. |
| GET | `/products/:slugOrId` | none | Product detail by slug or UUID, with slug-suffix fallback and vendor info. |
| GET | `/delivery-fees?city=` | none | List active delivery zones (optionally filtered by city) and cross-city fee matrix. |
| POST | `/orders` | none | Create a new order (idempotent by `checkout_session_id`). |
| POST | `/confirm-payment` | none | Mark order payment confirmed + trigger vendor SMS/in-app notification (idempotent). |
| GET | `/receipt/:orderId` | none | Fetch a receipt view of an order with items. |
| POST | `/confirm-delivery` | none (token-protected) | Buyer confirms delivery using `confirmation_token`. |
| POST | `/track-click` or `/affiliate-clicks` | none | Increment affiliate link click counter. |

**GET /products**
- Response 200: `{ success: true, products: [{ id, title, description, price, commission, category, image_url, image_urls, slug, vendor_name, vendor_city }] }`
- Errors: 500 `{success:false, error}` on DB failure.

**GET /products/:slugOrId**
- Response 200: `{ success: true, product: { id, title, description, price, commission, category, image_url, image_urls, slug, vendor_name, vendor_city, vendor_lat, vendor_lng, vendor_address, pickup_available } }`
- 404 `{success:false, error:'Product not available', reason:'not_approved_or_unavailable'}` or `{error:'Product not found', reason:'not_found'}`.
- 500 `{success:false, error:'Internal server error'}`.
- Business logic: tries UUID match, then exact slug, then a fallback that strips a trailing `-XXXXXX` 6–8 hex-char suffix appended by the frontend slug generator.

**GET /delivery-fees**
- Response 200: `{ success:true, zones:[{city, zone_name, base_fee}], cross_city:[{from_city, to_city, fee}] }`.

**POST /orders**
- Request: `{ products:[{product_id, quantity}], buyer_name, buyer_email, buyer_phone, buyer_city, buyer_address, buyer_country?, buyer_notes?, delivery_type:'pickup'|'delivery', affiliate_code?, checkout_session_id, purchase_mode?:'affiliate'|'marketplace', buyer_user_id?, buyer_role? }`
- 400 `{success:false, error:'Missing required fields...'}` if products/buyer_name/buyer_email/buyer_phone/checkout_session_id missing.
- Idempotency: if an order already exists for `checkout_session_id`, returns 200 `{success:true, order_id, status, payment_status, total_amount, already_exists:true}`.
- 400 `{success:false, error:'One or more products are not available'}` if any product isn't `approved`+`is_available`.
- Business logic: computes subtotal from live product prices/commission, computes delivery fee via `delivery_zones` (same city) or `cross_city_fees` (different city, checked both directions, default 5000 TZS fallback), creates `orders` + `order_items` rows, generates `confirmation_token` (UUID) for buyer delivery confirmation, resolves `affiliate_code` → `affiliate_link_id`.
- 201 Response: `{ success:true, order_id, total_amount, delivery_fee, payment_status:'pending_payment', vendor_locations:[{vendor_id, city, vendor_lat, vendor_lng, vendor_address}] }`.
- 500 `{success:false, error:message}` on unexpected errors.

**POST /confirm-payment**
- Request: `{ order_id, payment_reference }`
- 400 if missing fields. 404 `{success:false, error:'Order not found'}`.
- Idempotent: if already confirmed with the *same* reference → 200 `{success:true, order_id, already_confirmed:true, status}`. If confirmed with a different reference → 400 `{success:false, error:'Order already has a confirmed payment'}`.
- On success: updates `orders.payment_status='payment_confirmed'`, `status='processing'`, calls internal `notifyVendor()` (SMS, idempotent via `vendor_notified_at` + `vendor_notifications_log`), inserts an in-app `notifications` row for each vendor.
- 200 Response: `{ success:true, order_id, status:'processing', payment_status:'payment_confirmed' }`.
- Note: this is the **legacy/simple** confirm path used by `checkout-api`; the canonical production path for the current Briq-integrated app is `payments-api` `/confirm-payment` (money-split aware). Both update the same `orders`/`payments` tables — do not call both for the same order.

**GET /receipt/:orderId**
- 404 `{success:false, error:'Order not found'}`.
- 200: `{ success:true, order:{ id, customer_name, customer_email, customer_phone, delivery_city, delivery_address, delivery_type, delivery_fee, total_amount, status, payment_status, created_at, order_items:[{quantity, price, products:{title, image_url}}] } }`.

**POST /confirm-delivery**
- Request: `{ order_id, token }`. 400 if missing. 404 if order not found.
- Idempotent: already `status='confirmed'` → 200 `{success:true, already_confirmed:true, status:'confirmed'}`.
- 403 `{success:false, error:'Invalid confirmation token'}` if token mismatch.
- 200 on success: `{success:true, status:'confirmed'}`.

**POST /track-click** (aliases: `/affiliate-clicks`)
- Request: `{ code }` or `{ affiliate_code }`. 400 if missing.
- 200: `{success:true}` regardless of whether the code matched (silently no-ops if not found).

Vendor SMS notify (`notifyVendor` internal helper, triggered from both `checkout-api` and `payments-api` confirm-payment flows): looks up vendor phone from `profiles`, checks `vendor_notifications_log` for an existing `sent`/`delivered` row for `(order_id, notification_type='sms')` to avoid duplicate SMS, sends via Briq SMS API (`POST https://karibu.briq.tz/v1/sms/send`, header `X-API-Key: BRIQ_API_KEY`, body `{phone_number, message, app_key: BRIQ_DEVELOPER_APP_ID}`), logs result (`sent`/`failed`/`skipped`) into `vendor_notifications_log`, and on success sets `orders.vendor_notified_at` + `status='vendor_notified'`.

### 2. `checkout` (public, `verify_jwt` not set in config.toml → defaults to **JWT required unless overridden**; NOTE: `checkout-api`/`payments-api`/`admin-actions`/`send-otp`/`verify-otp`/`auth-email-hook` are explicitly `verify_jwt=false` in `supabase/config.toml`; `checkout`, `order-guardian`, `push-api` are **not** listed and use the platform default, i.e. Supabase gateway may require a valid `apikey`/JWT header on external calls even though the function code itself does not check a user JWT for `checkout`)
Base: `${SUPABASE_URL}/functions/v1/checkout`

External-facing unified endpoint for `shop.afrilink.info`, combining order + payment creation into one call.

| Method | Path | Purpose |
|---|---|---|
| POST | `/create` | Create order (if not exists) + create a Briq payment in one call. |

**POST /create**
- Request: `{ products:[{product_id, quantity}], buyer_name, buyer_email?, buyer_phone, buyer_city?, buyer_address?, buyer_country?, buyer_notes?, delivery_type?:'pickup'|'delivery' (default 'delivery'), affiliate_code?, checkout_session_id, purchase_mode?:'affiliate'|'marketplace' (default 'affiliate'), buyer_user_id?, buyer_role? }`
- 400 `{success:false, error:'Missing required fields'}` if products/buyer_name/buyer_phone/checkout_session_id missing.
- Idempotent on `checkout_session_id` (reuses existing order) and on `payment_${orderId}` (reuses existing payment → returns `already_exists:true`, no new Briq call).
- If `buyer_email` omitted, a synthetic email `${buyer_phone}@buyer.afrilink` is used for the `orders.customer_email` NOT NULL column.
- Delivery fee logic identical to `checkout-api /orders`.
- 503 `{success:false, error:'Payment provider not configured'}` if `BRIQ_API_KEY` unset.
- On Briq failure: marks `payments.status='FAILED'`, returns 502 `{success:false, error:'Payment provider error'}`.
- 201 Response: `{ success:true, order_id, payment_id, redirect_url, total_amount, delivery_fee }` where `redirect_url` is the Briq-hosted checkout page.
- Briq create-payment call: `POST ${BRIQ_BASE_URL}/api/v1/payments`, header `Authorization: Bearer BRIQ_API_KEY`, `Idempotency-Key: payment_<orderId>`; body includes `amount, currency, reference/order_id, description, return_url, success_url, cancel_url, failure_url, callback_url` (all pointed at `${VITE_APP_URL}/checkout/confirm?payment_id=...`), plus `developer_app_id/app_id` if configured, and `customer_name/customer_phone`.
- 404 for unknown paths; 500 on unexpected errors.

### 3. `payments-api` (public, `verify_jwt = false` — the function does its own JWT parsing per-route)
Base: `${SUPABASE_URL}/functions/v1/payments-api`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/create-payment` | none (order-driven) | Create a Briq (LIVE) or stub (STUB) payment for an order. |
| POST | `/confirm-payment` | none | Verify payment with Briq and apply the platform/affiliate/vendor wallet split. |
| GET | `/payment-status?payment_id=` | none | Poll payment status. |
| GET | `/wallet?type=VENDOR|AFFILIATE` | **JWT required** (Bearer user access token) | Get caller's own wallet balance. |
| GET | `/ledger?type=&limit=` | **JWT required** | Get caller's own ledger entries (paginated by `limit`, default 50). |
| POST | `/request-payout?type=` | **JWT required** | Request a payout (creates `payout_requests` row + atomically debits wallet). |
| GET | `/payout-requests` | **JWT required** | List caller's own payout requests. |
| POST | `/webhooks/briq` | none (webhook, optionally HMAC-checked) | Briq payment status webhook; triggers server-side re-verification, never trusts payload status directly. |

**POST /create-payment**
- Request: `{ order_id, amount, currency?, return_url? }`. 400 if `order_id`/`amount` missing. 404 if order not found.
- Idempotent via `idempotency_key = payment_${order_id}`; if a payment already exists returns `{success:true, payment_id, status, redirect_url, already_exists:true}`.
- **LIVE mode** (`PAYMENT_PROVIDER_MODE=LIVE` and `BRIQ_API_KEY` set): inserts `payments` row `status='PENDING', mode='LIVE', provider='BRIQ'`, calls Briq create-payment (see helper below), updates row with `provider_payment_id`/`raw_payload`. 201 `{success:true, payment_id, status:'PENDING', redirect_url, mode:'LIVE', provider_payment_id}`. On Briq failure: sets `status='FAILED'`, 502 `{success:false, error:'Payment provider error. Please try again.', payment_id}`.
- **STUB mode**: inserts `payments` row `mode='STUB'`, returns 201 `{success:true, payment_id, status:'PENDING', redirect_url, mode:'STUB'}` where `redirect_url` points at `${VITE_APP_URL}/checkout/confirm?payment_id=...` for a manual/dev confirm flow.

**POST /confirm-payment**
- Request: `{ payment_id }`. 400 if missing. 404 `{success:false, error:'Payment not found'}`.
- Idempotent: `status==='PAID'` → `{success:true, payment_id, status:'PAID', already_confirmed:true}`.
- LIVE mode: calls Briq verify (`GET ${BRIQ_BASE_URL}/api/v1/payments/:id`), normalizes status to `PAID|PENDING|FAILED|CANCELLED`. If `PAID` → runs `applyPaymentSplit()` (see below). If `FAILED`/`CANCELLED` → updates `payments.status` and `orders.payment_status='payment_failed'`, returns that status with no `success` field promoted to true. If still pending → 200 `{success:false, payment_id, status:'PENDING', error:'Payment is still being processed. Please wait.'}` (client should keep polling `/payment-status`). Briq verify errors → 502 `{success:false, payment_id, error:'Unable to verify payment status...'}`.
- STUB mode (or any non-LIVE pending payment): runs `applyPaymentSplit()` directly without provider verification.
- Response shape from split: `{ success, payment_id, status:'PAID'|<unchanged>, split?: { platform_fee, affiliate_fee, vendor_payouts:[{vendorId, amount}] } }`.

`applyPaymentSplit(adminClient, paymentId)` — the **core financial logic**:
1. Loads payment + order + order_items + products (vendor_id, commission).
2. Idempotency: `payment.status==='PAID'` → returns `{success:true, already_confirmed:true}`; if not `'PENDING'` → error.
3. Computes `productSubtotal` (excludes delivery fee) and `platformFee = round(productSubtotal * PLATFORM_FEE_PERCENT / 100)` (default `PLATFORM_FEE_PERCENT=5`).
4. If `order.purchase_mode==='affiliate'` and an `affiliate_link_id` exists, computes per-item affiliate commission (`products.commission` percent) and sums into `totalAffiliateFee`.
5. Computes per-vendor payout = `itemSubtotal - itemPlatformFee - itemAffiliateFee`, grouped by `vendor_id`; delivery fee is split across vendors (first vendor gets the rounding remainder).
6. Rounding correction: any discrepancy between `productSubtotal+deliveryFee` and `platformFee+affiliateFee+vendorTotal` is absorbed into the platform fee.
7. Credits wallets via RPCs `get_or_create_wallet` + `credit_wallet` for `PLATFORM`, `AFFILIATE` (if any), and each `VENDOR`, each with `p_reason='SALE_SPLIT'`, `p_entry_type='CREDIT'`, and a `metadata` payload with breakdown numbers. Duplicate-key ledger errors are treated as already-applied and logged, not thrown.
8. Updates `affiliate_links.conversions`/`commission_earned` when applicable.
9. Sets `payments.status='PAID'`, `orders.payment_status='payment_confirmed'`, `orders.status='processing'`.
10. Inserts in-app `notifications` for each vendor (`🛒 New Paid Order`) and the affiliate (`💰 Commission Earned`), each with `link:'/dashboard'`.

**GET /payment-status?payment_id=**
- 400 if missing. 404 `{success:false, error:'Payment not found'}`.
- 200: `{ success:true, payment_id, status, mode }`. Intended for client-side polling after redirect back from Briq.

**GET /wallet?type=**
- Requires `Authorization: Bearer <access_token>`; 401 `{success:false, error:'Unauthorized'}` if missing/invalid.
- `type` query defaults to `VENDOR` (also accepts `AFFILIATE`).
- 200: `{ success:true, wallet: {available_balance, pending_balance, currency, ...} }` or a zeroed default object if no wallet row exists yet.

**GET /ledger?type=&limit=**
- Same auth as `/wallet`. Returns `{ success:true, entries: LedgerEntry[] }` ordered by `created_at desc`, capped at `limit` (default 50). Empty array if wallet doesn't exist.

**POST /request-payout?type=**
- Auth required (401 otherwise).
- Request: `{ amount, destination_type:'MOBILE_MONEY'|'BANK', destination_details:{phone?|bank_name?,account_number?,account_name?} }`.
- 400 if fields missing or `amount < MIN_WITHDRAWAL_TZS` (default 20000).
- 404 `{success:false, error:'Wallet not found'}`. 400 `{success:false, error:'Insufficient balance'}` if `amount > available_balance`.
- Inserts `payout_requests` (`status='REQUESTED'`), then atomically debits the wallet via RPC `debit_wallet_for_payout`.
- 201: `{ success:true, payout_request_id, status:'REQUESTED' }`.
- **Note:** This is the in-house payout path. Production vendor withdrawals in the current UI go through `order-guardian` `POST /withdrawals` instead (external ledger), which additionally mirrors a `payout_requests` row for the admin UI. A Flutter client should use whichever flow matches the target rollout (see `order-guardian` below) — do not call both for the same withdrawal.

**GET /payout-requests**
- Auth required. 200: `{ success:true, requests: PayoutRequest[] }` for the caller, newest first.

**POST /webhooks/briq**
- No required auth header from Supabase gateway perspective is enforced in code (public function), but a `BRIQ_WEBHOOK_SECRET` if configured is checked for a `x-briq-signature`/`x-webhook-signature` header presence (logged only — actual trust boundary is server-side re-verification, not the header).
- Body: raw Briq event JSON, expected to contain `id`/`payment_id`/`transaction_id`.
- Behavior: looks up local `payments` row by `provider_payment_id`; if `PENDING`, calls Briq verify API server-side (never trusts the webhook body's status field) and applies the same `applyPaymentSplit`/failure update logic as `/confirm-payment`.
- Always returns 200 `{success:true, message:'Webhook received'}` to acknowledge receipt (even on internal errors) so Briq doesn't retry indefinitely; errors are logged only.

Briq payment provider adapter (shared logic, used by both `checkout`/`checkout-api` style callers and `payments-api`):
- **Create**: `POST ${BRIQ_BASE_URL}/api/v1/payments`, `Authorization: Bearer BRIQ_API_KEY`, `Idempotency-Key: <key>`; body `{amount, currency, reference, order_id, description, return_url, success_url, cancel_url, failure_url, callback_url, developer_app_id?, app_id?, customer_name?, customer_phone?}`. Expects response fields `id|payment_id` and `payment_url|checkout_url|redirect_url`.
- **Verify**: `GET ${BRIQ_BASE_URL}/api/v1/payments/:providerPaymentId`, `Authorization: Bearer BRIQ_API_KEY`. Normalizes `status|payment_status|state` into `PAID|PENDING|FAILED|CANCELLED` via string matching (`PAID/SUCCESS/SUCCESSFUL/COMPLETED/APPROVED`→PAID; `CANCELLED/CANCELED/EXPIRED`→CANCELLED; `FAILED/REJECTED/DECLINED/ERROR`→FAILED; else PENDING).
- Default `BRIQ_BASE_URL = https://paygrid.briq.tz` (payments) — note SMS/OTP use a **different** Briq host, `https://karibu.briq.tz`.

### 4. `admin-actions` (public, `verify_jwt = false` — function verifies the caller manually via `supabase.auth.getUser()` + `is_admin` RPC)
Base: `${SUPABASE_URL}/functions/v1/admin-actions`
- Method: **POST only** (single endpoint, action-dispatch pattern).
- Headers: `Authorization: Bearer <admin's access token>` required; 401 if missing/invalid, 403 `{error:'Admin access required'}` if `is_admin(user_id)` RPC returns false.
- Request body: `{ action: string, targetTable: string, targetId?: string, data?: object, notes?: string }`.

| `action` | Effect | Notification sent |
|---|---|---|
| `approve_product` | `products.status='approved'` | vendor: 🎉 Product Approved |
| `reject_product` | `products.status='rejected'` | vendor: ❌ Product Not Approved (uses `notes` as reason) |
| `approve_takedown` | `products.status='taken_down'` | vendor: ⚠️ Product Taken Down |
| `reject_takedown` | `products.status='approved'` | vendor: ✅ Takedown Request Rejected |
| `approve_application` | `applications.status='approved'`, inserts `user_roles` row, upserts `vendor_profiles`/`affiliate_profiles` | user: 🎉 {Role} Application Approved |
| `reject_application` | `applications.status='rejected'` | user: ❌ {Role} Application Not Approved |
| `process_withdrawal` | `withdrawals.status = data.status` (default `'approved'`); if approved, decrements `profiles.wallet_balance` and inserts a `transactions` row | user: 💰 Withdrawal Approved / ❌ Withdrawal Rejected |
| `update_order_status` | `orders.status = data.status` | vendors (one per distinct vendor in order items): 📦 Order Status Updated |
| `verify_user` | `profiles.verification_status='verified'`, `photo_verified=true` | user: ✅ Verification Approved |
| `reject_verification` | `profiles.verification_status='rejected'`, `photo_verified=false` | user: ❌ Verification Not Approved |
| `get_dashboard_stats` | Read-only: parallel counts of profiles/vendors/affiliates/products/pending products/orders/pending withdrawals/pending applications | none |

- Response: `{ ...result }` (e.g. `{success:true, product:{...}}`), or `{error:'Unknown action'}` (400) for an unrecognized `action`.
- Every action except `get_dashboard_stats` writes an audit row to `admin_actions` (`admin_id, action_type, target_table, target_id, old_data, new_data, notes`).
- 500 `{error: message}` on unexpected failures.

### 5. `order-guardian` (proxy to external Order Guardian service; requires user JWT)
Base: `${SUPABASE_URL}/functions/v1/order-guardian`
- Headers: `Authorization: Bearer <user access token>` required (401 `{error:'Unauthorized'}` otherwise). Resolves the caller's `vendor_code` from `vendor_profiles` (service role) before proxying.
- 503 `{error:'Order service not configured'}` if `ORDER_GUARDIAN_API_KEY` unset.

| Method | Path | Purpose |
|---|---|---|
| GET | `/orders` | List the vendor's orders from the external Order Guardian service. |
| GET | `/wallet` | Get the vendor's external wallet balance. |
| POST | `/withdrawals` | Request a withdrawal with a flat 2000 TZS fee, forwarded to Order Guardian and mirrored into local `payout_requests`. |

**GET /orders**
- If vendor has no `vendor_code` set: 200 `{error:'Vendor code not set for this account', orders:[]}` (soft-fail, not an HTTP error).
- Otherwise proxies to `GET ${ORDER_GUARDIAN_BASE_URL}/orders?vendor_id=<vendor_code>`. Returns upstream body verbatim on success; `{error:'Upstream error', details: body}` with the upstream status on failure.

**GET /wallet**
- If no `vendor_code`: 200 `{error:'Vendor code not set for this account', wallet:{balance:0, currency:'TZS'}}`.
- Otherwise proxies to `GET ${ORDER_GUARDIAN_BASE_URL}/wallet/<vendor_code>`.

**POST /withdrawals**
- Request: `{ amount, destination_type?:'MOBILE_MONEY' (default), destination_details:{...} }`.
- 400 `{error:'Vendor code not set for this account'}`, `{error:'Invalid JSON body'}`, `{error:'Invalid amount'}` (non-finite or ≤0), or `{error:'Amount must exceed the 2000 TZS fee'}` if `amount <= 2000`.
- `net_amount = amount - 2000` (hard-coded `WITHDRAWAL_FEE_TZS = 2000`).
- 1) Proxies `POST ${ORDER_GUARDIAN_BASE_URL}/withdrawals` with body `{vendor_id, amount, fee:2000, net_amount, destination_type, destination_details}`. On upstream failure: returns `{error:'Order service rejected withdrawal', details}` with upstream status.
- 2) On upstream success, mirrors a `payout_requests` row locally (`status='REQUESTED'`, `destination_details` augmented with `external_provider:'order-guardian', external_response, fee_tzs, net_amount_tzs, vendor_code`) via `get_or_create_wallet` RPC + insert, purely so the existing admin approval UI has visibility (best-effort; failure here is logged but does not fail the request).
- 200: `{ success:true, amount, fee:2000, net_amount, upstream: <upstream body> }`.
- **External Order Guardian contract** (`https://order-guardian.vercel.app` by default, overridable via `ORDER_GUARDIAN_BASE_URL`), auth header `Authorization: Bearer ORDER_GUARDIAN_API_KEY` and `x-api-key: ORDER_GUARDIAN_API_KEY`:
  - `GET /orders?vendor_id=<code>` → vendor's order list.
  - `GET /wallet/:vendor_id` → `{ balance, currency, ... }` (exact shape controlled by the external service; the proxy does not transform it).
  - `POST /withdrawals` body `{ vendor_id, amount, fee, net_amount, destination_type, destination_details }` → external system performs the payout; the **2000 TZS flat fee** is always computed and enforced client-side (in this proxy) before forwarding.

### 6. `push-api` (public, `verify_jwt = false`; per-route JWT parsing)
Base: `${SUPABASE_URL}/functions/v1/push-api`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/vapid-key` | none | Fetch (or lazily generate) the server's VAPID public key for Web Push. |
| POST | `/subscribe` | JWT required | Upsert a push subscription for the current user. |
| DELETE | `/subscribe` | JWT required | Remove a push subscription (by endpoint). |
| POST | `/send` | JWT required | Stub — actual sending currently happens from other backend flows, not implemented here. |

**GET /vapid-key**
- 200: `{ publicKey: string }`. Keys are generated once (ECDSA P-256 via Web Crypto) and stored in `push_config` (`vapid_public_key`, `vapid_private_key`); subsequent calls reuse the stored key.
- Irrelevant to Flutter/FCM migration — see NOTIFICATIONS.md for what replaces this.

**POST /subscribe**
- Requires `Authorization` header; 401 `{error:'Unauthorized'}` if invalid.
- Request: `{ endpoint, p256dh, auth, platform? }` (Web Push subscription object). 400 `{error:'Missing subscription fields'}` if any of endpoint/p256dh/auth missing.
- Upserts into `push_subscriptions` on conflict `(user_id, endpoint)`. 200 `{success:true}`. 500 `{error:'Failed to store subscription'}` on DB error.

**DELETE /subscribe**
- Request: `{ endpoint }`. 400 if missing. Deletes matching `(user_id, endpoint)` row. 200 `{success:true}`.

**POST /send**
- Currently a no-op placeholder: 200 `{success:true, message:'Push sending is handled by the backend system'}`. No actual web-push delivery is implemented in this function today.

### 7. `send-otp` (public, `verify_jwt = false`)
Base: `${SUPABASE_URL}/functions/v1/send-otp`
- Method: POST only (405 `{success:false, error:'Method not allowed'}` otherwise).
- Request: `{ phone: string }` (E.164-ish, e.g. `+2557XXXXXXXX`). 400 `{success:false, error:'Phone number is required'}` if missing, or `{success:false, error:'Invalid request body'}` if JSON parse fails.
- 500 `{success:false, error:'SMS provider not configured'}` if `BRIQ_API_KEY`/`BRIQ_DEVELOPER_APP_ID` unset.
- Calls Briq OTP API: `POST https://karibu.briq.tz/v1/otp/request`, header `X-API-Key: BRIQ_API_KEY`, body `{ phone_number, app_key: BRIQ_DEVELOPER_APP_ID, developer_app_id, sender_id:'Afrilink', otp_length:6, minutes_to_expire:10, delivery_method:'sms', message_template:'Your Afrilink verification code is {code}. It expires in 10 minutes.' }`.
- 500 `{success:false, error:'SMS delivery failed'}` on Briq non-2xx or network exception.
- 200: `{ success:true, request_id }` (from Briq's `request_id`/`requestId` field, may be null).
- Logs are redacted for sensitive keys (`api_key, apikey, app_key, token, secret, code, otp, otp_code`) — no OTP code value ever appears in logs or responses.

### 8. `verify-otp` (public, `verify_jwt = false`)
Base: `${SUPABASE_URL}/functions/v1/verify-otp`
- Method: POST only. Request: `{ phone, code }`. 400 if either missing, or invalid JSON.
- 500 `{success:false, error:'SMS provider not configured'}` if Briq env vars unset.
- Calls `POST https://karibu.briq.tz/v1/otp/verify`, header `X-API-Key`, body `{ phone_number, app_key, developer_app_id, code }`.
- 400 `{success:false, error: data.message || 'Invalid or expired code'}` if Briq rejects.
- 200: `{ success:true, verified:true }`.
- 500 `{success:false, error:'Verification failed'}` on network/exception.
- **Note**: this function only checks the code with Briq; it does **not** itself update `profiles.phone_verified` — the caller (client) must separately call `supabase.from('profiles').update({phone_verified:true})` after receiving `verified:true` (see `PhoneVerificationFlow`/`RegistrationFlow`). A Flutter client must replicate this two-step pattern or the backend should be updated to do it server-side.

### 9. `app-config` (public, no auth)
Base: `${SUPABASE_URL}/functions/v1/app-config`
- Method: GET or POST (both handled identically). Returns the canonical app URL used for building absolute links (email redirects, share links, deep-link fallback).
- 200: `{ success:true, appUrl: string }`, `Cache-Control: public, max-age=300`.
- 405 `{success:false, error:'Method not allowed'}` for other verbs.
- Fallback: `https://afrilink01.vercel.app` if `VITE_APP_URL` env var is unset (logged as a warning). Flutter should hard-code its own canonical API/app URLs rather than depend on this endpoint, but should replicate the value for any generated web links (e.g., sharing an affiliate link that opens in a browser).

### 10. `auth-email-hook` (public, `verify_jwt = false`; Supabase **Send Email Hook** + Lovable Email API)
Base: `${SUPABASE_URL}/functions/v1/auth-email-hook`
- Two entry points:
  - `POST /` (default) — the actual Supabase Auth email webhook. Verifies signature + timestamp via `verifyWebhookRequest` (`x-lovable-signature`, `x-lovable-timestamp` headers, secret = `LOVABLE_API_KEY`). 401 `{error:'Invalid signature'}` on bad/stale signature; 400 `{error:'Invalid webhook payload'}` on malformed payload; 400 `{error:'Unsupported payload version: <v>'}` if `payload.version !== '1'`; 400 `{error:'Unknown email type: <type>'}` if `payload.data.action_type` isn't one of `signup|invite|magiclink|recovery|email_change|reauthentication`.
  - `POST /preview` — internal template-preview tool, requires `Authorization: Bearer LOVABLE_API_KEY`; not part of the app's runtime auth flow.
- On success: renders a branded React-Email template (Winger-branded, sender domain `notify.afrilink.info`, from `noreply@afrilink.info`) to HTML+text and sends via Lovable's email-sending callback URL supplied in the payload (`payload.data.callback_url`). Returns 200 `{success:true, message_id}`.
- **Recovery email special-casing**: `normalizeConfirmationUrl` forces the `redirect_to` query param (or the whole URL if it's a `*.lovableproject.com`/`*.lovable.app` preview host) to `https://afrilink01.vercel.app/reset-password` (`MAIN_APP_URL`, hard-coded — always the **main app**, never the shop subdomain), regardless of what `VITE_APP_URL` resolves to elsewhere. This matters for Flutter: the recovery deep-link must ultimately arrive at that same reset flow (see AUTHENTICATION.md for the deep-link fallback pattern already built for Phase 2 mobile).
- This function does not need to be called directly by any client; it's wired into Supabase Auth's "Send Email" hook configuration.

---

## Realtime channel subscriptions (`supabase.channel(...)`)

Tables enabled in the `supabase_realtime` publication: **`notifications`, `wallets`, `orders`, `ledger_entries`**.

| Channel name pattern | Table | Filter | Events | Used by | Effect |
|---|---|---|---|---|---|
| `notifications-changes` | `notifications` | `user_id=eq.<currentUserId>` | `*` (INSERT/UPDATE/DELETE) | `useNotifications` hook (all dashboards) | INSERT → prepend to list, increment unread count. UPDATE → patch the row in place and recompute unread count. DELETE → remove from list. |
| `wallet-<type>-<userId>` | `wallets` | `owner_id=eq.<currentUserId>` | `*` | `WalletSection` | Any change on the user's wallet row triggers a full `fetchWallet()` refetch (does not use the payload directly) against `payments-api GET /wallet`. This is how balance updates appear live after a sale is confirmed and `credit_wallet` runs server-side. |

No client-side subscriptions currently exist on `orders` or `ledger_entries` directly (they are enabled in the publication for potential future use / other consumers), but a Flutter client MAY subscribe to `orders` (e.g. filtered by `checkout_session_id` or `id`) for live order-status updates on a tracking screen, and to `ledger_entries` (filtered by `wallet_id`) to live-update the ledger/history list instead of polling `payments-api GET /ledger`.

All realtime subscriptions require the Supabase client's WebSocket connection using the **anon key**; row visibility is still governed by RLS on the underlying table (a user only receives events for rows they're allowed to `select`).

---

## Summary of REST base URLs a Flutter client needs to configure

```
SUPABASE_URL                         (PostgREST + Auth + Realtime + Storage)
SUPABASE_URL/functions/v1/checkout-api
SUPABASE_URL/functions/v1/checkout
SUPABASE_URL/functions/v1/payments-api
SUPABASE_URL/functions/v1/admin-actions
SUPABASE_URL/functions/v1/order-guardian
SUPABASE_URL/functions/v1/push-api
SUPABASE_URL/functions/v1/send-otp
SUPABASE_URL/functions/v1/verify-otp
SUPABASE_URL/functions/v1/app-config
```
Every `fetch()` call to a function additionally needs the `apikey` header set to
the Supabase anon/publishable key (required by the Supabase edge gateway even
when the function itself doesn't check a user JWT), and `Authorization: Bearer
<user_access_token>` for any route documented above as requiring auth.
