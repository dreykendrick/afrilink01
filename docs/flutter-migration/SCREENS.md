# Winger — Screens & Views Inventory (Parts 2 & 3)

Two navigation layers exist: **React Router routes** (real URLs) and the **`view` state machine** inside `Index.tsx` (query-param `?view=`). Every entry below is a distinct "screen" for Flutter-rebuild purposes.

---
## A. React Router Routes

### 1. `/` — App Shell (delegates to `view` state, default `landing`)
- **Purpose**: Root of the SPA; renders whichever `view` is active.
- **Auth**: N/A (delegates)
- **Entry points**: direct nav, all internal `setView()` calls, browser back/forward.
- See section B for the exhaustive list of views rendered here.

### 2. `/reset-password`
- Same `<Index/>` component. On mount, `Index` detects `pathname === '/reset-password'` (or hash `type=recovery` from Supabase) and force-locks `view` to `'reset-password'`. Used as the Supabase password-recovery email redirect target and as the deep-link target (see NAVIGATION.md).

### 3. `/p/:productId` — `ProductPage`
- **Purpose**: Standalone, shareable single-product landing page (used as the target of affiliate share links, e.g. `/p/{id}?ref=CODE`).
- **User type**: Guest or logged-in buyer.
- **Auth**: None required to view; **Buy Now** requires affiliate attribution (either `?ref=` query param on this URL, or a previously stored `localStorage.affiliateCode`).
- **Entry points**: shared affiliate link, direct URL, marketplace product link.
- **Exit points**: Back button (`navigate(-1)`), Buy Now → opens `CheckoutModal`, "Buy via Affiliate Link" disabled CTA if no attribution.
- **Data**: fetches single product by id (`status=approved`, `is_available=true`) and vendor public info via RPC `get_vendor_public_info`.
- **Layout hierarchy**: full-page → back link ("← Back") → 2-col grid (image gallery left; details right: category, title, description, price + commission badge, trust bullets, Buy button) → `CheckoutModal` overlay.
- **States**:
  - Loading: centered text "Loading product..."
  - Not found: centered text "Product not found."
  - Has attribution: primary button **"Buy Now"**.
  - No attribution: amber warning box "Checkout is available only via affiliate link. Ask a friend for their referral link!" + disabled button **"Buy via Affiliate Link"** (with link icon).
- **Copy/labels**: "Back", "Secured by Winger", "Delivery handled by vendor — fee calculated at checkout", "Sold by: Verified Vendor / Vendor", "Ships from: {city or 'Winger hub'}", "Payment methods: Card, Mobile Money", toast on success "Order placed successfully!", toast error "Checkout is available only via affiliate link".

### 4. `/confirm/:orderId` — `OrderConfirmationPage`
- **Purpose**: Post-delivery confirmation page sent to buyers via email/SMS link containing a `confirmation_token`.
- **Auth**: None (secured via `?token=` matching `orders.confirmation_token`).
- **Entry points**: external link only (email/SMS).
- **Exit points**: none (terminal page); two action buttons update order status in place.
- **Data**: order, `order_items`, joined product titles; on confirm, distributes commission to affiliate wallet + payout to vendor wallet + inserts `transactions` rows; on report, sets order status to `delivery_issue`.
- **Layout**: centered card — heading "Confirm delivery", "Order ID: {id}", itemized list (title × qty — line total), totals block (Total items, Total paid), optional message banner, 2-button grid.
- **States/copy**:
  - Loading: spinner only.
  - Invalid/expired: "Invalid or expired confirmation link." (alert icon)
  - Buttons: **"Yes, I received my order"** (disabled label while loading: "Processing...") and **"Report a problem"**.
  - Already confirmed message: "This order has already been confirmed."
  - Success message: "Thanks for confirming! Your delivery has been marked complete."
  - Report success message: "Thanks for letting us know. Our support team will contact you shortly."
  - Failure messages fall back to raw error or "Unable to confirm delivery at this time." / "Unable to submit the issue right now."

### 5. `/checkout/confirm` — `CheckoutConfirmPage`
- **Purpose**: Return/redirect landing page from the Briq payment gateway after a mobile-money/card payment attempt.
- **Auth**: None.
- **Query params**: `payment_id` (required), `status` (optional — `cancelled`/`failed` set by Briq redirect).
- **Entry points**: gateway redirect only.
- **Behavior**: POSTs to `payments-api/confirm-payment`; if server returns `status: 'PENDING'`, polls every 3s up to 10 times ("Verifying payment with provider... (n/10)"); on success fetches `payments`→`orders` to show a receipt; clears `localStorage.affiliateCode` on success.
- **States/copy**:
  - Loading: spinner + "Confirming your payment..." or polling text above.
  - Success: green check icon, "Payment Successful!", "Thank you for your purchase, {customer_name || 'valued customer'}!", receipt card (Order ID short hash, Total Paid), note "You will receive an SMS/WhatsApp with delivery updates.", button **"Continue Shopping"** (icon+text) → `navigate('/')`.
  - Failure/cancelled: red X icon, heading **"Payment Cancelled"** (if `status===CANCELLED`) else **"Payment Failed"**, error text (server error or "Something went wrong with your payment."), reassurance box "Don't worry — your order has not been charged. Please try again or contact support.", buttons **"Retry Verification"** (spinning icon while retrying) and **"Back to Shop"** → `navigate('/')`.

### 6. `*` — `NotFound`
- **Purpose**: 404 catch-all.
- **Auth**: None.
- **Copy**: "404", "Oops! Page not found", link "Return to Home" → `/`.
- Logs `console.error("404 Error: User attempted to access non-existent route:", pathname)`.

---
## B. `view` State-Machine Screens (all rendered under `/` and `/reset-password`)

For every view: purpose, user type, entry points, exit points, auth requirement, and key UI. Global overlays available on most views: `<Notification>` banner and toast systems (sonner + shadcn Toaster).

### B1. `landing`
- **Default/initial view.** Guest marketing homepage.
- **Auth**: none.
- **Entry**: default URL, logout (`handleLogout` → `setView('landing')`).
- **Layout**: Nav bar (logo + app name "Winger", Sign In button — desktop text button / mobile icon-only user button) → Hero (title/subtitle from i18n `landing.hero.title/subtitle`, 3 CTA buttons: **ctaVendor** (Package icon), **ctaAffiliate** (TrendingUp icon), **ctaBrowse** (ShoppingCart icon)) → 3 feature cards (Automated Splits / Smart Tracking / Mobile Money) → live marketplace product grid (title `marketplace.title`) sourced from `marketplaceProducts`.
- **Exit points**: Sign In → `login`; Vendor/Affiliate CTA → `role-selection` (`onNavigate` maps both CTAs to `role-selection` per `handleNavigate`); Browse CTA → `marketplace`.
- **Data**: fetched marketplace products (approved only) via `fetchMarketplaceProducts()` on mount when `view==='landing'`.

### B2. `onboarding`
- **OnboardingCarousel** — 4-slide horizontally-swipeable intro (only reachable if code paths route here — in current build, `role-selection` is the main entry from landing, but `onboarding` view exists and sets `localStorage.afrilink_onboarding_seen`).
- Slides (headline/subtext/icon): "Welcome to Winger" (Globe) / "Sell without chasing customers" (Store) / "Promote. Share. Earn." (Megaphone) / "No barriers. Just opportunity." (Sparkles).
- **Controls**: top-right **"Skip"** button (jumps to last slide then completes after 300ms); dot indicators (tap to jump); last slide shows **"Get Started"** button.
- **Exit**: `onComplete` → sets `role-selection`.

### B3. `role-selection`
- **RoleSelection** component. Title/subtitle from i18n (`roleSelection.title/subtitle`).
- **Back button** (if `onBack` provided) → `landing`.
- **3 selectable cards** (icon, title, description from i18n): **Vendor** (Store icon), **Affiliate** (Users icon), **Browse** (Compass icon).
  - Vendor/Affiliate → sets `onboardingRole` and `view='onboarding-register'` (role passed into URL).
  - Browse → sets `isGuestBrowsing=true`, navigates to `marketplace` (no signup).
- Footer: "{auth.hasAccount} **{auth.login}**" link → `login`.

### B4. `onboarding-register`
- **RegistrationFlow** (role-specific signup form; guarded — if `onboardingRole` missing, redirects back to `role-selection`).
- **Back** → `role-selection`.
- **onComplete(userId, role)**: refreshes user data; vendor → `vendor-profile-setup`; affiliate → `affiliate-profile-setup` (also auto-generates a pending affiliate link + selects a product if the user arrived via "Grab Link" while a guest, tracked in `postGrabProductId`).

### B5. `vendor-profile-setup`
- **VendorProfileSetup** — requires `user` (else redirect to `login`).
- Collects: business name, city, vendor type, **pickup location** (via `VendorLocationPicker`, Leaflet/OSM map + address search/geolocate/drag marker), logo upload.
- **Completion check** (used elsewhere too): `business_name && city && vendor_type && pickup_location && logo_url` all present.
- **onComplete** → toast "Vendor profile completed!", refresh data, `view='dashboard'`.
- **Back** → `role-selection`.

### B6. `affiliate-profile-setup`
- **AffiliateProfileSetup** — requires `user`.
- Form fields: Display name (required), Bio (optional textarea), Profile image (required file upload; validates size ≤5MB, rejects HEIC, accepts jpg/png/webp/gif).
- Card title "Set up your affiliate profile", description "Your profile helps vendors trust and collaborate with you."
- Submit button: **"Save Affiliate Profile"** (loading label "Saving...").
- **onComplete** → toast "Affiliate profile completed!", refresh data, `view='marketplace'` (not dashboard).
- **Back** → `role-selection`.

### B7. `phone-verification`
- **PhoneVerificationFlow** — requires `user`; else redirect to `login`.
- 2-step wizard, header shows "Step {1|2} of 2".
- Step 1 "Verify your phone number": phone input (placeholder `+255XXXXXXXXX or 0XXXXXXXXX`), validated via `validateTZPhone`; button **"Send OTP"** (loading: "Sending OTP...") → calls `send-otp` edge function; toast "OTP sent" / "We sent a 6-digit code to {maskedPhone}."
- Step 2 "Confirm OTP": 6-digit OTP input (`InputOTP`); toast "Enter the full code" if incomplete; on submit calls `verify-otp` edge function, sets `profiles.phone_verified=true`.
- **Back** → calls `onBack` which triggers `handleLogout()` (i.e., backing out of mandatory phone verification signs the user out).
- **onComplete** → toast "Phone verification complete!", refresh data (this view is auto-entered by `fetchUserData()` whenever `profile.phone_verified` is falsy, functioning as a mandatory gate before dashboard/marketplace access for authenticated users).

### B8. `login`
- **LoginPage**. Heading `dashboard.welcome` (i18n). Fields: email (placeholder `you@example.com`), password (placeholder `••••••••`). Submit button (i18n labelled).
- Errors: toast titled `common.error` for invalid credentials; special toast titled `auth.verifyEmail` if email unconfirmed.
- Success: toast titled `common.success`.
- **onNavigate** callback lets LoginPage route to signup/forgot-password/etc.

### B9. `signup`
- **SignupPage**. Back button → `landing`. Card title "Create Account". Fields: full name (`John Doe`), email (`you@example.com`), password (`••••••••`). Submit button ("Create Account" style, disabled while loading).
- Toasts: "Validation Error", "Account Exists", "Signup Failed", success "Account Created!".
- **onSignupSuccess(userId)** → sets `pendingUserId`, `view='verification'`.

### B10. `forgot-password`
- **ForgotPasswordPage**. Heading "Reset Password". Email field. Submit button; success toast "Email Sent"; error toast "Error".

### B11. `reset-password`
- **ResetPasswordPage** — reached either via URL/hash detection (recovery-locked) or manual nav.
- States: "Verifying Reset Link" (loading), "Invalid or Expired Link" (error, button to go back), "Password Reset Complete" (success, button to continue), and the main form "New Password" (new password + confirm password fields, submit button). Toasts: "Validation Error", "Error", success "Password Updated".
- Completing the reset unlocks the `recoveryLocked` ref only when the app transitions to `'login'`.

### B12. `verification`
- **VerificationForm** — requires `pendingUserId` or logged-in `user` (else redirect `login`).
- Card title "Account Verification". Phone field (placeholder `+1 (555) 123-4567`) + **"Verify Phone"**-style button; photo ID upload input (≤5MB) + **submit** button.
- Toasts: "Please enter a phone number", "Phone number verified successfully!", "File size must be less than 5MB", "Please select a photo", "Authentication Required", "Photo uploaded successfully!", "Incomplete Verification", "Verification Submitted!".
- **onComplete**: if `user` present → toast "Verification submitted! Awaiting admin approval.", `view='dashboard'`; else → toast "Verification submitted! Please log in. An admin will review your documents.", `view='login'`.

### B13. `dashboard` (requires `currentUser`)
- **Layout**: `DashboardNav` (top bar) + `PullToRefresh` wrapper + role-specific dashboard body + `MobileBottomNav` (mobile only) + `InstallPrompt`.
- Loading state inside body: centered spinner while `dataLoading`.
- **Vendor role** → `VendorDashboard`:
  - Heading "Welcome back, {name}!"
  - 4 `StatsCard`s: Total Revenue (currency), Total Sales (count), Active Products (count), Products Under Review (count, subtext "Usually takes up to 24 hours").
  - "Your Products" section header + **add-product button** opening `AddProductModal`.
  - Product list rows with actions: edit (opens `EditProductModal`), toggle availability, "take down" (opens `AlertDialog` confirmation with Cancel / confirm actions).
- **Affiliate role** → `AffiliateDashboard`:
  - Heading "Welcome back, {name}!"
  - 4 `StatsCard`s: Total Commission, Total Clicks, Conversions, Conversion Rate (%).
  - "Products to Promote" grid; per-product **"Grab Link"** action (`onGenerateLink`) and click-through to `ProductImagesModal`.
- **Data loading**: `fetchUserData()` triggers profile/vendor-profile/affiliate-profile completeness checks (may redirect to `vendor-profile-setup`/`affiliate-profile-setup`/`phone-verification` before landing here).

### B14. `marketplace` (requires no auth — guest-accessible)
- **MarketplaceNav**: optional Back button (only shown if `isGuestBrowsing`, returns to `role-selection` and clears the guest flag), app name/logo, desktop search bar (`marketplace.search` placeholder), mobile search bar (below header), Filter button (toggles filter panel, highlighted + green dot when filters active), Cart button (badge = item count) → opens `CartDrawer`; category chip row (horizontally scrollable, `categories` incl. "All"); Login icon/button for guests.
- **Filter panel** (collapsible): Commission select (All / 5%+ / 10%+ / 15%+ / 20%+) and Price Range select (All / Under 50,000 Tsh / 50,000–100,000 Tsh / 100,000–500,000 Tsh / 500,000+ Tsh); "Clear" link (`common.cancel` label) appears when filters active.
- **Product grid**: 2 cols mobile → up to 4 cols desktop; `ProductCard` per product (image, category badge, commission % badge, title, price, "{n} sold", "Earn {amount}" green text, **"Add to Cart"/"Cart"** button); clicking a card opens `ProductModal`.
- **Empty state**: "No products found" centered text.
- **ProductModal** (overlay, bottom-sheet on mobile / centered dialog on desktop): image, title, description, price, commission %, "Earn {x} per sale"; buttons **"Grab Link"**, **"Buy Now"**, **"Close"**.
- **CartDrawer** (right slide-in panel): header "{cart.title} ({count})" + close (X); empty state icon + `cart.empty` text; else list of line items (image, title, price, qty stepper +/-, remove/trash button) and (implicitly) a checkout CTA/footer with totals (not shown in truncated excerpt but wired via `onCheckout` prop).
- **MobileBottomNav** shown here too (active tab = "marketplace").
- Marketplace refresh via `PullToRefresh` → `fetchMarketplaceProducts()`.

### B15. `settings` (requires `currentUser`)
- **SettingsPage**. Back button, heading "Settings".
- Sections (Cards): Profile (avatar upload + change button, Full Name, Email — read-only likely, Phone Number), a highlighted verification-status mini card, Save button; Notifications (toggles: Email Notifications, Push Notifications, Order Updates, Marketing Emails, Promotional Alerts); Appearance (Theme control, Language `Select`); Privacy & Data (Export Data button, unspecified second action, Danger Zone → destructive "Delete Account" button).
- **onBack** → `dashboard`.

### B16. `verification-manage` (requires `currentUser`)
- **VerificationManagePage** — shows current verification status (`VerificationStatusCard`) and lets user manage/resubmit documents. **onBack** → `dashboard`. Also the mobile bottom-nav "profile" tab target.

### B17. `help-support` (requires `currentUser`)
- **HelpSupportPage**. Heading "Help & Support". Contact tiles: WhatsApp (`https://wa.me/255759340243`), Email (`mailto:support@afrilink.com`), Phone (`tel:+255759340243`). FAQ `Accordion` (e.g., Q: "To become a verified vendor..." with detailed answer about verification steps and 24–48h review time). **onBack** → `dashboard`.

### B18. `orders` (requires `currentUser`, vendor-oriented)
- Rendered with `DashboardNav` + a **"← Back to Dashboard"** text link (→ `dashboard`) + `VendorOrders` component.
- `VendorOrders`: heading "Recent Orders"; order rows with status `Badge` (color-coded: emerald=delivered/completed-like, red=failed/cancelled-like, blue=in-progress-like, amber=pending/default) — statuses sourced from the **Order Guardian** backend (`/functions/v1/order-guardian/orders`).

---
## C. Shared / Cross-View Components (Modals, Drawers, Global Overlays)

| Component | Trigger | Purpose |
|---|---|---|
| `CheckoutModal` | ProductPage "Buy Now"; marketplace `onCheckout` | Buyer detail form (name, email, phone, delivery address/city/country) → calls `checkout-api/orders` then `payments-api/create-payment`; validates TZ phone; demo mode flag `VITE_DEMO_MODE`; shows a receipt state (`ReceiptDetails`: orderId, totalAmount, deliveryFee, confirmationLink) |
| `AddProductModal` | VendorDashboard "add product" | Multi-image upload (max 5, drag-in via hidden file input), title/description/price/commission (1–50%, default 10)/category select; on submit inserts `products` row with `status:'pending'`; toast "Product added!" |
| `EditProductModal` | VendorDashboard product row "edit" | Edit existing product fields (mirrors AddProductModal) |
| `ProductImagesModal` | AffiliateDashboard product click | View product image gallery |
| `NewWithdrawModal` | DashboardNav wallet "Withdraw" button (visible when balance ≥ 20,000 TZS) | Withdrawal request flow |
| `ExternalWithdrawModal` / `VendorWalletExternal` | Vendor wallet actions | Calls Order Guardian `/withdrawals` and `/wallet` endpoints |
| `WithdrawModal` / `WalletCard` / `WalletSection` | Various wallet surfaces | Balance display + withdraw entry points |
| `LedgerHistory` | DashboardNav "Transaction History" toggle | Scrollable list of past transactions per wallet type (VENDOR/AFFILIATE) |
| `NotificationDropdown` | DashboardNav bell icon | In-app notifications list |
| `VerificationStatusCard` | VerificationManagePage | Status pill + step indicators |
| `Notification` | Global (`notification` state) | Lightweight toast/banner shown across many views (e.g., "Logged out successfully") |
| `InstallPrompt` | Dashboard/marketplace views, PWA-installable browsers | Bottom snackbar "Install Winger" / "Add to home screen for quick access" with Install/dismiss; iOS gets a full-screen 2-step manual guide ("1. Tap the Share button", "2. Add to Home Screen") since iOS Safari lacks the native install prompt API; dismissal persisted 7 days (`localStorage.afrilink_install_dismissed`) |
| `PullToRefresh` | Wraps dashboard & marketplace content | Custom touch-based pull-to-refresh (threshold 80px, max pull 120px, spinner rotates with pull progress) |
| `SwipeableCard` | Mobile list/card interactions | Swipe gesture wrapper (not detailed further) |

## D. Loading / Empty / Error / Success Copy Reference (verbatim strings found)

- "Loading product...", "Product not found." (ProductPage)
- "No products found" (Marketplace)
- "Confirming your payment...", "Verifying payment with provider... (n/10)", "Payment Successful!", "Payment Cancelled", "Payment Failed", "Don't worry — your order has not been charged. Please try again or contact support." (CheckoutConfirmPage)
- "Invalid or expired confirmation link.", "This order has already been confirmed.", "Thanks for confirming! Your delivery has been marked complete.", "Thanks for letting us know. Our support team will contact you shortly." (OrderConfirmationPage)
- "404" / "Oops! Page not found" / "Return to Home" (NotFound)
- "Checkout is available only via affiliate link" (toast, ProductPage/CartDrawer context)
- "Session expired" / "Please log in again to add products" (AddProductModal)
- "Product added!" / "Your product is pending review" (AddProductModal)
