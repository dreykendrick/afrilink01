# Winger — Navigation Map (Flutter Migration Reference)

This document is the exhaustive navigation companion to `SCREENS.md`. It covers: the full ASCII navigation tree, every React Router route, every `view` state value and every transition in/out of it, nested navigation (dashboard/marketplace sub-views), mobile bottom-nav tabs, the `DashboardNav` profile dropdown contents, drawers/modals/bottom sheets, back-navigation rules, auth guards & redirects, onboarding-completion redirects, deep links, and URL/query-param persistence behavior.

---
## 1. Two Coexisting Navigation Systems

1. **React Router** (`src/App.tsx`) — real URL routes, used only for a handful of standalone pages that must be directly linkable (product page, order confirmation, payment return, 404, password-reset redirect target).
2. **`view` state machine** (`src/pages/Index.tsx`) — a single React component (`IndexContent`) that renders one of 18 possible "views" based on in-memory state, persisted into the URL as `?view=<name>&role=<vendor|affiliate>` on the `/` (and `/reset-password`) route. This is the primary in-app navigation system (no client-side router is used inside `/`; it's a manual state machine + `window.history.replaceState`).

Both systems are active simultaneously: React Router decides which **page component** mounts for a given `pathname`; if that page is `<Index/>`, the `view` state machine decides what renders inside it.

---
## 2. React Router Route Table (`src/App.tsx`)

| Order | Path | Element | Notes |
|---|---|---|---|
| 1 | `/` | `<Index/>` | App shell; renders active `view`. Default view `landing`. |
| 2 | `/reset-password` | `<Index/>` | Same component; forces `view` to lock at `reset-password` (see §7). Target of Supabase password-recovery email links and the `afrilink://reset-password` deep link. |
| 3 | `/p/:productId` | `<ProductPage/>` | Standalone shareable product page. `:productId` is a UUID (the code treats it as `product.id`, not a slug, despite the folder-style `/p/` prefix — the external checkout system at `shop.afrilink.info/p/:slug` is a *different* app; this in-app route only matches DB id). Query: `?ref=<affiliateCode>`. |
| 4 | `/confirm/:orderId` | `<OrderConfirmationPage/>` | Buyer delivery-confirmation page from email/SMS link. Query: `?token=<confirmation_token>` (required — no token ⇒ "Invalid or expired confirmation link."). |
| 5 | `/checkout/confirm` | `<CheckoutConfirmPage/>` | Payment-gateway (Briq) return URL. Query: `?payment_id=`, `?status=` (`cancelled`/`failed`). |
| 6 | `*` | `<NotFound/>` | Catch-all 404. Must remain last in the route list (comment enforces this: "ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL"). |

Providers wrapping the router (outside-in): `QueryClientProvider` → `ThemeProvider` (`attribute="class"`, `defaultTheme="dark"`, `enableSystem`) → `AuthProvider` → `CartProvider` → `TooltipProvider` → `Toaster` + `Sonner` (both toast systems mounted globally) → `BrowserRouter` → `Routes`.

None of routes 3–6 render `DashboardNav`/`MarketplaceNav`/`MobileBottomNav` — they are fully standalone pages with their own back buttons (`navigate(-1)` on ProductPage; `navigate('/')` buttons on CheckoutConfirmPage; no navigation at all on OrderConfirmationPage/NotFound besides a "Return to Home" link on NotFound).

---
## 3. Full ASCII Navigation Tree

```
App (BrowserRouter)
│
├── "/"  and  "/reset-password"  → <Index/>  (view state machine)
│    │
│    ├── [view=landing]  (default, guest)
│    │     ├─ Sign In → [view=login]
│    │     ├─ CTA "Become a Vendor" → [view=role-selection]
│    │     ├─ CTA "Become an Affiliate" → [view=role-selection]
│    │     ├─ CTA "Browse Marketplace" → [view=marketplace]
│    │     └─ (product grid tiles are display-only here; no click-through in landing)
│    │
│    ├── [view=onboarding]  (first-run carousel, gated by localStorage `afrilink_onboarding_seen`)
│    │     ├─ "Skip" → jumps to last slide → auto-completes (300ms) → [view=role-selection]
│    │     └─ "Get Started" (last slide) → [view=role-selection]
│    │
│    ├── [view=role-selection]
│    │     ├─ Back (if shown) → [view=landing]
│    │     ├─ Card "Vendor" → onboardingRole=vendor → [view=onboarding-register, role=vendor]
│    │     ├─ Card "Affiliate" → onboardingRole=affiliate → [view=onboarding-register, role=affiliate]
│    │     ├─ Card "Browse" → isGuestBrowsing=true → [view=marketplace]  (no signup, guest)
│    │     └─ Footer "Already have an account? Log in" → [view=login]
│    │
│    ├── [view=onboarding-register]  (RegistrationFlow: 3-step wizard — Account → Phone → OTP)
│    │     ├─ guard: !onboardingRole → redirect [view=role-selection]
│    │     ├─ Back (component-level, step 1) → [view=role-selection]
│    │     ├─ complete + role=vendor → [view=vendor-profile-setup]
│    │     └─ complete + role=affiliate → [view=affiliate-profile-setup]
│    │            (if postGrabProductId set: auto-generates affiliate link + preselects product first)
│    │
│    ├── [view=vendor-profile-setup]  (requires `user`; else → [view=login])
│    │     ├─ Back → [view=role-selection]
│    │     └─ Complete (business_name+city+vendor_type+pickup_location+logo_url all set)
│    │            → toast "Vendor profile completed!" → [view=dashboard]
│    │
│    ├── [view=affiliate-profile-setup]  (requires `user`; else → [view=login])
│    │     ├─ Back → [view=role-selection]
│    │     └─ Complete (display_name+avatar_url set)
│    │            → toast "Affiliate profile completed!" → [view=marketplace]  (NOT dashboard)
│    │
│    ├── [view=phone-verification]  (requires `user`; else → [view=login]; MANDATORY GATE —
│    │     auto-entered by fetchUserData() whenever profile.phone_verified is falsy, for ANY
│    │     authenticated role, before dashboard/marketplace/profile-setup is reachable)
│    │     ├─ Back → handleLogout() → clears session/cart → [view=landing]   ⚠ BACK = LOGOUT
│    │     └─ Complete → toast "Phone verification complete!" → fetchUserData() re-evaluates
│    │            next gate (profile-setup / dashboard / marketplace per role & postGrab state)
│    │
│    ├── [view=login]
│    │     ├─ (LoginPage internal onNavigate) → [view=signup] / [view=forgot-password]
│    │     └─ Successful login → useEffect(user && userRole) → handlePostLogin() → fetchUserData()
│    │            → routes to phone-verification / profile-setup / dashboard / marketplace per gates
│    │
│    ├── [view=signup]
│    │     ├─ Back → [view=landing]
│    │     └─ onSignupSuccess(userId) → pendingUserId=userId → [view=verification]
│    │
│    ├── [view=forgot-password]
│    │     └─ (ForgotPasswordPage internal onNavigate back to login, not tracked further here)
│    │
│    ├── [view=reset-password]  (see §7 Recovery Lock — overrides ALL other view changes)
│    │     └─ On success + continue → unlocks recovery lock → [view=login]
│    │
│    ├── [view=verification]  (requires pendingUserId OR user; else → [view=login])
│    │     ├─ complete + user present → toast, [view=dashboard], fetchUserData()
│    │     └─ complete + no user → toast, [view=login], pendingUserId=null
│    │
│    ├── [view=dashboard]  (requires currentUser)
│    │     ├─ DashboardNav (top bar, see §5 for full dropdown)
│    │     │     ├─ Bell → NotificationDropdown (popover, in place)
│    │     │     ├─ Avatar → ProfileDropdownContent (see §5)
│    │     │     │     ├─ "Orders" (vendor only) → [view=orders]
│    │     │     │     ├─ Withdraw → NewWithdrawModal (overlay)
│    │     │     │     ├─ Transaction History toggle → LedgerHistory (inline expand)
│    │     │     │     ├─ Dark Mode Switch → theme toggle (no navigation)
│    │     │     │     ├─ Switch Role button → handleSwitchRole() → fetchUserData() (stays on dashboard)
│    │     │     │     ├─ Add Role button → handleAddRole() → fetchUserData() (may redirect to
│    │     │     │     │      the new role's profile-setup view via the gate logic)
│    │     │     │     └─ Sign Out → handleLogout() → [view=landing]
│    │     │     └─ (props also wire onNavigateToSettings/Verification/Marketplace/Help/Orders,
│    │     │          but DashboardNav itself only *renders* the wallet/profile menu — the Orders
│    │     │          entry above is the only direct in-menu nav item; Settings/Verification/Help
│    │     │          are reached via MobileBottomNav on mobile, see §6)
│    │     ├─ Body: VendorDashboard | AffiliateDashboard
│    │     │     ├─ (Vendor) AddProductModal (overlay) — opened from "add product" button
│    │     │     ├─ (Vendor) EditProductModal (overlay) — per product row "edit"
│    │     │     ├─ (Vendor) AlertDialog — "take down" confirmation
│    │     │     ├─ (Vendor) onVerify → [view=verification]
│    │     │     ├─ (Affiliate) "Grab Link" → handleGenerateLink (no navigation; copies link)
│    │     │     ├─ (Affiliate) product click → ProductImagesModal (overlay)
│    │     │     └─ (Affiliate) onVerify → [view=verification]
│    │     ├─ PullToRefresh wrapper → fetchUserData() on pull
│    │     ├─ MobileBottomNav (mobile only, see §6) — active tab "dashboard"
│    │     └─ InstallPrompt (PWA install banner, dismissible)
│    │
│    ├── [view=orders]  (requires currentUser; vendor-oriented)
│    │     ├─ DashboardNav (same top bar as dashboard)
│    │     ├─ "← Back to Dashboard" text link → [view=dashboard]
│    │     └─ VendorOrders (order list fed by Order Guardian backend)
│    │
│    ├── [view=marketplace]  (guest-accessible — no auth required)
│    │     ├─ MarketplaceNav
│    │     │     ├─ Back button (ONLY if isGuestBrowsing===true) →
│    │     │     │      isGuestBrowsing=false; [view=role-selection]
│    │     │     ├─ Search input (desktop + mobile variants)
│    │     │     ├─ Filter toggle → inline filter panel (Commission / Price Range selects + "Clear")
│    │     │     ├─ Category chip row (client-side filter, no navigation)
│    │     │     ├─ Cart button → CartDrawer (right-slide-in panel, cartOpen state)
│    │     │     └─ Login button (guest) → [view=login]
│    │     ├─ Product grid → click card → ProductModal (overlay)
│    │     │     ├─ ProductModal "Grab Link" → handleGrabLink()
│    │     │     │      ├─ if !user → postGrabProductId=id; [view=login]
│    │     │     │      └─ if user & role=affiliate → handleGenerateLink() (in place)
│    │     │     ├─ ProductModal "Buy Now" → handleBuyProduct() → EXTERNAL redirect to
│    │     │     │      shop.afrilink.info/p/{slug|id}?source=MARKETPLACE&vendor=... (full page nav
│    │     │     │      away from the SPA via window.location.href — see checkoutHandoff.ts)
│    │     │     └─ ProductModal "Close" → selectedProduct=null (closes overlay)
│    │     ├─ CartDrawer
│    │     │     ├─ line-item qty stepper / remove (no navigation)
│    │     │     └─ Checkout CTA → performMarketplaceCheckoutHandoff() → EXTERNAL redirect to
│    │     │            shop.afrilink.info/p/{slug|id}?source=MARKETPLACE|ref=<code>&qty=&vendor=
│    │     ├─ PullToRefresh → fetchMarketplaceProducts()
│    │     └─ MobileBottomNav (mobile only) — active tab "marketplace"
│    │
│    ├── [view=settings]  (requires currentUser)
│    │     └─ Back → [view=dashboard]
│    │
│    ├── [view=verification-manage]  (requires currentUser)
│    │     └─ Back → [view=dashboard]
│    │
│    └── [view=help-support]  (requires currentUser)
│          └─ Back → [view=dashboard]
│
├── "/p/:productId"  → <ProductPage/>  (standalone; independent of the view machine)
│     ├─ Back (navigate(-1)) → browser history back
│     └─ "Buy Now" (only if affiliate attribution present) → CheckoutModal (overlay)
│           └─ onSuccess → toast "Order placed successfully!" (stays on page, modal closes)
│
├── "/confirm/:orderId"  → <OrderConfirmationPage/>  (standalone, terminal — no forward nav)
│     ├─ "Yes, I received my order" → updates order status in place
│     └─ "Report a problem" → updates order status in place
│
├── "/checkout/confirm"  → <CheckoutConfirmPage/>  (standalone; gateway return page)
│     ├─ success → "Continue Shopping" → navigate('/')  (re-enters view machine at default view)
│     └─ failure → "Retry Verification" (re-polls) | "Back to Shop" → navigate('/')
│
└── "*"  → <NotFound/>
      └─ "Return to Home" (Link) → navigate('/')
```

---
## 4. `view` State Machine — Value Catalogue & Transition Table

### 4.1 All possible `View` values (TypeScript union, `Index.tsx` lines 40–58)

| # | Value | Auth requirement | Rendered component |
|---|---|---|---|
| 1 | `landing` | none (default) | `LandingPage` |
| 2 | `login` | none | `LoginPage` |
| 3 | `signup` | none | `SignupPage` |
| 4 | `forgot-password` | none | `ForgotPasswordPage` |
| 5 | `reset-password` | none (token-based) | `ResetPasswordPage` |
| 6 | `verification` | `pendingUserId` or `user` | `VerificationForm` |
| 7 | `dashboard` | `currentUser` | `DashboardNav` + `VendorDashboard`/`AffiliateDashboard` |
| 8 | `marketplace` | none (guest ok) | `MarketplaceNav` + product grid + `CartDrawer`/`ProductModal` |
| 9 | `settings` | `currentUser` | `SettingsPage` |
| 10 | `verification-manage` | `currentUser` | `VerificationManagePage` |
| 11 | `help-support` | `currentUser` | `HelpSupportPage` |
| 12 | `orders` | `currentUser` | `DashboardNav` + `VendorOrders` |
| 13 | `onboarding` | none | `OnboardingCarousel` |
| 14 | `role-selection` | none | `RoleSelection` |
| 15 | `onboarding-register` | none (but needs `onboardingRole`) | `RegistrationFlow` |
| 16 | `vendor-profile-setup` | `user` | `VendorProfileSetup` |
| 17 | `affiliate-profile-setup` | `user` | `AffiliateProfileSetup` |
| 18 | `phone-verification` | `user` | `PhoneVerificationFlow` |

All 18 values are also the only accepted values for the URL's `?view=` query param (`validViews` array in `getViewFromUrl`); anything else is ignored and falls back to `null` → default view resolution runs (see §7.2).

### 4.2 Source → Trigger → Destination Transition Table

| # | Source view | Trigger | Destination view | Side effects |
|---|---|---|---|---|
| 1 | (initial load, no user, no onboarding flag) | app mount | `onboarding` | sets via default-view effect |
| 2 | (initial load, no user, onboarding seen) | app mount | `role-selection` | — |
| 3 | (initial load, URL has `?view=`) | app mount | value from URL | recovery hash overrides everything |
| 4 | (initial load, path `/reset-password` or hash `type=recovery`) | app mount | `reset-password` | `recoveryLocked.current = true` |
| 5 | `landing` | click "Sign In" | `login` | — |
| 6 | `landing` | click vendor/affiliate CTA | `role-selection` | `handleNavigate` maps both to role-selection |
| 7 | `landing` | click "Browse" CTA | `marketplace` | fetches marketplace products |
| 8 | `onboarding` | "Skip" or "Get Started" | `role-selection` | `localStorage.afrilink_onboarding_seen = 'true'` |
| 9 | `role-selection` | back button | `landing` | — |
| 10 | `role-selection` | select "Vendor" | `onboarding-register` | `onboardingRole='vendor'`, role written to URL |
| 11 | `role-selection` | select "Affiliate" | `onboarding-register` | `onboardingRole='affiliate'`, role written to URL |
| 12 | `role-selection` | select "Browse" | `marketplace` | `isGuestBrowsing=true` |
| 13 | `role-selection` | "Log in" link | `login` | — |
| 14 | `onboarding-register` | back | `role-selection` | — |
| 15 | `onboarding-register` | guard: no `onboardingRole` | `role-selection` | render-time redirect (`return null` after `setView`) |
| 16 | `onboarding-register` | complete, role=vendor | `vendor-profile-setup` | `fetchUserData()` |
| 17 | `onboarding-register` | complete, role=affiliate | `affiliate-profile-setup` | `fetchUserData()`; if `postGrabProductId` set, generates link + preselects product |
| 18 | `vendor-profile-setup` | guard: no `user` | `login` | — |
| 19 | `vendor-profile-setup` | back | `role-selection` | — |
| 20 | `vendor-profile-setup` | complete | `dashboard` | toast, `fetchUserData()` |
| 21 | `affiliate-profile-setup` | guard: no `user` | `login` | — |
| 22 | `affiliate-profile-setup` | back | `role-selection` | — |
| 23 | `affiliate-profile-setup` | complete | `marketplace` | toast, `fetchUserData()` |
| 24 | `phone-verification` | guard: no `user` | `login` | — |
| 25 | `phone-verification` | back | `landing` | **`handleLogout()` fires first** — full sign-out, cart clear |
| 26 | `phone-verification` | complete | (re-resolved by `fetchUserData`) | toast, re-runs gate chain |
| 27 | `login` | successful auth | (re-resolved by `fetchUserData` via `handlePostLogin`) | see §7.3 gate order |
| 28 | `login` | internal nav (component prop) | `signup` / `forgot-password` | — |
| 29 | `signup` | back | `landing` | — |
| 30 | `signup` | signup success | `verification` | `pendingUserId` set |
| 31 | `verification` | guard: no `pendingUserId`/`user` | `login` | — |
| 32 | `verification` | complete, `user` present | `dashboard` | toast, `fetchUserData()` |
| 33 | `verification` | complete, no `user` | `login` | toast, `pendingUserId=null` |
| 34 | `reset-password` | Supabase `PASSWORD_RECOVERY` event fires anytime | `reset-password` (forced) | `recoveryLocked.current=true`, blocks all other `setView` calls except to `login` |
| 35 | `reset-password` | reset flow completes → user proceeds | `login` | unlocks `recoveryLocked` |
| 36 | `dashboard` | Sign Out (dropdown) | `landing` | `handleLogout()`: signOut, clearCart, reset profile/products state |
| 37 | `dashboard` | DashboardNav → Orders item (vendor) | `orders` | — |
| 38 | `dashboard` | MobileBottomNav → any tab | see §6 mapping | `handleNavigate()` |
| 39 | `dashboard`/vendor | "Verify" CTA in VendorDashboard | `verification` | — |
| 40 | `dashboard`/affiliate | "Verify" CTA in AffiliateDashboard | `verification` | — |
| 41 | `orders` | "← Back to Dashboard" | `dashboard` | — |
| 42 | `marketplace` | Back button (guest only) | `role-selection` | `isGuestBrowsing=false` |
| 43 | `marketplace` | Login button (guest) | `login` | — |
| 44 | `marketplace` | Grab Link, not logged in | `login` | `postGrabProductId` set for post-login resume |
| 45 | `marketplace` | Buy Now (ProductModal) | *(external redirect)* | full-page `window.location.href` to `shop.afrilink.info/p/...` — leaves the SPA |
| 46 | `marketplace` | Cart checkout | *(external redirect)* | same external handoff, via `performMarketplaceCheckoutHandoff` |
| 47 | `settings` | Back | `dashboard` | — |
| 48 | `verification-manage` | Back | `dashboard` | — |
| 49 | `help-support` | Back | `dashboard` | — |
| 50 | any (recovery-locked) | any `setView(x)` where `x != 'reset-password' && x != 'login'` | **blocked** — no-op, console-logged | see §7.1 |
| 51 | `CheckoutConfirmPage` (route, not a view) success | "Continue Shopping" | React Router `navigate('/')` | re-enters the view machine fresh (default-view resolution runs again) |
| 52 | `CheckoutConfirmPage` failure | "Back to Shop" | React Router `navigate('/')` | same as above |
| 53 | `NotFound` (route `*`) | "Return to Home" | React Router `navigate('/')` | — |

---
## 5. `DashboardNav` — Profile Dropdown (Exhaustive Contents)

Trigger: clicking the avatar/name chip (desktop, `DropdownMenuTrigger` shows avatar+name+role badge+chevron) or the avatar-only icon (mobile). Renders identical `ProfileDropdownContent` on both.

Top-to-bottom sections inside the dropdown panel (`w-72`, rounded card):

1. **Profile header** (display-only): avatar (image or initials fallback), full name, email — no click action.
2. **Wallet card**:
   - Icon + "Available Balance" label + formatted currency amount (or spinner while loading).
   - **"Withdraw"** button — visible only if `walletBalance >= 20000` (TZS) → opens `NewWithdrawModal` (overlay, `stopPropagation`'d so the dropdown stays open behind it).
   - If not eligible: static text `Min: {20,000 formatted}` (balance>0) or `No funds`.
   - Pending balance note (if `walletPending > 0`): `+ {amount} pending`.
   - **"Transaction History" / "Hide History"** toggle button → expands `LedgerHistory` (scrollable, `max-h-48`) inline within the dropdown; does not close the dropdown.
3. **Orders item** — `DropdownMenuItem`, **only rendered if `currentUser.role === 'vendor'` and `onNavigateToOrders` provided** → calls `onNavigateToOrders` → `setView('orders')`.
4. **Dark Mode row** — icon (Moon/Sun) + label "Dark Mode" + `Switch` toggle → `next-themes` `setTheme('dark'|'light')`. Not a `DropdownMenuItem` (doesn't close menu on toggle).
5. **Switch Role section**:
   - Header: RefreshCw icon + "Switch Role" label.
   - Current role pill (highlighted, non-interactive) showing active role + "Active" tag.
   - If `availableRoles.length > 1`: button(s) for the *other* role(s) → `onSwitchRole(role)` → `handleSwitchRole` → `switchRole()` + `fetchUserData()` (stays on dashboard, but data/gates re-evaluate).
   - Else (only one role): dashed-border "Add {OtherRole} Role" button → `onAddRole(role)` → `handleAddRole` → `addRole()` + `fetchUserData()` (may route to that role's profile-setup view).
6. **Sign Out** — `DropdownMenuItem`, destructive styling, LogOut icon → `onLogout` → `handleLogout()` → full sign-out + `setView('landing')`.

`NewWithdrawModal` is rendered as a sibling overlay outside the dropdown tree (mounted at the bottom of the `<nav>`), controlled by `isWithdrawOpen` state — closing it does not affect dropdown open state.

`NotificationDropdown` (bell icon) sits to the left of the avatar trigger on both desktop and mobile headers — a separate popover, unrelated to the profile menu.

---
## 6. `MobileBottomNav` — Tabs (mobile only, `sm:hidden`, shown on `dashboard` and `marketplace` views)

Fixed bottom bar, 5 tabs, i18n-driven labels (`react-i18next`, namespace keys shown below), icons from `lucide-react`:

| Order | id (activeTab) | Icon | i18n label key | `onNavigate` action value | Resulting view |
|---|---|---|---|---|---|
| 1 | `dashboard` | `Home` | `nav.home` | `'dashboard'` | `dashboard` |
| 2 | `marketplace` | `Store` | `nav.market` | `'marketplace'` | `marketplace` (also triggers `fetchMarketplaceProducts()` via `handleNavigate`) |
| 3 | `settings` | `Settings` | `nav.settings` | `'settings'` | `settings` |
| 4 | `help` | `HelpCircle` | `nav.help` | `'help-support'` | `help-support` |
| 5 | `profile` | `User` | `nav.verification` | `'verification-manage'` | `verification-manage` |

`activeTab` is derived by `getMobileActiveTab()` in `Index.tsx`:
```
marketplace          → 'marketplace'
settings             → 'settings'
help-support         → 'help'
verification-manage  → 'profile'
(everything else, incl. dashboard/orders) → 'dashboard'
```
So the "Home" tab visually stays highlighted while on `orders` too (since `orders` isn't special-cased). Active tab gets `text-primary` color, a `bg-primary/10` icon chip, and a slightly scaled-up icon; inactive tabs are muted with `active:text-primary` touch feedback.

---
## 7. Back-Navigation, Guards, and Redirect Rules

### 7.1 Password-Recovery Lock (`recoveryLocked` ref)
- Set to `true` the instant the app detects: `pathname === '/reset-password'`, OR a `#...type=recovery` hash fragment, OR a live Supabase `PASSWORD_RECOVERY` auth event.
- While locked, the `setView` wrapper **rejects every transition** except to `'reset-password'` itself or to `'login'` (the only legal exit, once the reset flow finishes) — `console.log('[Index] Blocked view change to', newView, '— recovery lock active')`.
- The default-view effect and the post-login redirect effect both early-return while locked, so no other logic can knock the user off the reset screen mid-flow.
- Unlock condition: the app explicitly calls `setView('login')` (fired by `ResetPasswordPage`'s success/continue action).

### 7.2 Default-View Resolution (only runs if URL had no `?view=` and not recovery-locked)
```
if (!user) {
  if (!localStorage.afrilink_onboarding_seen) → view = 'onboarding'
  else                                        → view = 'role-selection'
}
// if user IS present, no default is forced here — the post-login effect (7.3) handles it
```

### 7.3 Post-Login / Authenticated Gate Chain (`fetchUserData`, run whenever `user && userRole` and not on `verification`/`reset-password`)
Order of checks, first match wins (each `return`s immediately once it redirects):
1. `profile.phone_verified` falsy → `phone-verification` (applies to both roles, always first gate).
2. Role = vendor:
   a. vendor_profile incomplete (missing any of business_name/city/vendor_type/pickup_location/logo_url) → `vendor-profile-setup`.
   b. else loads vendor products/stats, falls through to step 4.
3. Role = affiliate:
   a. affiliate_profile incomplete (missing display_name or avatar_url) → `affiliate-profile-setup`.
   b. else, if `postGrabProductId` pending (user hit "Grab Link" as a guest, then logged in) → auto-generates the link, preselects the product, clears `postGrabProductId`, forces `marketplace` view, **return** (skips step 4).
   c. else loads marketplace products/affiliate stats, falls through to step 4.
4. Final redirect: `if (!['marketplace','affiliate-profile-setup','vendor-profile-setup','phone-verification'].includes(currentView)) setView('dashboard')` — i.e. unless the user is already sitting on one of those 4 "blocking" views (which would be wrong to override), force them to `dashboard`.

### 7.4 Auth Guards Per View (render-time checks inside `Index.tsx`)
| View | Guard | Redirect if failed |
|---|---|---|
| `onboarding-register` | needs `onboardingRole` | `role-selection` |
| `vendor-profile-setup` | needs `user` | `login` |
| `affiliate-profile-setup` | needs `user` | `login` |
| `phone-verification` | needs `user` | `login` |
| `verification` | needs `pendingUserId` or `user` | `login` |
| `settings`, `verification-manage`, `help-support`, `orders`, `dashboard` | needs `currentUser` (both `user` + `profile` loaded) | *(no explicit else-branch shown; these simply don't render if the condition is false — falls through render tree, effectively showing nothing until data loads)* |
| `marketplace` | none | guest-accessible by design |
| `landing`, `login`, `signup`, `forgot-password`, `reset-password` | none | guest-accessible |

### 7.5 Special Back Rules
- **`phone-verification` → Back = Logout.** This is the single most important non-obvious rule: the `onBack` prop passed to `PhoneVerificationFlow` is wired directly to `handleLogout()`, not to a previous view. Since phone verification is a mandatory account-activation gate, users cannot "go back" past it while keeping their session — backing out signs them out entirely and returns them to `landing`.
- **Guest marketplace browsing (`isGuestBrowsing`).** Set only when a guest picks "Browse" from `role-selection`. While true, `MarketplaceNav` renders a Back arrow button that, when pressed, resets `isGuestBrowsing=false` and returns to `role-selection`. If the guest instead reached `marketplace` via the landing page's "Browse" CTA (`handleNavigate`), `isGuestBrowsing` stays `false` and **no Back button is shown at all** in `MarketplaceNav` (the `onBack` prop is `undefined` in that call path) — the only way out is the bottom nav / logging in.
- **`ProductPage` (route)** uses real browser history: its Back button calls `navigate(-1)`, i.e. OS/browser back, not a fixed destination.
- **Password reset back-out**: while `recoveryLocked` is active, there is no way to navigate elsewhere in-app (see §7.1) — the only UI escape hatches are whatever `ResetPasswordPage` itself renders (e.g. "invalid link" state with its own button, which internally still must call `setView('login')` to succeed).

---
## 8. Drawers, Modals, and Bottom Sheets — Open/Close Mechanics

| Overlay | State variable / owner | Opens via | Closes via |
|---|---|---|---|
| `CartDrawer` (marketplace) | `cartOpen` (Index.tsx) | `MarketplaceNav` cart icon → `onCartClick` → `setCartOpen(true)` | drawer's own close (X) button → `setCartOpen(false)` |
| `ProductModal` (marketplace) | `selectedProduct` (Index.tsx) | clicking a `ProductCard` → `setSelectedProduct(product)` | modal's "Close" button, backdrop click, or after "Buy Now" fires (`setSelectedProduct(null)` inside `handleBuyProduct`) |
| `CheckoutModal` (ProductPage route) | `checkoutOpen` (local to `ProductPage`) | "Buy Now" button (only if affiliate attribution present) → `setCheckoutOpen(true)` | `onClose` prop → `setCheckoutOpen(false)`; `onSuccess` shows a toast but does not auto-close (component-internal) |
| `NewWithdrawModal` | `isWithdrawOpen` (local to `DashboardNav`) | "Withdraw" button in profile dropdown (enabled only if balance ≥ 20,000) | `onClose` → `setIsWithdrawOpen(false)`; `onWithdrawSuccess` refetches wallet + calls `onWalletUpdate` |
| `LedgerHistory` (inline expand, not a true modal) | `showLedger` (local to `DashboardNav`) | "Transaction History" toggle in wallet card | toggle again ("Hide History") |
| `AddProductModal` | local to `VendorDashboard` | "Add Product" button | close/cancel; success → `onProductAdded` (`fetchUserData`) |
| `EditProductModal` | local to `VendorDashboard` | product row "edit" action | close/cancel |
| `ProductImagesModal` | local to `AffiliateDashboard` | product click (affiliate view) | close/cancel |
| `AlertDialog` (take-down confirm) | local to `VendorDashboard` | "take down" action on a product row | Cancel button or confirm action (both dismiss) |
| `NotificationDropdown` (bell popover) | internal to component | bell icon click (both nav bars) | outside click / Radix popover dismiss |
| `Notification` (toast/banner) | `notification` state (Index.tsx) | `showNotification(message)` calls scattered through Index.tsx (logout, profile-completion, verification submission, etc.) | `onClose` → `setNotification(null)`; also auto-dismiss behavior is component-internal |
| `sonner` / shadcn `Toaster` toasts | global, imported in `App.tsx` | `toast.success(...)`/`toast.error(...)` calls anywhere in the app | auto-timeout or user dismiss |
| `InstallPrompt` | mounted on `dashboard` view | shown automatically to installable-PWA browsers | dismiss button (persisted 7 days via `localStorage.afrilink_install_dismissed`); iOS gets a 2-step manual full-screen guide instead of the native prompt |

None of these overlays alter the `view` state or the URL — they are purely local component state layered visually on top of whatever `view` is currently active.

---
## 9. Deep Links

### 9.1 Custom URL Scheme — `afrilink://`
- Declared informally (no native manifest in this repo — it's a Capacitor app; the native Android/iOS projects that would declare the intent-filter/URL-scheme are generated separately and are **not** checked into this repo).
- `capacitor.config.ts`: `appId: 'com.kbsoftwares.afrilink'`, `appName: 'Winger'`, `webDir: 'dist'` — this is the only native-adjacent config present.
- Used exclusively today for **password reset**: `src/utils/resetUrl.ts` exposes `getResetDeepLink(token)` → `afrilink://reset-password?token=<TOKEN>`. A button on the web `ResetPasswordPage` ("Open in AfriLink App", per `docs/MOBILE_DEEPLINKING.md`) fires this URL so an installed native app can intercept it.
- No other in-app deep-link routes are wired to the custom scheme in current code (e.g. there is no `afrilink://product/:id` handler implemented — only the reset-password path is documented/implemented).

### 9.2 Android App Links — `public/.well-known/assetlinks.json`
- Present but with placeholder values: `package_name: "REPLACE_ME_PACKAGE_NAME"`, `sha256_cert_fingerprints: ["REPLACE_ME_SHA256_FINGERPRINT"]`. Must be filled in with the real Android package (`com.kbsoftwares.afrilink`, per `capacitor.config.ts`) and the release-signing SHA-256 fingerprint before Android App Links can auto-verify.
- Intended intent-filter (per `docs/MOBILE_DEEPLINKING.md`, to be added in the native Android project, not present in this repo):
  - `autoVerify` HTTPS intent-filter for `host=afrilink01.vercel.app`, `pathPrefix=/reset-password`.
  - Secondary non-verified intent-filter for custom scheme `afrilink://reset-password`.

### 9.3 iOS Universal Links — `public/.well-known/apple-app-site-association`
- Present with placeholder `appID: "REPLACE_ME_TEAMID_BUNDLEID"` (format `<TEAM_ID>.<BUNDLE_ID>`), `paths: ["/reset-password*"]` only.
- Requires Xcode "Associated Domains" capability `applinks:afrilink01.vercel.app` (native project not in this repo) and `AppDelegate`/`SceneDelegate` handling of `NSUserActivity.webpageURL` to extract the `token` query param and route to the native reset-password screen.

### 9.4 `/p/:slug` Affiliate Referral Links
- Two distinct systems share the `/p/` prefix concept but are **not the same route**:
  1. **In-app route `/p/:productId`** (`ProductPage`, this repo) — matched against the DB `products.id` (not slug), rendered by React Router. Accepts `?ref=<affiliateCode>` to attribute a sale to an affiliate; on load it calls `resolve_affiliate_link`-equivalent tracking (`checkout-api/track-click`) and stores `affiliateCode` via `useCart().setAffiliateCode` — this in turn is persisted to `localStorage.affiliateCode` (read later by `hasAffiliateAttribution()`), so a ref click is "sticky" even if the user navigates away and returns without the query param.
  2. **External checkout system** `https://shop.afrilink.info/p/{slug}` (built by `buildCheckoutUrl` in `src/utils/checkoutHandoff.ts`) — a *separate deployed app*, used as the hand-off target when a marketplace buyer hits "Buy Now" or checks out from the cart. URL params: `source` (`MARKETPLACE`), `ref` (affiliate code, only for pure-affiliate purchase mode), `qty` (if >1), `vendor` (vendor id). Uses `item.slug` if the product has one, else falls back to `item.id`.
  - Affiliate share links generated in-app (`handleGenerateLink` in `Index.tsx`) build URLs of the form `{appUrl}/p/{productId}?ref={code}` — i.e. they target route (1), the in-app `ProductPage`, not the external shop.
- The `ref` query param is also read at the root `/` route in `Index.tsx` (top-level `useEffect`) for any legacy/landing-page-level referral links, invoking `resolve_affiliate_link` RPC and calling `setAffiliateCode(ref)`.

---
## 10. URL Query-Param View Persistence & Scroll-to-Top

### 10.1 Persistence Mechanism
- `getViewFromUrl()` reads `?view=` and `?role=` from `window.location.search` on every relevant effect run and on initial `useState` initializers for `view` and `onboardingRole`.
- `updateUrlView(view, role)` writes back with `window.history.replaceState` (not `pushState` — **no browser history entries are created for in-app view changes**, meaning the browser Back button will NOT step through view transitions; it only affects the actual route history created by `BrowserRouter`'s own navigations, e.g. visiting `/p/:id` then `/`).
- The hash fragment is preserved on the URL **only** while `view === 'reset-password'** (to avoid interrupting Supabase's token parsing from the hash); it is stripped for every other view.
- `setView()` is the single funneling wrapper used everywhere in `Index.tsx` — it updates React state (`setViewState`) AND the URL (`updateUrlView`) atomically, so `view` state and the URL query string never drift apart (except during the recovery lock, where `setView` calls are dropped rather than desynced).

### 10.2 Scroll-to-Top on View Switch
- Every call to `setView(...)` ends with:
  ```js
  window.scrollTo({ top: 0, behavior: 'smooth' });
  ```
  This runs unconditionally for every legal transition (i.e., every row in the §4.2 table that isn't blocked by the recovery lock), ensuring the user always starts a new "screen" at the top, animated smoothly rather than an instant jump.
- This scroll reset is a global side-effect of the `setView` wrapper, not a per-view `useEffect` — so it also fires for same-view "role" updates (e.g. re-entering `onboarding-register` with a different role) since `setView` doesn't diff the previous value before scrolling.

### 10.3 Sharing / Bookmarking Implications for Flutter
- Because `view`/`role` live in the query string, a shared URL like `https://.../?view=marketplace` will deep-link a fresh page load directly into the marketplace view (bypassing the onboarding/role-selection default flow) as long as it's not intercepted by the recovery-hash check first. A Flutter rebuild should replicate this "restore exact screen from URL/deep-link params" behavior for web/PWA parity, while native mobile can rely on named routes + the `afrilink://` scheme for equivalent entry points.
