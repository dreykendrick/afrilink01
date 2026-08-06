# PART 4 — USER FLOWS (Winger / Afrilink Marketplace)

> Source of truth: `src/pages/Index.tsx`, `src/hooks/useAuth.tsx`, `src/hooks/useCart.tsx`, `src/components/auth/*`, `src/components/onboarding/*`, `src/components/cart/*`, `src/components/marketplace/*`, `src/components/dashboard/*`, `src/pages/ProductPage.tsx`, `src/pages/CheckoutConfirmPage.tsx`, `src/pages/OrderConfirmationPage.tsx`, `supabase/functions/checkout-api`, `supabase/functions/payments-api`, `supabase/functions/send-otp`, `supabase/functions/verify-otp`, `supabase/migrations/*handle_new_user*`.
> All currency values are TZS (Tanzanian Shilling), displayed via `formatCurrency()` as `Tsh {amount.toLocaleString()}`.

---

## 0. Global App Shell / Routing Model

The app (`Index.tsx`) is a single-page state machine (`view` state), NOT React Router for most screens (React Router is used only for `/p/:productId`, `/confirm/:orderId`, checkout confirm page). View is persisted in the URL query string `?view=...&role=...` via `updateUrlView`/`getViewFromUrl` so refresh/deep-link restores state.

Views: `landing | login | signup | forgot-password | reset-password | verification | dashboard | marketplace | settings | verification-manage | help-support | orders | onboarding | role-selection | onboarding-register | vendor-profile-setup | affiliate-profile-setup | phone-verification`.

### Recovery lock mechanism
- If the URL hash contains `type=recovery` (Supabase password-recovery redirect) OR pathname is `/reset-password`, `recoveryLocked.current` is set `true` and view is force-set to `reset-password`.
- While `recoveryLocked.current === true`, `setView()` **blocks all navigation** except to `reset-password` or `login`. This prevents any other effect (auth redirect, default-view effect) from hijacking the screen during a password reset flow.
- The lock also listens for the Supabase `PASSWORD_RECOVERY` auth event and force-navigates to `reset-password` if it fires after mount.
- Lock is released only when `setView('login')` is called (typically after `ResetPasswordPage` completes and signs out the recovery session).

### First-load default view logic (no explicit `?view=`)
- If `recoveryLocked` → do nothing (already handled above).
- Else if no `user` (not logged in):
  - If `localStorage.afrilink_onboarding_seen` is NOT set → `view = 'onboarding'` (carousel).
  - Else → `view = 'role-selection'`.
- If `user` exists and `userRole` resolved and `view !== 'verification'` and `view !== 'reset-password'` → call `handlePostLogin()` → `fetchUserData()`.

### Affiliate ref capture on load
- On mount, reads `?ref=` query param. If present: `setAffiliateCode(ref)` (persisted to `localStorage.affiliateCode`) and fires `supabase.rpc('resolve_affiliate_link', { p_code: ref })` (SECURITY DEFINER RPC; click tracking, no public table read).

---

## 1. Signup (Email/Password) — `SignupPage`

**Start:** User on `signup` view (reached from landing/login "Sign Up" link, or role-selection legacy path).

**Fields:** Full Name, Email, Password, Role select (`vendor` default / `affiliate`).

**Validation (zod, client-side, on submit):**
```
email: z.string().email('Please enter a valid email address')
password: z.string().min(6, 'Password must be at least 6 characters')
fullName: z.string().min(2, 'Full name must be at least 2 characters')
```
On failure → toast title `'Validation Error'`, description = first zod error message, variant destructive. No inline field errors shown.

**Submit logic:**
1. `getAppUrlAsync()` → canonical app URL for email redirect.
2. `supabase.auth.signUp({ email, password, options: { data: { full_name, role }, emailRedirectTo: `${appUrl}/` } })`.
3. On error:
   - If message includes `'User already registered'` → toast `'Account Exists'` / `'An account with this email already exists. Please sign in instead.'` (destructive).
   - Else → toast `'Signup Failed'` / `getUserFriendlyError(error.message)` (destructive).
4. On success (`data.user` present):
   - **DB trigger `handle_new_user()`** (SECURITY DEFINER, fires AFTER INSERT on `auth.users`) automatically:
     - Inserts into `profiles(id, email, full_name)` (ON CONFLICT DO NOTHING).
     - Resolves role from `raw_user_meta_data->>'role'`, defaulting to `'vendor'` if missing/invalid; **admin role can never be self-assigned** — forced to `'vendor'` if requested.
     - Inserts into `user_roles(user_id, role)` (ON CONFLICT DO NOTHING).
     - Inserts into `applications(user_id, email, full_name, role, status='pending')`.
   - Toast `'Account Created!'` / `'Please complete your verification.'`.
   - Calls `onSignupSuccess(data.user.id)` → sets `pendingUserId`, navigates to `verification` view.

**Failure/Edge cases:**
- Duplicate email → handled above.
- Any other Supabase error → generic friendly error mapping (see `errorMessages.ts`).
- No client-side check for password confirmation on signup (only 1 password field).

---

## 2. Alternate Signup — Role-based Registration Flow (`RegistrationFlow`, used from Role Selection → onboarding-register)

This is the **primary onboarding path** for new users choosing Vendor or Affiliate from `RoleSelection`. 3-step wizard.

### Step 1 — Create Account
Fields: Full name, Email, Password (show/hide toggle). No zod; manual check: if any of `email/password/fullName` empty → toast `'Missing details'` / `'Please complete all fields.'` (destructive).
- `supabase.auth.signUp({ email, password, options: { data: { full_name, role }, emailRedirectTo }})` — same trigger side-effects as above (profile + user_roles + applications rows auto-created).
- Error → toast `'Signup failed'` / `error.message`.
- Success → store `userId`, toast `'Account created!' / 'Continue to verify your phone number.'`, advance to Step 2.

### Step 2 — Phone Number entry
Field: Phone (free text, placeholder `+255XXXXXXXXX or 0XXXXXXXXX`).
- On "Send OTP" click: `validateTZPhone(phone)` (see VALIDATION.md for exact rules).
  - Invalid → `setPhoneError(error)`, red border, toast `'Invalid phone'` / error message (destructive).
- If valid: `supabase.from('profiles').update({ phone: normalizedPhone, phone_verified: false }).eq('id', userId)`.
- Generates a **6-digit numeric OTP client-side**: `Math.floor(100000 + Math.random()*900000)`.
- Calls edge function `send-otp` with `{ phone: normalizedPhone, code: otpCode }` (note: this flow passes the code explicitly, unlike `PhoneVerificationFlow` which lets the server generate it).
- On function error or `!data.success` → throw; toast `'Error'` / message.
- On success: `resendCooldown = 60` seconds (countdown, disabling resend button), toast `'OTP sent'` / `We sent a 6-digit code to {maskedPhone}.` (mask: all digits except last 4 replaced with `*`). Advance to Step 3.

### Step 3 — Verify OTP
- 6-digit `InputOTP` component.
- **DEV/TEST MODE UI:** the generated OTP is displayed on-screen in a box labelled `TEST MODE: OTP is {generatedOtp}` (this exists in `RegistrationFlow` — a client-generated/known OTP, not the server-hashed flow).
- "Verify & Continue": if `otp.length < 6` → toast `'Enter the full code'` / `'Please enter all 6 digits.'`. If `otp !== generatedOtp` → toast `'Invalid code'` / `'The OTP entered is incorrect.'`.
- On match: `supabase.from('profiles').update({ phone_verified: true }).eq('id', userId)`.
- Then role-specific profile stub creation:
  - Vendor: `vendor_profiles` upsert `{ user_id, verification_status: 'pending' }` (onConflict user_id).
  - Affiliate: `affiliate_profiles` upsert `{ user_id }` (onConflict user_id).
- Toast `'Phone verified'` / `'Your account is now activated.'`.
- Calls `onComplete(userId, role)`.
- "Resend OTP" button disabled while `resendCooldown > 0` or `loading`; re-invokes `handleSendOtp`.

**Post-completion routing (in `Index.tsx`):**
- `fetchUserData()` is called.
- If `role === 'vendor'` → `view = 'vendor-profile-setup'`.
- Else (`affiliate`) → `view = 'affiliate-profile-setup'`; if there was a `postGrabProductId` pending (user tried "Grab Link" before login), it auto-generates the affiliate link for that product and clears the pending id.

---

## 3. Login — `LoginPage`

**Fields:** Email, Password (show/hide toggle).

**Validation (zod):**
```
email: z.string().email(t('errors.validation'))
password: z.string().min(6, t('errors.validation'))
```
i18n key `errors.validation` is a generic message (translated). Failure → toast (i18n `common.error` title) with that message.

**Submit:**
- `supabase.auth.signInWithPassword({ email, password })`.
- Error handling:
  - Message includes `'Invalid login credentials'` → toast title `common.error`, description `errors.validation`.
  - Message includes `'Email not confirmed'` → toast title `auth.verifyEmail`, description `auth.checkInbox`.
  - Else → toast title `common.error`, description `getUserFriendlyError(error.message)`.
- Success → toast title `common.success`, description `{dashboard.welcome}!`, `onNavigate('dashboard')` (which is remapped by `Index.tsx`'s post-login effect since `user`+`userRole` become truthy → `handlePostLogin()` → `fetchUserData()` decides real destination, see §8).

Links: "Forgot password?" → `forgot-password`; "Don't have an account? Sign up" → `role-selection` (NOT `signup` directly — user re-selects vendor/affiliate/browse); "Back" → `landing`.

---

## 4. Forgot Password — `ForgotPasswordPage`

**Field:** Email.
**Validation:** `z.object({ email: z.string().email('Please enter a valid email address') })`.
**Submit:**
- `getResetRedirectUrlAsync()` → `{canonicalAppUrl}/reset-password`.
- `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
- **Security:** Errors from Supabase are logged to console only; the UI **always** shows the same generic success regardless of whether the account exists (prevents email enumeration): `setEmailSent(true)`, toast `'Email Sent'` / `'If an account exists with that email, we sent a reset link.'`.
- Success screen shows: `If an account exists for **{email}**, we've sent a password reset link.` + `Please check your inbox and spam folder.` + "Send another email" button (resets `emailSent=false`).
- Generic catch-all exception → toast `'Error'` / `'An unexpected error occurred. Please try again.'`.

---

## 5. Reset Password — `ResetPasswordPage` (recovery-locked view)

**Entry:** Only reachable via Supabase recovery link (hash `type=recovery`) or path `/reset-password`. Session-check runs on mount (`supabase.auth.getSession()` + listens for `PASSWORD_RECOVERY` / `INITIAL_SESSION` auth events), with a **2.5s safety timeout** to stop the "Verifying Reset Link" spinner even if no auth event fires.

**States:**
1. `checkingSession=true` → spinner screen "Verifying Reset Link".
2. No session found after check → "Invalid or Expired Link" screen with "Request New Link" button → `forgot-password`.
3. Valid session → password form:
   - Fields: New Password, Confirm Password (both min 8 chars via HTML `minLength` and zod).
   - **Validation (zod):**
     ```
     password: z.string().min(8, 'Password must be at least 8 characters')
     confirmPassword: z.string()
     refine: password === confirmPassword, message "Passwords don't match", path confirmPassword
     ```
   - Submit → `supabase.auth.updateUser({ password })`.
     - Error → toast `'Error'` / `error.message` (raw Supabase message, not friendly-mapped here).
     - Success → `resetComplete=true`, toast `'Password Updated'` / `'Your password has been successfully reset. Please log in with your new password.'`.
       - After 3000ms: `onNavigate('login')` (releases recovery lock because `setView('login')` unlocks), wait 100ms, then `supabase.auth.signOut({ scope: 'global' })` to invalidate the recovery session everywhere.
4. Success screen (resetComplete) shown immediately with "Go to Sign In" button (manual bypass of the 3s auto-redirect).

**Phase-2 mobile deep link:** If a `resetToken` (from `access_token` hash param or `?token=`) is present, an "Open in Winger App" button is shown that navigates to `afrilink://reset-password?token=...` (custom scheme deep link; no-op if app not installed).

---

## 6. Phone OTP Verification (Post-Login Gate) — `PhoneVerificationFlow`

**Trigger:** In `fetchUserData()`, if `profile.phone_verified` is falsy, the view is forced to `phone-verification` **before any role-specific dashboard/profile-setup logic runs** — this is a hard gate for ALL logged-in users regardless of role.

**Step 1 — Phone entry:**
- `validateTZPhone(phone)`; invalid → inline red border + toast `'Invalid phone'` / validation error.
- Valid: `profiles.update({ phone: normalizedPhone, phone_verified: false })`.
- Calls edge function `send-otp` with `{ phone: normalizedPhone }` (server generates & sends code this time — no code passed by client, unlike RegistrationFlow).
  - Edge function (`supabase/functions/send-otp`) calls **Briq SMS API** with `sender_id: "Afrilink"` and `message_template: "Your Afrilink verification code is {code}. It expires in 10 minutes."` using `BRIQ_API_KEY` / `BRIQ_DEVELOPER_APP_ID` secrets.
  - On failure → throws `friendlyErrors.otpSend` = `"We couldn't send the verification code right now. Please try again in a moment."`.
- Success → toast `'OTP sent'` / `We sent a 6-digit code to {maskedPhone}.`; advance to Step 2. (No dev-mode OTP display in this flow — code isn't known client-side.)

**Step 2 — OTP entry:**
- 6-digit `InputOTP`.
- "Enter the full code" toast if length < 6.
- Verify: edge function `verify-otp` with `{ phone: normalizedPhone, code: otp }` — validated server-side against Briq / stored OTP record.
  - Failure → toast `'Verification failed'` / `friendlyErrors.otpInvalid` = `"The code is invalid or has expired. Please request a new one."`.
  - Success → `profiles.update({ phone_verified: true })`, toast `'Phone verified'` / `'Your account is now activated.'`, calls `onComplete()` → `fetchUserData()` re-runs and proceeds past the gate.
- "Resend OTP" always enabled (no cooldown timer in this component, unlike RegistrationFlow's 60s cooldown).
- Back button: since there's no vendor/affiliate context yet to go "back" to, it calls `handleLogout()` (full sign-out) — i.e., cannot skip verification, only exit entirely.

---

## 7. Role Selection — `RoleSelection`

Reached from: unauthenticated landing (after onboarding carousel or if onboarding already seen), and login page's "Sign up" link.

Three cards: **Vendor** (`Store` icon), **Affiliate** (`Users` icon), **Browse Marketplace** (`Compass` icon). All copy is i18n (`roleSelection.*`).

- Selecting `vendor` or `affiliate` → `setOnboardingRole(role)`, `setView('onboarding-register', role)` → begins §2 `RegistrationFlow`.
- Selecting `browse` → `setIsGuestBrowsing(true)`, navigate to `marketplace` view **without authentication** (guest browsing — see §9).
- "Already have an account? Log in" link → `login` view.
- "Back" (if provided) → `landing`.

---

## 8. Vendor Onboarding — `VendorProfileSetup`

**Trigger:** In `fetchUserData()` for `userRole === 'vendor'`, after the phone-verification gate passes, the app queries `vendor_profiles` for `(business_name, city, vendor_type, pickup_location, logo_url)`. Profile is considered **complete** only if **ALL FIVE** fields are truthy:
```
Boolean(business_name && city && vendor_type && pickup_location && logo_url)
```
If incomplete → forced to `vendor-profile-setup` view (cannot reach dashboard).

**Fields:**
- Business/Brand name (required, text)
- Vendor type: `individual` | `business` (select, default `individual`)
- City (select from a hardcoded list of ~120 Tanzanian cities/towns, alphabetically sorted, deduplicated) — **public**
- Pickup/Dispatch address (required, free text) — **private** (dispatch only, not shown publicly)
- Shop/Business location — **mandatory map picker** (`VendorLocationPicker`, produces `{ lat, lng, address }`)
- About Vendor (optional textarea)
- Profile image/logo (**mandatory** file upload)

**Image validation (client-side, on file select):**
- Max size 5MB → else toast `'File too large'` / `'Upload an image smaller than 5MB.'`, input cleared.
- HEIC/HEIF rejected by extension or MIME (`image/heic`, `image/heif`) → toast `'Unsupported format'` / `'HEIC images are not supported. Please convert to JPG or PNG first.'`.
- Allowed: `image/jpeg, image/jpg, image/png, image/webp, image/gif` (by MIME OR extension `jpg/jpeg/png/webp/gif`) — else toast `'Unsupported format'` / `'Please upload a JPG, PNG, WebP, or GIF image.'`.
- Old object-URL preview revoked before setting new preview (memory leak prevention).

**Submit validation (manual, on form submit):**
- If `!businessName || !city || !pickupLocation || !logoFile` → toast `'Missing details'` / `'Business name, city, pickup location, and profile image are required.'`.
- If `!vendorLocation` (map not set) → toast `'Missing location'` / `'Please set your shop location on the map.'`.

**Submit logic:**
1. Re-fetch authenticated user via `supabase.auth.getUser()`; if missing → throw `'Your login session expired. Please log out and sign in again.'`.
2. Upload logo to storage bucket `vendor-logos` at path `{userId}/logo.{ext}` with `upsert: true`; get public URL.
3. Upsert `vendor_profiles` (onConflict `user_id`) with all fields including `vendor_address/vendor_lat/vendor_lng` from the map picker and `verification_status: 'pending'`.
4. Toast `'Profile saved'` / `'Your vendor profile is now live.'`.
5. `onComplete()` → `Index.tsx` shows notification `'Vendor profile completed!'`, calls `fetchUserData()`, sets view `dashboard`.

**Failure:** any exception → toast `'Unable to save profile'` / `error.message || 'Please try again.'`.

---

## 9. Affiliate Onboarding — `AffiliateProfileSetup`

**Trigger:** For `userRole === 'affiliate'`, profile complete iff `Boolean(display_name && avatar_url)` on `affiliate_profiles`. Incomplete → forced `affiliate-profile-setup` view.

**Fields:** Display name (required), Bio (optional textarea), Profile image (required upload — same 5MB/HEIC/format validation rules as vendor logo, bucket `affiliate-avatars`, path `{userId}/avatar.{ext}`).

**Submit validation:** `!displayName || !avatarFile` → toast `'Missing details'` / `'Display name and profile image are required.'`.

**Submit logic:**
1. Upload avatar (upsert true) → public URL.
2. Upsert `affiliate_profiles` (onConflict default primary key/none specified — payload includes `user_id`, `display_name`, `bio` (null if empty), `avatar_url`).
3. Toast `'Profile saved'` / `'Your affiliate profile is ready to share.'`.
4. `onComplete()` → notification `'Affiliate profile completed!'`, `fetchUserData()`, view → `marketplace` (affiliates land on marketplace, not dashboard, right after onboarding).
   - If a `postGrabProductId` was queued (user clicked "Grab Link" pre-auth), `fetchUserData()` internally re-fetches marketplace products, auto-generates the link for that product, opens its `ProductModal`, clears the pending id, forces view to `marketplace`.

---

## 10. Guest Marketplace Browsing

- Entered via Role Selection "Browse Marketplace" card, or directly via `landing` → marketplace nav, or a shared `/p/:id` product link.
- No auth required. `MarketplaceNav` shows a "Login" button instead of user menu, and an optional Back button (`isGuestBrowsing` flag) that returns to `role-selection`.
- Product list = `marketplaceProducts` fetched via `products` table filtered `status = 'approved'` only (⚠ **note:** the general marketplace list fetch does NOT additionally filter `is_available = true` client-side in `fetchMarketplaceProducts()`/`fetchUserData()` — availability badges are informational; but the single-product fetch in `ProductPage.tsx` DOES filter `.eq('is_available', true)`, so out-of-stock products can appear in the grid but 404 on direct product-page visit if unavailable — see BUSINESS_RULES.md for the discrepancy.)
- Filtering/sorting: search text, category chips, commission-% filter, price-range filter — all pure client-side array filters (see BUSINESS_RULES.md for exact thresholds).
- Add to Cart works for guests (cart is `localStorage`-only, no server session).
- "Grab Link" (affiliate action) requires auth: if `!user`, sets `postGrabProductId`, navigates to `login`; after login+profile-complete, auto-resumes link generation (see §9).
- "Buy Now" on `ProductModal` in Index.tsx redirects to the **external checkout system** (`shop.afrilink.info`) — see §12b.

---

## 11. Product Detail Page — `/p/:productId` (`ProductPage.tsx`, React Router)

**Load:**
1. Reads `?ref=` query param.
   - If present → `setAffiliateCode(ref)`, `setHasAffiliateRef(true)`, and POSTs to `checkout-api/track-click` with `{ code: ref }` (fire-and-forget, uses service role server-side so it bypasses RLS on `affiliate_links`).
   - If absent → checks `localStorage.affiliateCode` (`hasAffiliateAttribution()`) to determine `hasAffiliateRef`.
2. Fetches the product by ID: `products` table filtered `id = productId AND status = 'approved' AND is_available = true`, single columns select. Not found/unavailable → "Product not found." screen.
3. Fetches vendor public info via RPC `get_vendor_public_info(p_user_id)` (SECURITY DEFINER — exposes only `city`, `verification_status`, no PII).

**Display:** image gallery (main + up to 3 thumbnails), title, description, price, "Earn {commission}% commission", trust badges (Secured by Winger / Delivery handled by vendor / Sold by Verified Vendor or Vendor / Ships from {city or 'Winger hub'} / Payment methods: Card, Mobile Money).

**Checkout gating — CRITICAL RULE:** `canCheckout = hasAffiliateRef || hasAffiliateAttribution()`. **Buy Now is disabled unless the visitor arrived via (or previously stored) an affiliate `ref` code.** Without one:
- Amber warning box: `'Checkout is available only via affiliate link. Ask a friend for their referral link!'`
- Disabled button labelled "Buy via Affiliate Link" (with `Link2` icon, `cursor-not-allowed`).

If `canCheckout`:
- "Buy Now" → if user tries without affiliate attribution somehow reached here it re-validates and toasts `'Checkout is available only via affiliate link'` (defensive double-check inside `handleBuyNow`).
- Adds product to cart (`vendorId` = product's vendor, no `slug` passed here — uses raw id) and opens `CheckoutModal` in **affiliate purchase mode**.

---

## 12a. Cart — `CartDrawer`

- Slide-in panel from the right, backdrop-blur overlay.
- Empty state: shopping-bag icon + `{t('cart.empty')}`.
- Per-item: image, title, price, quantity stepper (`-`/`+`, min 1 — decrementing to 0 removes item via `removeFromCart`), remove (trash) button.
- Footer: subtotal (`totalPrice` = Σ price×quantity across items), "Checkout" button → calls parent's `onCheckout` (opens `CheckoutModal`).
- Cart items keyed by product `id`; `addToCart` increments `quantity` if the id already exists (idempotent add), otherwise appends new item with `quantity: 1`.
- **Cart persistence:** `localStorage.cart` (JSON array of `CartItem`), rehydrated on mount; corrupted JSON → cart silently reset to `[]` and localStorage key removed. **Cart is NOT scoped per-user or per-session** — a single shared `localStorage` cart persists across logins/logouts on the same browser (see BUSINESS_RULES.md "cart session isolation").
- `affiliateCode` also lives in `localStorage.affiliateCode`, separate from the cart items; cleared together only via `clearCart()`.

---

## 12b. Checkout — Two Divergent Paths

### Path A: In-app `CheckoutModal` (used for the affiliate-attributed marketplace flow and `ProductPage` "Buy Now")

**Fields:** Full Name*, Phone*, Email (optional), Delivery Address*, City*, Country (optional).

**Validation on submit (manual, not zod):**
- Missing name/phone/address/city → toast `'Please fill in all required fields'`.
- `validateTZPhone(form.phone)` invalid → inline red border + toast with the specific phone error.

**Duplicate-order prevention:** A `checkoutSessionRef` (React ref) holds a `crypto.randomUUID()` generated once per checkout attempt and reused across retries within the same modal instance; this `checkout_session_id` is sent to the server. Server-side (`checkout-api POST /orders`) checks for an existing order with the same `checkout_session_id` and, if found, returns the existing order (`already_exists: true`) instead of creating a duplicate — **idempotent order creation**.

**Flow:**
1. `POST {SUPABASE_URL}/functions/v1/checkout-api/orders` with:
   ```json
   {
     products: [{ product_id, quantity }],
     buyer_name, buyer_email (or "{phone}@buyer.afrilink" placeholder if blank),
     buyer_phone (normalized +255...), buyer_city, buyer_address, buyer_country,
     delivery_type: "delivery",
     checkout_session_id,
     purchase_mode: "affiliate" | "marketplace",
     buyer_user_id (if logged in), buyer_role (userRole or "customer"),
     affiliate_code (ONLY when purchase_mode === "affiliate")
   }
   ```
2. Server validates products are `status='approved' AND is_available=true`; computes subtotal, delivery fee (see §12c), creates `orders` + `order_items` rows, returns `order_id`, `total_amount`, `delivery_fee`, `vendor_locations`.
3. `POST {SUPABASE_URL}/functions/v1/payments-api/create-payment` with `{ order_id, amount: total_amount, currency: 'TZS' }`.
4. If `paymentData.redirect_url` present → `clearCart()`, hard redirect `window.location.href = redirect_url` (Briq LIVE hosted payment page).
5. **STUB/DEMO fallback** (`VITE_DEMO_MODE === 'true'` or no redirect URL): shows an in-app "Order placed" receipt (order id, delivery fee if any, total) with a "Done" button; `clearCart()` immediately.
6. Any thrown error → `checkoutSessionRef.current = null` (allows retry with a fresh session id) + `toast.error(getUserFriendlyError(error))`.

### Path B: External Handoff to `shop.afrilink.info` (marketplace "Buy Now" from `Index.tsx` product modal, and general marketplace purchase without affiliate context)

- `handleBuyProduct()` in `Index.tsx` builds a URL via `buildCheckoutUrl(slug, { source: 'MARKETPLACE', vendorId })`:
  `https://shop.afrilink.info/p/{slugOrId}?source=MARKETPLACE&vendor={vendorId}`
  (adds `&ref={affiliateCode}` only if `affiliateCode` truthy and mode is affiliate; adds `&qty=` if quantity > 1).
- `window.location.href = redirectUrl` — full page navigation away from the SPA to the external checkout micro-site. The cart item is NOT automatically removed by this path (only single-item handoff via `performMarketplaceCheckoutHandoff` removes the handed-off item id from local cart when that helper is explicitly invoked elsewhere).
- Multi-item carts: external checkout is single-product; only the first cart item is handed off per `performMarketplaceCheckoutHandoff`, remaining items stay in the cart for a subsequent checkout.

---

## 12c. Delivery Fee Calculation (server-side, `checkout-api POST /orders`)

Only computed when `delivery_type === 'delivery'`. For each vendor in the order:
- Normalize buyer city and vendor city (trim + lowercase) for comparison.
- **Same city:** look up `delivery_zones` where `city ILIKE buyer_city AND is_active = true`, take `base_fee`; default `1500` TZS if no zone row found. Label: `"Local delivery (same city)"`.
- **Different city:** look up `cross_city_fees` where `(from_city ILIKE vendorCity AND to_city ILIKE buyerCity)`; if not found, check the **reverse direction** `(from_city ILIKE buyerCity AND to_city ILIKE vendorCity)`; default `5000` TZS if neither found. Label: `"Intercity delivery"`.
- The **final delivery fee for a multi-vendor order = the MAXIMUM fee among all vendors** (`maxFee`), not the sum — a single flat delivery fee is charged regardless of vendor count, so the buyer isn't charged multiple delivery fees when items are in one cart.
- `total_amount = subtotal (Σ product price × qty) + deliveryFee`.

---

## 13. Payment (Briq) & Order Confirmation Token Flow

### Payment creation (`payments-api POST /create-payment`)
- LIVE mode: calls Briq's `POST {BRIQ_BASE_URL}/api/v1/payments` to create a hosted payment session; returns `providerPaymentId` + `redirect_url`. Failure throws with the raw Briq error payload embedded.
- STUB mode: synthesizes a payment record without calling Briq (used in demo/dev).

### Payment confirmation (`payments-api POST /confirm-payment`, called from `CheckoutConfirmPage.tsx` after Briq redirects back)
- `CheckoutConfirmPage` reads `?payment_id=` and optional `?status=` (cancelled/failed) from the redirect URL.
- POSTs `{ payment_id }` to `confirm-payment`.
- **LIVE mode:** server calls Briq's status API to verify before applying the split. If Briq reports `PENDING`, the client **polls every 3 seconds up to 10 times** (`maxPolls = 10`), showing `Verifying payment with provider... (n/10)`.
- **STUB mode:** applies the split immediately (`applyPaymentSplit`) without external verification.
- **Idempotency:** if `payment.status === 'PAID'` already, returns `{ success: true, already_confirmed: true }` without re-applying the split (prevents double-crediting wallets on refresh/replay).
- On success: shows "Payment Successful!" with order id (first 8 chars), total paid; clears `localStorage.affiliateCode`; "Continue Shopping" → `/`.
- On failure/cancel: shows "Payment Cancelled" (if `status === 'CANCELLED'`) or "Payment Failed", with a **"Retry Verification"** button (re-runs `confirmPayment()`, resets poll counter) and "Back to Shop".

### Order confirmation token flow — `/confirm/:orderId?token=...` (`OrderConfirmationPage.tsx`)
- Purpose: post-delivery, buyer-facing confirmation link (sent via SMS/WhatsApp/email out of band), NOT requiring login — auth is via a **possession token** (`confirmation_token`, a UUID generated at order-creation time and stored on the `orders` row).
- Load: if no `token` param → shows "Invalid or expired confirmation link." Otherwise fetches `orders` row filtered `id = orderId AND confirmation_token = token`; no match → same invalid-link screen.
- Displays order items (joined against `products` for titles/vendor), total paid.
- **"Yes, I received my order"** button (disabled once `order.status === 'delivered_confirmed'`, shows message "This order has already been confirmed."):
  1. Computes `totalCommission = Σ item.commission_amount × item.quantity` from `order_items`.
  2. If order has an `affiliate_link_id` and `totalCommission > 0`: increments `affiliate_links.commission_earned`, credits the affiliate's `profiles.wallet_balance`, inserts a `transactions` row `{ type: 'commission', amount, description: 'Commission released for order #{id8}' }`.
  3. Computes vendor payout per vendor = `Σ (item.price×qty − item.commission_amount×qty)`, credits each vendor's `profiles.wallet_balance`, inserts a `transactions` row `{ type: 'sale', ... }` per vendor.
  4. Updates `orders.status = 'delivered_confirmed'`.
  - **Note:** this client-side wallet-crediting path exists in parallel with (and appears legacy/duplicate to) the server-side `applyPaymentSplit` ledger system in `payments-api`; the Flutter rebuild should treat the **ledger-based wallet system** (`wallets`/`ledger_entries` via `payments-api`) as canonical, since it is atomic (RPC `credit_wallet`) and idempotent, whereas this direct `profiles.wallet_balance` update is a race-condition-prone, non-atomic read-then-write.
- **"Report a problem"** button: sets `orders.status = 'delivery_issue'`, shows message `'Thanks for letting us know. Our support team will contact you shortly.'`.
- Errors from either action are shown inline (not toast): `error.message || 'Unable to confirm delivery at this time.'` / `'Unable to submit the issue right now.'`.

---

## 14. Vendor Product Lifecycle

### Create — `AddProductModal`
Fields: up to 5 images, Title*, Description, Price*, Commission % (default `10`), Category* (fixed list: Electronics, Fashion, Home & Garden, Beauty, Sports, Books, Toys, Food & Beverages, Health, Other).
- Image upload: bucket `product-images`, path `{userId}/{timestamp}-{random}.{ext}`; each file must be `image/*` MIME and ≤5MB (validated per-file; invalid files are skipped individually with their own toast, valid ones still upload).
- Submit validation: Title required (trimmed non-empty), Price required and `> 0`, Category required → toast `'Missing fields'` / `Please fill in: {joined missing labels}`.
- Commission normalization: `parseInt`; if `NaN` or `< 1` → defaults to `10`; capped at `Math.min(value, 50)` — **commission is clamped to the 1–50% range server never validates this again on client, so a malicious client could bypass, but the UI clamps.**
- Price is rounded to nearest integer (`Math.round`) before insert (no decimal TZS).
- Insert into `products` with `status: 'pending'` always (new products always require admin approval, regardless of vendor verification status).
- `image_url` = first image (or null); `image_urls` = full array (or null if empty).
- Session auto-refresh: if `getSession()` fails/empty, attempts `supabase.auth.refreshSession()` before failing with `'Session expired'` toast.
- Success → toast `'Product added!'` / `'Your product is pending review'`; closes modal; calls `onProductAdded` (refetch).
- DB error mapping: `42501` → `'Permission denied. Please ensure you are logged in as a vendor.'`; `23505` → `'A product with this title already exists.'`; else raw message.

### Edit — `EditProductModal`
Same fields/validation as Add, pre-populated from the existing `Product`. Key rule:
- **Editing a product whose current status is `approved` or `rejected` resets its status to `pending`** (forces re-review); editing a `pending`/`pending_takedown`/`taken_down` product keeps its current status unchanged.
- Toast after save: if status transitioned to pending from a non-pending state → `'Your changes were saved and will be reviewed again.'`; else → `'Your product changes have been saved.'`.
- Inline note shown in the form when product is `approved`/`rejected`: `'Note: Editing this product will resubmit it for admin review.'`

### Images gallery — `ProductImagesModal`
Read-only viewer with prev/next, thumbnail strip, per-image or "Download All" (sequential with 500ms delay between each to avoid browser throttling). Download strategy: draws the image to a canvas (`crossOrigin=anonymous`) to bypass CORS, converts to a `Blob`/`File`; uses `navigator.share()` with file attachment on mobile (Android WebView) if supported, else anchor-click download on desktop, else opens the raw image URL in a new tab as last resort.

### Availability toggle (Vendor Dashboard, only for `status === 'approved'` products)
- Switch/menu item "Mark as Sold Out" / "Mark as Available" → `products.update({ is_available: !current })`.
- Toast: `'Now Available'` / `'Your product is now visible to buyers.'` or `'Marked as Sold Out'` / `'Your product is marked as sold out.'`.
- Error → toast `'Error'` / `'Failed to update availability'`.

### Takedown request (only for `status === 'approved'`)
- Menu item "Request Takedown" opens a confirm `AlertDialog`: title "Request Product Takedown", body "This will submit a takedown request to the admin for approval. Your product will remain visible until the request is approved."
- Confirm → `products.update({ status: 'pending_takedown' })`; toast `'Takedown Requested'` / `'Your takedown request has been submitted for admin approval.'`; product stays visible in marketplace until an admin approves (moves to `taken_down`).
- Error → toast `'Error'` / `'Failed to submit takedown request'`.

### Status badges shown to vendor
`approved` → "Live" (green, pulsing dot style but static); `pending` → "In Review" (amber, pulsing dot); `pending_takedown` → "Takedown Pending" (orange); `taken_down` → "Taken Down" (muted, XCircle); `rejected` → "Rejected" (red, XCircle). Availability badge (only shown alongside `approved`): "In Stock" (primary) or "Sold Out" (muted).

---

## 15. Vendor Orders — `VendorOrders` (uses external `order-guardian` edge function, NOT direct Supabase table read)

- `GET {SUPABASE_URL}/functions/v1/order-guardian/orders` with `Authorization: Bearer {access_token}`.
- Response shape is defensively normalized: accepts a raw array, or `{ orders: [...] }`, or `{ data: [...] }`.
- Per-row fields tolerated via fallbacks: `order_id ?? id`, `customer_name ?? customer`, `total_amount ?? total ?? amount`, `created_at ?? date`.
- Status badge color heuristic (substring match, case-insensitive): contains `paid|complete|delivered` → emerald; contains `cancel|reject|fail` → red; contains `process|ship` → blue; else amber (default label "Pending").
- Manual refresh button (spinner icon) re-fetches with `isRefresh=true` (separate `refreshing` state so the whole list doesn't show a full loading skeleton).
- Error state: if fetch fails AND no orders were previously loaded, shows an amber inline alert with the error text; if orders exist alongside a soft error, the error is not blocking.
- Empty state: package icon + "No orders yet".

---

## 16. Wallet + Ledger (Vendor & Affiliate)

Two parallel wallet UI implementations exist in the codebase (both should be considered when rebuilding, but the ledger-based one is canonical/current):

### A. `WalletSection` + `LedgerHistory` + `NewWithdrawModal` (ledger-based, canonical)
- `GET payments-api/wallet?type=VENDOR|AFFILIATE` → `{ available_balance, pending_balance, currency }`.
- Realtime updates: subscribes to Postgres changes on `wallets` table filtered `owner_id=eq.{userId}` via Supabase Realtime channel `wallet-{walletType}-{userId}`; any change triggers a refetch.
- `MIN_WITHDRAWAL_TZS = 20000`. Withdraw button disabled (`opacity-60 cursor-not-allowed`) if `available_balance < 20000`, with helper text `Min. withdrawal: Tsh 20,000`.
- History toggle expands `LedgerHistory`: `GET payments-api/ledger?type=...` → list of `{ id, entry_type: 'CREDIT'|'DEBIT', amount, reason, created_at, metadata }`. Reason label map: `SALE_SPLIT → 'Sale Earnings'`, `PAYOUT_HOLD → 'Payout Pending'`, `PAYOUT_RELEASE → 'Payout Completed'`, `REFUND → 'Order Refund'`, `ADJUSTMENT → 'Balance Adjustment'` (falls back to raw reason string if unmapped). CREDIT rows shown green with `+`, DEBIT rows amber with `-`.
- `NewWithdrawModal`: method choice Mobile Money (field: phone) or Bank Transfer (fields: bank_name, account_number, account_name); amount must be `>= MIN_WITHDRAWAL_TZS AND <= balance`; POST to `payments-api/request-payout?type=...` with `{ amount, destination_type, destination_details }`; success toast `'Payout requested!'` / `"Your payout request is being processed. You will be notified when it's approved."`; **no withdrawal fee shown here** ("Processing Fee: Free").

### B. `VendorWalletExternal` + `ExternalWithdrawModal` (external `order-guardian`-backed, used specifically on the Vendor dashboard's external-wallet variant)
- `GET order-guardian/wallet` → tolerant shape `{ balance | available_balance, pending_balance, currency }`.
- Same `MIN_WITHDRAWAL_TZS = 20000` gate.
- **`ExternalWithdrawModal` DOES charge a flat fee: `WITHDRAWAL_FEE_TZS = 2000`.** Valid amount rule: `amount >= 20000 AND amount <= balance AND amount > 2000`. Net payout preview = `amount - 2000`. Summary box shows "Processing Fee: - Tsh 2,000" and "You'll receive: {net}".
- POST to `order-guardian/withdrawals` with `{ amount, destination_type, destination_details }`; success toast `'Withdrawal requested'` / `You will receive {net} after the Tsh 2,000 fee. Awaiting approval.`

### C. Legacy simple components — `WalletCard` + `WithdrawModal` (direct `withdrawals` table insert, no min/fee logic)
- `WithdrawModal` allows ANY amount `> 0` and `<= balance` (amounts stored in **cents-like integer** `Math.round(amount * 100)` — inconsistent with the TZS-integer convention used elsewhere; treat as a legacy/unused path, but document for completeness). Inserts directly into `withdrawals` table `{ user_id, amount, payment_method, payment_details }`; methods: Bank Transfer, Mobile Money, Debit Card (free-text detail field per method, no dynamic multi-field forms). No processing fee ("Processing Fee: Free").

**Rebuild guidance:** implement the ledger-based flow (A) as the primary wallet; decide whether to also support the 2000 TZS fee variant (B) if the target rebuild uses `order-guardian`, otherwise ignore legacy (C).

---

## 17. Affiliate Link Generation, Image Download & Share

**Generate Link (`handleGenerateLink` in `Index.tsx`):**
1. Locate product in `marketplaceProducts` (or `rawProducts` fallback).
2. If an `affiliate_links` row already exists for `(affiliate_id=user, product_id)` (checked from previously-fetched `affiliateLinks` state) → build link from the **existing** code, copy to clipboard, toast `'Affiliate link copied to clipboard!'` (no new row created — one link per affiliate per product).
3. Else generate a new code: `` `${userId.slice(0,6)}_${productId.slice(0,6)}_${Date.now().toString(36)}` `` and `INSERT` into `affiliate_links { affiliate_id, product_id, code }`.
4. Link format: `` `${appUrl}/p/${productId}?ref=${code}` `` (canonical app URL from `getAppUrlAsync()`).
5. `navigator.clipboard.writeText(link)`, toast `'Affiliate link generated and copied!'`.
6. Error → toast `'Error'` / `error.message || 'Failed to generate link'`.

**Grab Link (product card/modal CTA, `handleGrabLink`):**
- Not logged in → queue `postGrabProductId`, navigate to `login`.
- Logged in but `userRole !== 'affiliate'` → toast (error) `'Grab Link is available for affiliate accounts only.'` — vendors cannot generate affiliate links for their own or other products.
- Else → `handleGenerateLink(productId)`.

**Product Images Modal (affiliate use case, "View Images" on product thumbnail hover):** identical download/share mechanism as §14's vendor `ProductImagesModal` (shared component) — affiliates use this to download promotional images to share on social/WhatsApp.

**Conversion tracking:** clicks are tracked via `resolve_affiliate_link` RPC (on `?ref=` landing) or `checkout-api/track-click` (on `ProductPage` visit); conversions/commission are recorded when `applyPaymentSplit` runs after payment confirmation (increments `affiliate_links.conversions` and `commission_earned`).

---

## 18. Notifications

- In-app notification bell (`NotificationDropdown`, in `DashboardNav`) reads from a `notifications` table, filtered to the current user.
- Server-inserted notification triggers (from `payments-api applyPaymentSplit`):
  - Per vendor on a paid order: title `🛒 New Paid Order`, message `Order #{ref8} is paid. TZS {amount} has been added to your wallet.`, `type: 'success'`, `link: '/dashboard'`.
  - Affiliate (if commission > 0): title `💰 Commission Earned`, message `Order #{ref8} is paid. TZS {amount} commission has been added to your wallet.`, same type/link.
- Ephemeral toast notification component (`Notification.tsx`) is also used for one-off messages like "Logged out successfully", "Vendor profile completed!", "Verification submitted! Awaiting admin approval." — auto-dismissible, distinct from the persistent bell notifications.
- Push notifications: `usePushNotifications` hook (Settings page toggle) — browser push subscription; if permission is `denied`, toggling on shows toast error `'Push notifications are blocked. Please enable them in your browser settings.'`; success → `'Push notifications enabled!'` / `'Push notifications disabled'`.

---

## 19. Settings — Profile Image Change, Role Switching, Language

### Settings Page (`SettingsPage`) — 4 tabs: Profile, Notifications, Appearance, Security
**Profile tab:**
- Editable: Full Name, Phone Number; Email shown but disabled (cannot change email here).
- Profile image (only if `userRole` is vendor or affiliate): file picker (`image/png,image/jpeg,image/webp` accept attribute — narrower than onboarding's accept list, no explicit gif here); client validation: HEIC/HEIF extension check → toast error `'HEIC/HEIF images are not supported. Please use JPG or PNG.'`; size > 5MB → `'Image must be 5MB or smaller.'`. New image is only staged as a preview; actual upload happens on "Save Changes".
- Vendor-only: embedded `VendorLocationPicker` to update `vendor_lat/vendor_lng/vendor_address` (loaded from `vendor_profiles` on mount).
- Save flow: uploads image to `vendor-logos` or `affiliate-avatars` bucket at fixed path `{userId}/logo.{ext}` or `{userId}/avatar.{ext}` (upsert), appends a cache-busting `?v={timestamp}` query to the returned public URL so the UI updates immediately; updates `profiles.full_name/phone`; upserts image url into `vendor_profiles.logo_url` or `affiliate_profiles.avatar_url`; upserts vendor location if changed. Success → toast `'Profile updated successfully!'`; error → `getUserFriendlyError(error)`.

**Notifications tab:** toggles for email notifications, marketing emails, order updates, promotional alerts (local component state only — no evidence of these being persisted to a backend table in the excerpted code, treat as UI-only preferences unless a hidden persistence call exists beyond the viewed portion) + push-notification toggle wired to `usePushNotifications`.

**Appearance tab:** theme toggle (light/dark via `next-themes`) — likely also a language selector given `languages`/`i18n` imports; `handleLanguageChange(langCode)` calls `i18n.changeLanguage(langCode)` and toasts `t('settings.profile.saved')` (immediate, no save button needed for language).

**Security tab:** (not fully excerpted — expected to include password change / session management given standard patterns; verify against full file before Flutter port.)

### Role Switching (`DashboardNav` → `handleSwitchRole`/`handleAddRole` in `Index.tsx`, backed by `useAuth`)
- `switchRole(newRole)`: only allowed if `availableRoles.includes(newRole)` (roles already granted to the user, from `user_roles` table); purely a client-side state change (`setUserRole`, cached in `localStorage.afrilink_active_role_{userId}`) — no server call. Success → toast `Switched to {role} mode`, then `fetchUserData()` reloads role-specific dashboard data (which itself re-checks phone verification and profile-completeness gates for the new role).
- `addRole(newRole)`: if the user doesn't yet have this role, `INSERT INTO user_roles (user_id, role)`; then refreshes roles and switches to it. Success → toast `{role} role added! Complete your profile setup.` → `fetchUserData()` will detect the new role's profile is incomplete and route to the appropriate `*-profile-setup` view.
- Failure (either) → toast `'Failed to switch role'` / `'Failed to add role'`.
- While switching, `isRoleSwitching=true` shows the global full-screen spinner (same as initial auth loading).

---

## 20. Logout

`handleLogout()` in `Index.tsx`: `signOut()` (Supabase auth sign-out, clears `user/session/userRole/availableRoles` in `useAuth`), `clearCart()` (empties cart AND affiliate code from localStorage), `setView('landing')`, resets `profile/products/marketplaceProducts/roleAvatarUrl` to empty, shows notification `'Logged out successfully'`.

---

## 21. Language Switching

Handled via `react-i18next` (`src/i18n/config` exports `languages`/`LanguageCode`). Changing language in Settings → Appearance calls `i18n.changeLanguage(code)` immediately (no page reload) and persists via i18next's own language-detector storage (typically localStorage) — UI strings throughout Login/RoleSelection/MarketplaceNav/CartDrawer use `t('...')` keys, so a Flutter rebuild needs a matching ARB/localization catalog covering at least: `common.*`, `auth.*`, `dashboard.*`, `roleSelection.*`, `marketplace.*`, `cart.*`, `product.*`, `errors.validation`, `settings.profile.saved`.

---

## 22. PWA Install Prompt

`InstallPrompt` component rendered on the `dashboard` view (mounted after successful login) — listens for the browser's `beforeinstallprompt` event and shows a custom install banner/button; deferred prompt is triggered on user tap. (Component internals not fully excerpted; behavior is standard PWA install-prompt capture pattern — verify exact copy/dismiss-persistence logic against `src/components/mobile/InstallPrompt.tsx` before final Flutter parity pass, though Flutter apps are native and won't need this exact mechanism — install prompts are N/A for a compiled Flutter app and should be omitted or replaced with app-store-appropriate flows.)

---

## 23. Pull-to-Refresh

`PullToRefresh` wraps the Dashboard and Marketplace scroll containers:
- Dashboard: `onRefresh={handleRefresh}` → `fetchUserData()`.
- Marketplace: `onRefresh={handleMarketplaceRefresh}` → `fetchMarketplaceProducts()`.
- Disabled while `dataLoading` is true (prevents overlapping fetches). In Flutter, use `RefreshIndicator` wrapping the equivalent scrollable list, calling the same data-refetch functions.

