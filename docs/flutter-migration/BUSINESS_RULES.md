# PART 10 — BUSINESS RULES

## Visibility Rules
- Marketplace listing (guest/affiliate browse): `products.status = 'approved'` (fetched in `fetchUserData`/`fetchMarketplaceProducts`). Availability (`is_available`) is NOT filtered out of this list — sold-out items still appear with a "Sold Out" badge.
- Single product detail page (`ProductPage.tsx`) and checkout order creation (`checkout-api`): BOTH require `status = 'approved' AND is_available = true`. A sold-out product therefore shows in the grid but 404s ("Product not found.") on its own detail page and cannot be ordered.
- Vendor's own product list (dashboard): all statuses shown (`approved, pending, pending_takedown, taken_down, rejected`) with status badges; no filtering.
- Product status lifecycle: `pending → approved | rejected` (admin decision). `approved → pending_takedown` (vendor requests takedown) `→ taken_down` (admin approves takedown). Editing an `approved` or `rejected` product resets it to `pending`. There is no path back from `taken_down` to `approved` via vendor action (would require admin/new product).

## Role-Based Feature Gating
- `userRole` is per-user-per-device, cached in `localStorage.afrilink_active_role_{userId}`, chosen from `availableRoles` (rows in `user_roles`).
- Vendor-only: Add/Edit/Takedown/Availability-toggle products, Vendor Orders, Vendor wallet.
- Affiliate-only: Generate Link / Grab Link ("Grab Link is available for affiliate accounts only." error if a vendor tries).
- Both roles: Settings, Verification, Help/Support, Wallet+Withdraw (parameterized by `walletType`).
- A user may hold both roles simultaneously (`availableRoles` can contain both `vendor` and `affiliate`); switching is instant client-side (no server round trip) and re-triggers the profile-completeness gate for the newly active role.
- Admin role can never be self-granted via signup metadata (`handle_new_user()` trigger forces non-admin roles to fall back and explicitly blocks `role='admin'` from client signup payloads).

## Button Enable/Disable Conditions
- Signup/Login/Reset submit buttons: disabled while `loading` (shows spinner + label change, e.g., "Creating Account...", "Verifying...", "Updating...").
- OTP verify button: enabled once 6 digits entered (no length gate on the button itself, but a manual pre-check toasts if `<6`).
- OTP resend (`RegistrationFlow`): disabled while `loading` OR `resendCooldown > 0` (60s cooldown after send).
- Withdraw button (all 3 wallet variants): disabled when `balance < MIN_WITHDRAWAL_TZS (20,000 TZS)`.
- `NewWithdrawModal`/`ExternalWithdrawModal` submit: disabled unless `isValidAmount && selectedMethod chosen && balance >= MIN_WITHDRAWAL_TZS` (also `!isLoading`).
- Legacy `WithdrawModal` submit: disabled unless `isValidAmount && selectedMethod && paymentDetails` non-empty.
- "Buy Now" on `ProductPage`: fully disabled (`cursor-not-allowed`, shows "Buy via Affiliate Link") unless the visitor has affiliate attribution (`ref` param or stored `localStorage.affiliateCode`).
- Vendor profile setup submit: no explicit disabled state beyond `loading`, but validation blocks submission (business name, city, pickup location, logo file, and map location all mandatory).
- Checkout submit: disabled while `loading`; label switches to spinner + "Processing...".
- Image "Add More" upload triggers disabled while `isUploading`.

## Verification Gating
- **Hard gate (blocks all app usage):** `profiles.phone_verified` must be true, checked on every `fetchUserData()` call, BEFORE role-specific routing — even before vendor/affiliate profile-completeness checks. Any falsy value routes to `phone-verification`.
- **Soft gate (`VerificationStatusCard`, dashboard widget):** tracks `email_verified`, `phone_verified`, `photo_verified` as a 3-step progress bar (0–100%). Auto-hides itself 2 minutes after all 3 are true. Does NOT block feature usage by itself (separate from the phone-verification hard gate above) — this appears to be a legacy/parallel "Verified" badge system (`VerificationForm`/`VerificationManagePage`) distinct from the phone-only hard gate; a fully-verified user gets `currentUser.verified = true` (used for badges like "Verified Vendor" on `ProductPage`) but is NOT required for baseline marketplace/dashboard access.
- `verification_status` field values observed: `pending`, `pending_review`, `verified`, `rejected`. `rejected`/`verified` both allow "Request New Verification" to reset to `pending`.
- Withdrawals are NOT explicitly gated on `verification_status` in the reviewed withdraw modals (only balance/amount checks apply) — verify against `payments-api`/`order-guardian` server-side before assuming client parity is sufficient; server may enforce additional checks not visible client-side.

## Commission Math & Full Money Split (server-side, `payments-api applyPaymentSplit`)
Given an order with `order_items[{price, quantity, product:{commission, vendor_id}}]` and `order.delivery_fee`:

1. `productSubtotal = Σ (item.price × item.quantity)` (excludes delivery fee).
2. `PLATFORM_FEE_PERCENT` = env var, default **5%** (`PLATFORM_FEE_PERCENT` secret, integer percent).
3. `platformFee = round(productSubtotal × PLATFORM_FEE_PERCENT / 100)`.
4. **Affiliate commission** only applies if `order.purchase_mode === 'affiliate'` AND `order.affiliate_link_id` is set:
   - Per item: `itemAffiliateAmount = round(itemSubtotal × product.commission / 100)` where `product.commission` is the **per-product commission percent set by the vendor at listing time** (1–50, clamped client-side on create/edit).
   - `totalAffiliateFee = Σ itemAffiliateAmount`.
5. **Vendor payout**, computed per line item then grouped/summed by `vendor_id`:
   - `itemPlatformFee = round(itemSubtotal × PLATFORM_FEE_PERCENT / 100)`
   - `itemAffiliateFee = affiliateId ? round(itemSubtotal × product.commission / 100) : 0`
   - `itemVendorPayout = itemSubtotal − itemPlatformFee − itemAffiliateFee`
   - Summed into `vendorPayouts[vendor_id].amount`.
6. **Delivery fee distribution:** if there are multiple vendors in one order, `deliveryFee` is split via `floor(deliveryFee / vendorCount)` to each vendor, with the integer **remainder added entirely to the first vendor** (`vendorIds[0]`) — not evenly rounded, not randomly assigned; deterministic based on `Object.keys()` iteration order.
7. **Rounding-integrity reconciliation:** `expectedTotal = productSubtotal + deliveryFee`; `calculatedTotal = platformFee + totalAffiliateFee + totalVendorPayout`. If they don't match exactly (due to per-item rounding), the **discrepancy (positive or negative) is added entirely to the platform fee** (`adjustedPlatformFee`), guaranteeing `platformFee + affiliateFee + vendorPayout === subtotal + deliveryFee` exactly, at the platform's expense/benefit.
8. Wallet credits are applied atomically via RPC `credit_wallet` (ledger entries, `reason='SALE_SPLIT'`, `entry_type='CREDIT'`) into `PLATFORM`, `AFFILIATE` (if applicable), and each `VENDOR` wallet (auto-created via `get_or_create_wallet` if missing).
9. **Idempotency:** re-invoking the split for an already-`PAID` payment is a no-op (`already_confirmed: true`); it can only run once per payment (status must be exactly `PENDING`).
10. Non-affiliate ("marketplace") purchases skip the affiliate-fee step entirely; 100% of what would've been the affiliate cut instead stays with the vendor (since `itemAffiliateFee = 0` when `affiliateId` is null).

## Withdrawal Fee & Minimums
- Canonical (`payments-api` / `order-guardian`) minimum withdrawal: **20,000 TZS** (`MIN_WITHDRAWAL_TZS`, both a server env constant and hardcoded client constants in every wallet component — keep in sync).
- `order-guardian`-backed external wallet withdrawal (`ExternalWithdrawModal`) charges a flat **2,000 TZS** processing fee (`WITHDRAWAL_FEE_TZS`), net payout = amount − 2000; requires `amount > 2000` in addition to the 20,000 floor.
- `payments-api`-backed ledger withdrawal (`NewWithdrawModal`) shows "Processing Fee: Free" — no fee deducted in that UI path.
- Legacy `WithdrawModal` (direct `withdrawals` table insert) has no minimum and no fee — treat as deprecated.

## Currency Formatting
- All money is displayed via `formatCurrency(amount) => "Tsh " + amount.toLocaleString()` — i.e., prefix `"Tsh "` + thousands-separated integer (locale-default separators, no decimal places shown regardless of underlying value's precision).
- All monetary values in the database/API are treated as **whole TZS integers** (no cents) EXCEPT the legacy `WithdrawModal` which stores `Math.round(amount * 100)` (cents-like) — an inconsistency to resolve/avoid in the Flutter rebuild by not reusing that legacy path.

## Admin Moderation States
- Products: `pending` (new/edited, awaiting review) → `approved` (live) or `rejected` (denied); `approved` → `pending_takedown` (vendor-requested) → `taken_down` (admin-approved removal).
- Vendor/Affiliate verification: `pending` → `pending_review` (documents submitted) → `verified` or `rejected`; `rejected`/`verified` can be reset to `pending` via "Request New Verification".
- Applications table (`applications`, auto-created at signup): `status = 'pending'` at creation — admin review workflow for role applications is implied but not present in the reviewed frontend code (admin UI is out of scope of this app's user-facing code).

## Notification Trigger Rules (server-generated, in `applyPaymentSplit`)
- One notification per vendor on the order, always fired when a payment is confirmed, regardless of amount.
- One notification for the affiliate ONLY if `affiliateId` is set AND `totalAffiliateFee > 0`.
- No notifications are generated for platform-fee events, failed payments, or withdrawal status changes in the reviewed code (server may have additional triggers not shown in the excerpted admin/payout code).

## Pagination / Sorting / Filtering Rules
- **No server-side pagination observed** for marketplace products, vendor products, or affiliate links — all fetches pull the *entire* filtered table result set (`select('*')` with only a `status`/`vendor_id` equality filter) into client memory, then filter/sort client-side. This does not scale but must be replicated 1:1 unless deliberately improved in the Flutter rebuild (flag as a known technical debt item, not a business rule to intentionally reproduce if avoidable).
- No explicit sort order is applied by any query shown (relies on default DB return order, effectively insertion/PK order) — products are NOT sorted by newest, price, or popularity anywhere in the reviewed code.
- Marketplace filters are purely client-side array `.filter()` operations combined with logical AND:
  - **Search**: case-insensitive substring match against BOTH `title` and `description`.
  - **Category**: exact match against `selectedCategory`, or `'All'` bypasses the filter. Category list is derived dynamically: `['All', ...new Set(marketplaceProducts.map(p => p.category))]`.
  - **Commission filter** (`commissionFilter` values `all|5+|10+|15+|20+`): `product.commission >= threshold` (5, 10, 15, or 20).
  - **Price filter** (`priceFilter` values `all|0-50000|50000-100000|100000-500000|500000+`):
    - `0-50000` → `price < 50000`
    - `50000-100000` → `price >= 50000 && price <= 100000`
    - `100000-500000` → `price > 100000 && price <= 500000`
    - `500000+` → `price > 500000`
  - All four filters (search, category, commission, price) apply simultaneously (logical AND) via a single `.filter()` predicate.

## Affiliate Link Availability
- One unique `affiliate_links` row per `(affiliate_id, product_id)` pair — re-clicking "Generate Link"/"Grab Link" for a product the affiliate already has a link for reuses the existing code (no duplicate rows), just re-copies to clipboard.
- Link code format: `` `${affiliateId.slice(0,6)}_${productId.slice(0,6)}_${Date.now().toString(36)}` `` — not cryptographically random, but sufficiently unique for the use case (collision risk theoretically nonzero but negligible in practice).
- Only users with active role `affiliate` may generate links; vendors are blocked even for their own products.
- Links work regardless of the affiliate's own verification status (no verification gate observed on link generation) — only the phone-verification hard gate (global) and the affiliate-profile-completeness gate apply before an affiliate can reach the marketplace/dashboard where link generation is available.

## Conversion Tracking Rules
- **Click**: recorded either via `resolve_affiliate_link` RPC (when `?ref=` appears anywhere the code checks it, e.g. app entry) or `checkout-api/track-click` POST (specifically on `ProductPage` visits with a `ref` param). Both increment click-related counters server-side (exact RPC/function internals not in frontend scope, but the *trigger points* are: app-level `?ref=` landing, and `/p/:id?ref=` product page visits).
- **Conversion**: only recorded when a payment is successfully confirmed AND the order's `purchase_mode === 'affiliate'` AND it has a linked `affiliate_link_id` — increments `affiliate_links.conversions` by exactly 1 per completed order (not per item/quantity) and adds `totalAffiliateFee` to `commission_earned`.
- Conversion rate shown on Affiliate Dashboard = `round((totalConversions / totalClicks) × 100)` across ALL the affiliate's links combined, guarded against divide-by-zero (`totalClicks > 0 ? ... : 0`).
- Marketplace ("non-affiliate") purchases never generate a conversion or commission event, by design — commission is exclusively an affiliate-attribution mechanism.

## Duplicate-Order Prevention
- Client generates one `checkout_session_id` (`crypto.randomUUID()`) per checkout modal instance/attempt, held in a React ref so retries within the same modal session reuse it (only cleared/regenerated after a hard failure or after successful completion).
- Server (`checkout-api POST /orders`) looks up an existing order by `checkout_session_id` BEFORE creating a new one; if found, returns the existing order's id/status/totals with `already_exists: true` instead of inserting a duplicate row. This is the sole application-level idempotency mechanism for order creation (there is no unique DB constraint enforcement visible in the frontend-reachable code, but the check-then-insert pattern relies on this session id column).
- Payment confirmation is separately idempotent via the `payment.status === 'PAID'` short-circuit in `applyPaymentSplit` (prevents double-crediting wallets even if `confirm-payment` is called multiple times, e.g. due to client retries or webhook + client-poll racing).

## Cart Session Isolation
- The cart is a **single global `localStorage` array**, NOT scoped by user id, browser tab, or session. Logging out does clear it (`clearCart()` in `handleLogout`), but simply navigating away/closing the tab does not. Guests and logged-in users on the same browser share one cart. Multiple accounts logging in sequentially on the same device/browser will see the SAME cart contents unless an explicit logout clears it in between. There is no server-persisted cart — cart state does not sync across devices.
- `affiliateCode` (referral attribution) is stored and cleared alongside the cart (`localStorage.affiliateCode`), and separately also cleared on successful payment confirmation (`CheckoutConfirmPage`) — so affiliate attribution has TWO independent clearing triggers: `clearCart()` (logout, successful checkout) and explicit removal after payment success.
- For the Flutter rebuild, decide deliberately whether to scope cart storage per-authenticated-user (recommended improvement) or replicate the current shared/global behavior for parity — document the decision, as this is a notable behavioral quirk of the existing app.
