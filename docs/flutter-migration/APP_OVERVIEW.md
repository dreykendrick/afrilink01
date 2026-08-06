# Winger — App Overview (Flutter Migration, Part 1)

> Source app: React + Vite SPA ("vite_react_shadcn_ts") named **Winger** (formerly "AfriLink"), a Tanzanian
> affiliate/vendor marketplace. This document captures the app's purpose, architecture, dependencies and
> external integrations to enable a from-scratch Flutter rebuild.

## 1. Purpose & Business Goals

Winger is **"Africa's Premier Affiliate Marketplace"** — a three-sided marketplace connecting:

- **Vendors** who list products.
- **Affiliates** who generate trackable referral links to products and earn commission on sales.
- **Consumers / Guest buyers** who purchase products (via affiliate link or general marketplace browsing).

Marketing copy (from `index.html` / `LandingPage.tsx`):
- Title: `Winger - Africa's Premier Affiliate Marketplace`
- Meta description: "Connect vendors, affiliates, and consumers on Africa's leading marketplace. Automated payment splits with M-Pesa, Airtel Money & TigoPesa integration."
- Hero features list (3 feature cards):
  1. **Automated Splits** — "Instant payment distribution to vendors, affiliates & platform"
  2. **Smart Tracking** — "Track clicks, conversions and commissions in real-time"
  3. **Mobile Money** — "Integrated M-Pesa, Airtel Money & TigoPesa payments"

Business model: platform takes a fee from each sale, splits remainder between vendor and affiliate (if attributed), currency is **TZS** (Tanzanian Shilling) throughout (`formatCurrency` util, price filters expressed in "Tsh").

## 2. User Personas / Account Types

| Persona | Description | Auth required | Key capabilities |
|---|---|---|---|
| **Guest / Anonymous browser** | Visits landing page or marketplace without login | No | Browse products, view landing page, cannot buy unless via affiliate `?ref=` link; can start onboarding |
| **Buyer (via affiliate link)** | Clicks an affiliate `?ref=CODE` link, may or may not have an account | No account required to buy | Add to cart, checkout (buy now) — checkout gated on presence of affiliate attribution (`hasAffiliateAttribution()` reads `localStorage.affiliateCode`) |
| **Vendor** | Registered role that lists/sells products | Yes (Supabase auth) | Add/edit products, manage orders, wallet/withdrawals, verification, location picker |
| **Affiliate** | Registered role that promotes vendor products for commission | Yes | Browse marketplace as affiliate, "Grab Link" to generate a trackable link, dashboard with clicks/conversions/commission stats, wallet/withdrawals |
| **Admin** | Not implemented in this frontend (referenced only via "admin will review your documents" / "admin approval" copy) — verification/product approval presumably happens in a separate admin surface (not in this repo) | External | Approves vendor verification, product listings (`status = pending/approved/rejected`) |

A single Supabase user account can hold **both vendor and affiliate roles** simultaneously (`availableRoles`, `switchRole`, `addRole` from `useAuth`), switchable from the profile dropdown without re-registering.

## 3. Core Feature List

- Landing page marketing site with product showcase pulled from live marketplace data.
- Onboarding carousel (4 slides) + role selection (Vendor / Affiliate / Browse as guest).
- Email/password auth: signup, login, forgot password, reset password (with Supabase recovery-hash detection), OTP-based phone verification (Tanzania phone format) via Briq SMS.
- Vendor flow: profile setup (business name, city, vendor type, pickup location via map, logo), product CRUD (add/edit/images/takedown/availability toggle), order management, wallet & withdrawals, verification (ID photo upload).
- Affiliate flow: profile setup (display name, bio, avatar), marketplace browsing, "Grab Link" to generate unique affiliate links (copied to clipboard), dashboard with click/conversion/commission stats, wallet & withdrawals.
- Marketplace: search, category filter, commission filter (5%+/10%+/15%+/20%+), price range filter (Under 50,000 / 50,000–100,000 / 100,000–500,000 / 500,000+ Tsh), product cards & modal, cart drawer, guest "back to role selection" browsing state.
- Cart & checkout: local cart (Zustand/Context — `useCart` hook) with affiliate-code attribution, in-app `CheckoutModal` for buyer details + delivery address + phone, OR handoff to **external checkout system at shop.afrilink.info** for marketplace (non-affiliate) purchases.
- Payments: mobile money (M-Pesa, Airtel Money, TigoPesa) + card via Briq payment gateway; async payment confirmation via `payments-api` edge function with polling; standalone `/checkout/confirm` return page.
- Order confirmation & delivery confirmation flow via emailed tokenized link (`/confirm/:orderId?token=...`) allowing buyer to confirm receipt or report a delivery problem, which releases escrowed funds to vendor/affiliate wallets.
- Wallet system: available/pending balbalances, minimum withdrawal threshold (20,000 TZS), ledger/transaction history, external withdrawal via **Order Guardian** backend.
- Settings page: profile photo, name/email/phone, notification toggles, theme (dark/light), language selector, privacy/data-export/delete-account placeholders.
- Help & Support page: WhatsApp / email / phone contact links, FAQ accordion.
- Push/PWA notifications: `NotificationDropdown`, service worker `sw-push.js`.
- Mobile-first UX: bottom tab navigation, pull-to-refresh, swipeable cards, install (Add-to-Home-Screen) prompt, safe-area insets, Capacitor Android packaging.
- Internationalization via `react-i18next` (English default; translation keys throughout, e.g. `nav.home`, `roleSelection.title`).
- Deep linking for password reset via Android App Links / iOS Universal Links / custom URL scheme `afrilink://`.

## 4. Current Architecture

### 4.1 SPA shell & routing (two-layer routing system)

The app uses **React Router** for a *small* set of real routes, and a **custom in-memory view state machine** (in `src/pages/Index.tsx`) for the bulk of the application (auth, onboarding, dashboards, marketplace, settings, etc.), persisted into the URL via a `?view=` query parameter rather than distinct router paths.

**React Router routes** (`src/App.tsx`):

| Path | Element | Notes |
|---|---|---|
| `/` | `<Index />` | Hosts the entire view-state SPA |
| `/reset-password` | `<Index />` | Same component; Index detects this path (or a Supabase recovery hash) and forces `view = 'reset-password'` |
| `/p/:productId` | `<ProductPage />` | Standalone shareable product page (used for affiliate links `/p/{id}?ref=CODE`) |
| `/confirm/:orderId` | `<OrderConfirmationPage />` | Tokenized delivery-confirmation page (`?token=`) |
| `/checkout/confirm` | `<CheckoutConfirmPage />` | Payment gateway return/redirect page (`?payment_id=&status=`) |
| `*` | `<NotFound />` | 404 catch-all |

### 4.2 The `view` state machine (`src/pages/Index.tsx`)

`Index.tsx` (~1056 lines) is a single giant component (`IndexContent`) holding a `view: View` state that acts as a client-side router for everything under `/`. Its value is:

```ts
type View =
  | 'landing' | 'login' | 'signup' | 'forgot-password' | 'reset-password' | 'verification'
  | 'dashboard' | 'marketplace' | 'settings' | 'verification-manage' | 'help-support' | 'orders'
  | 'onboarding' | 'role-selection' | 'onboarding-register' | 'vendor-profile-setup'
  | 'affiliate-profile-setup' | 'phone-verification';
```

Key mechanics:
- **Initial state**: read synchronously from `?view=` query param (via `getViewFromUrl()`), defaulting to `'landing'`. Also reads `?role=vendor|affiliate` for onboarding-register.
- **Password recovery override**: if `window.location.pathname === '/reset-password'` OR the URL hash contains `type=recovery` (Supabase's auth redirect format), the view is force-locked to `'reset-password'` via a `recoveryLocked` ref, blocking all other `setView()` calls except to `'reset-password'` or `'login'` (unlock condition) until the flow completes. A Supabase `onAuthStateChange` listener also flips to this view on the `PASSWORD_RECOVERY` event.
- **`setView(newView, role?)` wrapper**: updates React state, rewrites the URL via `history.replaceState` (`updateUrlView`) — no actual navigation/reload — and auto-scrolls to top (`window.scrollTo({ top: 0, behavior: 'smooth' })`).
- **URL persistence**: `?view=<value>&role=<vendor|affiliate>` (role only present for `onboarding-register`). This means refreshing the browser preserves which screen the user was on (but not sub-state like scroll position, form contents, selected product modal, or cart-drawer-open state).
- Each `view` value maps to one big conditional render block returning a full-page component tree (see SCREENS.md for exhaustive per-view breakdown).
- `?ref=CODE` on the root URL sets affiliate attribution (`setAffiliateCode`) and calls Supabase RPC `resolve_affiliate_link` to track the click — this works independently of `view`.

### 4.3 Data/auth state layer

- `useAuth()` (`AuthProvider`, wraps whole app) — exposes `user`, `loading`, `userRole`, `signOut`, `availableRoles`, `switchRole`, `addRole`, `refreshRoles`. Backed by Supabase Auth.
- `useCart()` (`CartProvider`) — exposes `items`, `addToCart`, `removeFromCart`, `updateQuantity`, `setAffiliateCode`, `affiliateCode`, `clearCart`, `totalItems`, `totalPrice`. Affiliate code persisted to `localStorage` (`affiliateCode` key) for later checkout attribution even across page reload.
- `@tanstack/react-query` `QueryClient` is registered globally but most of `Index.tsx` uses direct `supabase.from(...)` calls + local `useState`, not React Query hooks (data fetched imperatively in `fetchUserData()`, `fetchMarketplaceProducts()`).
- Theme: `next-themes` `ThemeProvider` with `attribute="class"`, `defaultTheme="dark"`, `enableSystem`.

### 4.4 High-level component tree (per active `view`)

```
IndexContent
 ├─ (view=landing)               LandingPage
 ├─ (view=onboarding)            OnboardingCarousel
 ├─ (view=role-selection)        RoleSelection
 ├─ (view=onboarding-register)   RegistrationFlow
 ├─ (view=vendor-profile-setup)  VendorProfileSetup (uses VendorLocationPicker/Leaflet)
 ├─ (view=affiliate-profile-setup) AffiliateProfileSetup
 ├─ (view=phone-verification)    PhoneVerificationFlow (OTP via Briq)
 ├─ (view=login)                 LoginPage
 ├─ (view=signup)                SignupPage
 ├─ (view=forgot-password)       ForgotPasswordPage
 ├─ (view=reset-password)        ResetPasswordPage
 ├─ (view=verification)          VerificationForm
 ├─ (view=settings)              SettingsPage
 ├─ (view=verification-manage)   VerificationManagePage
 ├─ (view=help-support)          HelpSupportPage
 ├─ (view=orders)                DashboardNav + VendorOrders
 ├─ (view=dashboard)             DashboardNav + (VendorDashboard | AffiliateDashboard) + MobileBottomNav + InstallPrompt + PullToRefresh
 └─ (view=marketplace)           MarketplaceNav + ProductCard grid + ProductModal (conditional) + CartDrawer + MobileBottomNav
```
Global overlays regardless of view: `<Notification>` (toast-like banner state), shadcn `<Toaster/>` + `sonner` `<Sonner/>` toast systems, `<TooltipProvider>`.

## 5. Dependency List (package.json)

### Runtime dependencies and purpose

| Package | Version | Purpose |
|---|---|---|
| `@capacitor/android`, `@capacitor/cli`, `@capacitor/core` | ^8.0.2 | Native Android app packaging/build of the web app |
| `@hookform/resolvers` | ^3.10.0 | Zod resolver bridge for `react-hook-form` |
| `@radix-ui/react-*` (accordion, alert-dialog, aspect-ratio, avatar, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toast, toggle, toggle-group, tooltip) | various | Headless UI primitives underlying shadcn/ui component library |
| `@supabase/supabase-js` | ^2.93.2 | Backend client: auth, Postgres (via `.from()`), storage (image uploads), edge functions (`.functions.invoke`), Realtime (implied), RPC calls |
| `@tanstack/react-query` | ^5.83.0 | Data-fetching/caching (provider present; usage is minimal — mostly ad hoc `supabase` calls) |
| `@types/leaflet`, `leaflet` | ^1.9.21 / ^1.9.4 | Interactive map (vendor pickup-location picker) rendered against OpenStreetMap tiles |
| `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate` | — | Styling utilities for shadcn/ui + Tailwind |
| `cmdk` | ^1.1.1 | Command palette component (shadcn `Command`) |
| `date-fns` | ^3.6.0 | Date formatting |
| `embla-carousel-react` | ^8.6.0 | Carousel primitive (shadcn `Carousel`) |
| `i18next`, `i18next-browser-languagedetector`, `react-i18next` | — | Internationalization (translation keys used throughout: `nav.*`, `auth.*`, `roleSelection.*`, `marketplace.*`, `settings.*`, `common.*`) |
| `input-otp` | ^1.4.2 | OTP input widget for phone verification |
| `lucide-react` | ^0.462.0 | Icon set used everywhere |
| `next-themes` | ^0.3.0 | Dark/light theme provider & toggle |
| `react`, `react-dom` | ^18.3.1 | Core framework |
| `react-day-picker` | ^8.10.1 | Date picker (shadcn `Calendar`) |
| `react-hook-form` | ^7.61.1 | Form state management |
| `react-resizable-panels` | ^2.1.9 | Resizable panel layout (shadcn) |
| `react-router-dom` | ^6.30.1 | Client-side routing (5 routes, see above) |
| `recharts` | ^2.15.4 | Charts (likely used in dashboards/ledger visuals) |
| `sonner` | ^1.7.4 | Toast notifications (used pervasively: `toast.success/error(...)`) |
| `vaul` | ^0.9.9 | Drawer/bottom-sheet primitive |
| `vite-plugin-pwa` | ^1.2.0 | PWA manifest + service worker generation (Workbox) |
| `zod` | ^3.25.76 | Schema validation for forms |

### Dev dependencies

`vite` (^7.3.1), `@vitejs/plugin-react-swc`, `typescript` (^5.8.3), `typescript-eslint`, `eslint` + plugins, `tailwindcss` (^3.4.17), `postcss`, `autoprefixer`, `@tailwindcss/typography`, `lovable-tagger` (Lovable.dev dev-only component tagging), `@lovable.dev/vite-plugin-dev-server-bridge`, `@lovable.dev/vite-plugin-hmr-gate` (Lovable cloud IDE integration, dev only), `@types/*`.

## 6. External Services & Integrations

| Service | Role | Evidence |
|---|---|---|
| **Supabase ("Lovable Cloud")** | Primary BaaS: Postgres database (`products`, `orders`, `order_items`, `payments`, `profiles`, `vendor_profiles`, `affiliate_profiles`, `affiliate_links`, `transactions` tables), Auth (email/password, password recovery), Storage (buckets: `product-images`, `affiliate-avatars`, verification photos), Edge Functions, RPC functions (`resolve_affiliate_link`, `get_vendor_public_info`) | `src/integrations/supabase/client.ts`, calls throughout |
| **Supabase Edge Functions** (serverless API layer) | `checkout-api` (`/orders`, `/track-click`), `payments-api` (`/create-payment`, `/confirm-payment`, `/wallet`), `send-otp`, `verify-otp`, `app-config` | Referenced via `${VITE_SUPABASE_URL}/functions/v1/...` |
| **Order Guardian** (`order-guardian` edge function, deployed reference at **order-guardian.vercel.app**) | External backend used for vendor **orders list**, **wallet balance**, and **withdrawal requests** (`ExternalWithdrawModal`, `VendorOrders`, `VendorWalletExternal` all call `/functions/v1/order-guardian/...`) | `src/components/dashboard/ExternalWithdrawModal.tsx`, `VendorOrders.tsx`, `VendorWalletExternal.tsx` |
| **Briq** | Tanzania SMS/OTP gateway (`send-otp`/`verify-otp` edge functions) and payment gateway (mobile money: M-Pesa, Airtel Money, TigoPesa, plus card) invoked via `payments-api`; buyers may be redirected off-app to Briq's hosted payment page and back to `/checkout/confirm?payment_id=&status=` | `PhoneVerificationFlow.tsx`, `CheckoutConfirmPage.tsx`, landing page copy |
| **OpenStreetMap + Leaflet + Nominatim** | Interactive vendor pickup-location map (`VendorLocationPicker.tsx`): tile layer `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`; forward/reverse geocoding via `https://nominatim.openstreetmap.org/search` and `/reverse` (restricted to `countrycodes=tz`); default center Dar es Salaam `[-6.7924, 39.2083]`, zoom 13 | `src/components/dashboard/VendorLocationPicker.tsx` |
| **shop.afrilink.info** | External, single-product checkout web app that the main marketplace hands off to for **non-affiliate marketplace purchases** (`performMarketplaceCheckoutHandoff`, `buildCheckoutUrl`). URL pattern: `https://shop.afrilink.info/p/{slugOrId}?source=MARKETPLACE&ref=&qty=&vendor=`. Only the first cart item is handed off (external checkout is single-product); remaining items stay in-app cart. | `src/utils/checkoutHandoff.ts` |
| **afrilink01.vercel.app** | Canonical production web app domain, used for generated affiliate links, password-reset emails, and as fallback for `getAppUrl()`/`getAppUrlAsync()` (`VITE_APP_URL` env var takes precedence; else `app-config` edge function; else hardcoded fallback `https://afrilink01.vercel.app`) | `src/utils/appUrl.ts` |
| **wa.me / WhatsApp, mailto, tel:** | Support contact channels on Help & Support page: WhatsApp `https://wa.me/255759340243`, email `support@afrilink.com`, phone `+255759340243` | `src/components/dashboard/HelpSupportPage.tsx` |
| **unpkg.com** CDN | Leaflet default marker icon images loaded from `https://unpkg.com/leaflet@1.9.4/dist/images/...` | `VendorLocationPicker.tsx` |
| **images.unsplash.com** | Placeholder/fallback product images; explicitly cached by the PWA service worker (`CacheFirst`, 7-day expiry, max 100 entries) | `vite.config.ts`, various fallback image URLs |

## 7. Capacitor / Android Packaging

`capacitor.config.ts`:
```ts
appId: 'com.kbsoftwares.afrilink'
appName: 'Winger'
webDir: 'dist'
```
- The app is compiled as a standard Vite web build (`dist/`) and wrapped by Capacitor for Android (only `@capacitor/android` is a dependency — no iOS Capacitor package is present, though `docs/MOBILE_DEEPLINKING.md` documents iOS Universal Links too, implying an iOS shell may be built separately/manually).
- Android package name used across configs: `com.kbsoftwares.afrilink`.
- Deep linking (see `docs/MOBILE_DEEPLINKING.md` for full detail) intercepts `https://afrilink01.vercel.app/reset-password*` via Android App Links (`public/.well-known/assetlinks.json`, needs real SHA-256 fingerprint) and iOS Universal Links (`public/.well-known/apple-app-site-association`, needs real Team ID/Bundle ID) so that password-reset emails open directly inside the installed app; falls back to a custom URL scheme `afrilink://reset-password?token=...` via an in-app "Open in AfriLink App" button on the web reset page.

## 8. PWA Configuration (`vite-plugin-pwa` in `vite.config.ts`)

- `registerType: 'autoUpdate'`, `skipWaiting: true`, `clientsClaim: true`, `cleanupOutdatedCaches: true`.
- Manifest: name `"Winger - Africa's Premier Marketplace"`, short_name `"Winger"`, `theme_color: #f59e0b` (amber), `background_color: #0f172a` (slate-900), `display: standalone`, `orientation: portrait`, `scope: /`, `start_url: /`.
- Icons: `/pwa-192x192.png`, `/pwa-512x512.png` (both `purpose: any maskable`).
- Custom service worker import: `sw-push.js` (push notification handling) via `importScripts`.
- Runtime caching: Unsplash images `CacheFirst`, 100-entry cache, 7-day expiry.
- `navigateFallbackDenylist: [/^\/~oauth/]` (excludes OAuth callback path from SPA fallback).
- `index.html` PWA meta: `theme-color #f59e0b`, `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, `apple-mobile-web-app-title: Winger`, `format-detection: telephone=no` (prevents auto phone-number linking), safe-area-inset CSS padding on `<body>`, `overscroll-behavior-y: contain` to block browser pull-to-refresh (app implements its own via `PullToRefresh.tsx`).

## 9. Notable Cross-Cutting Concerns for Flutter Rebuild

- **Two-tier navigation** must be reconciled in Flutter: real routes (`/`, `/reset-password`, `/p/:id`, `/confirm/:id`, `/checkout/confirm`) map naturally to named Flutter routes; the `view` state machine maps more naturally to nested navigation/state within a single "app shell" route or to its own set of named routes with equivalent guard logic (recovery lock, auth guards per view).
- **Affiliate attribution persistence**: `localStorage.affiliateCode` and `?ref=` query param handling need an equivalent (e.g., `SharedPreferences` + deep link handling) since checkout availability on `ProductPage`/marketplace is gated on this value.
- **Guest browsing flag** (`isGuestBrowsing`) changes the marketplace back-button target (back to role-selection vs. no back button) — must be preserved as a piece of navigation state.
- **Role switching** without a fresh login (vendor ↔ affiliate on the same account) impacts almost every dashboard screen's data source.
- **Currency**: all monetary values are integers in TZS, formatted via a shared `formatCurrency` utility (locale-formatted with thousands separators, likely "Tsh" or "TZS" suffix/prefix — inspect `src/utils/currency.ts` at implementation time).
