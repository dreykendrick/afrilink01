# PART 18 — Configuration, Environment Variables & Constants

## 18.1 Environment variables

### Client-side (`VITE_*`, embedded in the JS bundle at build time — NOT secret, visible to any user)
Declared in `.env.example` and read via `import.meta.env.*`:

| Variable | Purpose | Where used |
|---|---|---|
| `VITE_SUPABASE_URL` | Base URL of the Supabase project (used to build all Edge Function URLs, e.g. `${VITE_SUPABASE_URL}/functions/v1/...`) | `src/integrations/supabase/client.ts`, `CheckoutModal.tsx`, `DashboardNav.tsx`, `WalletSection.tsx`, `LedgerHistory.tsx`, `VendorOrders.tsx`, `VendorWalletExternal.tsx`, `NewWithdrawModal.tsx`, `ExternalWithdrawModal.tsx`, `ProductPage.tsx`, `CheckoutConfirmPage.tsx` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable API key | `src/integrations/supabase/client.ts`, `usePushNotifications.tsx` (as `apikey` header for direct `fetch` calls to Edge Functions) |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref, used to construct `https://{id}.supabase.co/functions/v1/...` URLs directly (bypassing the SDK) | `usePushNotifications.tsx` |
| `VITE_APP_URL` | Canonical production app URL (default in example: `https://afrilink01.vercel.app`) — used for all externally-shared links (affiliate links, reset-password redirect, order confirmation links) so links never point at a preview/Lovable domain | `src/utils/appUrl.ts`, `src/utils/resetUrl.ts` |
| `VITE_DEMO_MODE` | Feature flag: `"true"`/`"false"` string. When `"true"`, checkout falls back to showing an in-app receipt screen instead of requiring a real payment redirect | `CheckoutModal.tsx` (`IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'`) |

`src/vite-env.d.ts` only contains the standard `/// <reference types="vite/client" />` — there is **no custom `ImportMetaEnv` typing/augmentation** declared for these variables, so they are typed as `any`/`string | undefined` by default Vite types.

### Server-side / secret (names only — used by Supabase Edge Functions, NOT present in client bundle; documented in `.env.example` comments for ops reference)

| Variable | Purpose |
|---|---|
| `PAYMENT_PROVIDER_MODE` | `STUB` (test, no real payment) or `LIVE` (real Briq/MeetPay integration) |
| `PLATFORM_FEE_PERCENT` | Platform commission fee percentage applied to product subtotal (delivery excluded) |
| `MIN_WITHDRAWAL_TZS` | Minimum wallet withdrawal amount, in TZS |
| `CURRENCY_DEFAULT` | Default currency code (`TZS`) |
| `BRIQ_BASE_URL` | Base URL of the Briq payment gateway API |
| `BRIQ_API_KEY` | Briq API key (required for LIVE mode) |
| `BRIQ_DEVELOPER_APP_ID` | Optional Briq developer app identifier included in payment requests |
| `BRIQ_WEBHOOK_SECRET` | Optional secret used to verify Briq webhook signatures |

Switching to LIVE mode (per `.env.example` comments) requires setting `PAYMENT_PROVIDER_MODE=LIVE`, providing `BRIQ_API_KEY`/`BRIQ_BASE_URL`/optionally `BRIQ_DEVELOPER_APP_ID`, and redeploying edge functions. In LIVE mode, payment creation redirects to Briq's hosted checkout, and confirmation/webhooks are verified server-side against Briq before crediting wallets, with idempotency protecting against double-crediting.

**Never surface actual secret values in any doc or log — only names/purposes as done above.**

## 18.2 Feature flags
- `VITE_DEMO_MODE` (see above) is the only client-visible feature flag found. There is no remote feature-flag service (e.g. LaunchDarkly) — flags are plain env vars baked in at build time, meaning toggling requires a rebuild/redeploy, not a runtime switch.
- `import.meta.env.DEV` (Vite-provided, not a custom var) is used pervasively to gate `console.log` debug output (e.g. `Index.tsx` buy-now redirect log, `CheckoutModal.tsx` payload/response logs, `checkoutHandoff.ts`, `appUrl.ts`, `VendorProfileSetup.tsx`). This is standard Vite dev/prod distinction, not app-level config.

## 18.3 External API base URLs
| Base URL | Purpose |
|---|---|
| `{VITE_SUPABASE_URL}` (Supabase project URL) | Supabase REST/Auth/Realtime + all custom Edge Functions under `/functions/v1/...`: `checkout-api`, `payments-api`, `order-guardian`, `push-api`, `app-config`, `admin-actions`, `auth-email-hook`, `send-otp`, `verify-otp` |
| `https://shop.afrilink.info` | External standalone checkout/marketplace storefront that the main app hands off single-product purchases to (`src/utils/checkoutHandoff.ts`, `CHECKOUT_BASE_URL` constant). Route pattern: `/p/{slug-or-id}?source=...&ref=...&qty=...&vendor=...` |
| `https://afrilink01.vercel.app` | Hard-coded `FALLBACK_APP_URL` in `src/utils/appUrl.ts`, used only if `VITE_APP_URL` is unset AND no cached value exists in `localStorage`. Also the default value shown in `.env.example` for `VITE_APP_URL`. |
| `order-guardian.vercel.app` (referenced in the task, corresponds to the `order-guardian` Edge Function namespace under Supabase functions, e.g. `.../functions/v1/order-guardian/{orders,wallet,withdrawals}`) | Vendor order management, wallet, and withdrawal endpoints — reached via the Supabase Edge Function path, not a separate hostname, in the code reviewed (`VendorOrders.tsx`, `VendorWalletExternal.tsx`, `ExternalWithdrawModal.tsx`) |
| `https://paygrid.briq.tz` | Briq payment gateway base URL (server-side only, `BRIQ_BASE_URL` default per `.env.example`), used for real payment processing in LIVE mode |
| `https://images.unsplash.com` | Placeholder/stock product image host; also explicitly cached via a Workbox `CacheFirst` runtime-caching rule (see PERFORMANCE.md) and used as the hardcoded fallback product image URL (`'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80'`) whenever a product has no `image_url` |

## 18.4 Constants & magic numbers found in code

| Constant | Value | Location | Meaning |
|---|---|---|---|
| Support phone number | `+255 759 340 243` (tel link `tel:+255759340243`) | `src/components/dashboard/HelpSupportPage.tsx` | Customer support contact number |
| Phone format examples/placeholders | `+255XXXXXXXXX` / `0XXXXXXXXX` | `src/utils/phone.ts`, `CheckoutModal.tsx`, `PhoneVerificationFlow.tsx`, `RegistrationFlow.tsx`, `NewWithdrawModal.tsx`, `ExternalWithdrawModal.tsx` | Tanzania phone number formats accepted |
| TZ phone length rules | `+255` prefix ⇒ total length 13; `0` prefix ⇒ length 10; bare `255` prefix ⇒ length 12 | `src/utils/phone.ts` (`validateTZPhone`) | Validation/normalization thresholds; normalizes all valid forms to `+255XXXXXXXXX` |
| Commission filter thresholds | `5, 10, 15, 20` (percent, `>=`) | `Index.tsx` filter logic | Marketplace commission filter bands (see SEARCH.md) |
| Price filter bands (TZS) | `50000`, `100000`, `500000` | `Index.tsx` filter logic | Marketplace price filter bands (see SEARCH.md) |
| Notification fetch limit | `20` | `src/hooks/useNotifications.tsx` (`.limit(20)`) | Max notifications fetched per load (no pagination beyond this) |
| Pull-to-refresh threshold | `80` (px) | `src/components/mobile/PullToRefresh.tsx` (`threshold`) | Distance the user must pull before a refresh triggers |
| Pull-to-refresh max pull distance | `120` (px) | Same file (`maxPull`) | Visual cap on how far the pull indicator can travel |
| Pull-to-refresh resistance factor | `0.4` | Same file | Multiplier applied to raw touch delta to simulate elastic resistance |
| Mobile breakpoint | `768` px | `src/hooks/use-mobile.tsx` (`MOBILE_BREAKPOINT`) | `max-width: 767px` query defines "mobile" for `useIsMobile()` |
| Image cache max entries | `100` | `vite.config.ts` (Workbox `runtimeCaching` for Unsplash images) | LRU cap for the `image-cache` cache bucket |
| Image cache max age | `60 * 60 * 24 * 7` seconds (7 days) | Same location | TTL for cached Unsplash images |
| Fallback/placeholder product image | `https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80` | `Index.tsx` (multiple product-mapping call sites) | Used whenever a product has no `image_url` |
| Onboarding-seen flag key | `afrilink_onboarding_seen` | `Index.tsx`, `localStorage` | Marks that the onboarding carousel has already been shown |
| Active-role-per-user localStorage key pattern | `afrilink_active_role_{userId}` | `src/hooks/useAuth.tsx` | Persists which role (vendor/affiliate) is active for a given user id |
| Canonical app URL cache key | `afrilink_app_url` | `src/utils/appUrl.ts` (`STORAGE_KEY`) | Caches the resolved canonical app URL fetched from the `app-config` Edge Function |
| Cart localStorage key | `cart` | `src/hooks/useCart.tsx` | Persisted cart items JSON |
| Affiliate code localStorage key | `affiliateCode` | `src/hooks/useCart.tsx` | Persisted last-seen affiliate referral code |
| Reset-password path | `/reset-password` | `src/utils/resetUrl.ts` (`RESET_PATH`) | Path appended to canonical app URL for Supabase password-reset redirects |
| Deep-link scheme | `afrilink://` | `src/utils/resetUrl.ts` (`DEEP_LINK_SCHEME`) | Planned/partial native deep-link scheme for mobile password reset (marked as Phase 2 TODO, not fully wired) |
| Android package / app id | `com.kbsoftwares.afrilink` | `capacitor.config.ts`; referenced again in `resetUrl.ts` TODO comments for App Links | Native app identifier for Capacitor Android/iOS builds |
| Capacitor app name | `Winger` | `capacitor.config.ts` | Native app display name |
| Capacitor web asset dir | `dist` | `capacitor.config.ts` (`webDir`) | Build output directory bundled into the native shell |
| Supabase project id | `ckklirhhwndijsjpmnfe` | `supabase/config.toml` | Backend project reference used by Supabase CLI tooling |
| PWA theme color | `#f59e0b` (amber) | `vite.config.ts` (VitePWA manifest) | Manifest `theme_color` |
| PWA background color | `#0f172a` (dark slate) | `vite.config.ts` | Manifest `background_color` |
| PWA icon sizes | `192x192`, `512x512` | `vite.config.ts` | Standard maskable app icons |
| Product slug truncation | first `6` chars of product id appended to slugified title | `src/utils/slug.ts` (`getProductSlug`) | Slug uniqueness strategy |
| Affiliate code generation format | `{userId.slice(0,6)}_{productId.slice(0,6)}_{Date.now().toString(36)}` | `Index.tsx` (`handleGenerateLink`) | Unique-ish affiliate link code, client-generated (not server-guaranteed unique beyond DB constraint, if any) |
| Vercel rewrite | `/(.*) -> /` | `vercel.json` | SPA catch-all rewrite so client-side routing works on refresh |
| Well-known content-type headers | `application/json` for `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association` | `vercel.json` | Required for Android App Links / iOS Universal Links verification files |

## 18.5 Config files

### `vite.config.ts`
- Dev server: `host: '::'` (all interfaces, IPv6+IPv4), `port: 8080`.
- Plugins: `@vitejs/plugin-react-swc`, `lovable-tagger`'s `componentTagger()` (development mode only), `vite-plugin-pwa` (`VitePWA`).
- Path alias: `@` → `./src`.
- PWA config: `registerType: 'autoUpdate'`, precaches `favicon.ico`/`pwa-192x192.png`/`pwa-512x512.png`; manifest as described above (`name: "Winger - Africa's Premier Marketplace"`, `short_name: "Winger"`, `display: 'standalone'`, `orientation: 'portrait'`, `scope: '/'`, `start_url: '/'`). Workbox options: `skipWaiting: true`, `clientsClaim: true`, `cleanupOutdatedCaches: true`, an extra `importScripts: ['/sw-push.js']` (custom push-notification service worker logic layered onto the generated one), `globPatterns` for common static asset types, one `runtimeCaching` rule (`CacheFirst` for Unsplash images, described above), and `navigateFallbackDenylist: [/^\/~oauth/]` (so OAuth callback paths aren't served the SPA shell).

### `capacitor.config.ts`
- `appId: 'com.kbsoftwares.afrilink'`, `appName: 'Winger'`, `webDir: 'dist'` — minimal config, no plugins configured explicitly in this file (any native plugin config would live elsewhere, none found in scope).

### `vercel.json`
- Sets `Content-Type: application/json` headers for the two `.well-known` verification files (App Links/Universal Links).
- SPA rewrite: every path (`/(.*)`) rewrites to `/`, letting the client-side view/router logic in `Index.tsx` + React Router handle real navigation.

### `tailwind.config.ts`
- `darkMode: ['class']` (matches `next-themes` `attribute="class"` usage).
- Content globs cover `pages/`, `components/`, `app/`, and `src/**` (`.ts`/`.tsx`).
- No `prefix` (`prefix: ""`).
- Extended theme is entirely CSS-variable driven (`hsl(var(--...))`) — colors: `border`, `input`, `ring`, `background`, `foreground`, `primary`, `secondary`, `destructive`, `muted`, `accent`, `popover`, `card`, `sidebar.*`, and a custom `afrilink.*` palette (`amber`, `orange`, `purple`, `slate.900/800/700`, `green`, `blue`, `pink`) — these are the brand colors a Flutter theme should mirror.
- Custom gradients (`gradient-primary`, `gradient-hero`, `gradient-card`, `gradient-green`, `gradient-blue`, `gradient-purple`), shadows (`shadow-glow`, `shadow-card`), and border radius scale derived from a single `--radius` CSS variable (`lg` = full, `md` = `-2px`, `sm` = `-4px`).
- Only custom animation defined: `accordion-down`/`accordion-up` keyframes (Radix accordion support), `0.2s ease-out`.
- Uses the `tailwindcss-animate` plugin.

### `supabase/config.toml`
- `project_id = "ckklirhhwndijsjpmnfe"`.
- Declares JWT verification is **disabled** (`verify_jwt = false`) for these Edge Functions: `admin-actions`, `auth-email-hook`, `checkout-api`, `payments-api`, `send-otp`, `verify-otp` — meaning these functions implement their own auth/security checks internally rather than relying on Supabase's automatic JWT gate (important for a Flutter/backend-parity rebuild to replicate the same internal authorization logic, not assume the platform handles it).

## 18.6 i18n configuration (`src/i18n/config.ts`)
- Library: `i18next` + `react-i18next` + `i18next-browser-languagedetector`.
- Languages bundled: `en` (English), `sw` (Swahili / "Kiswahili"), `fr` (French / "Français") — defined in an exported `languages` array with `{ code, name, nativeName }`, plus an exported `LanguageCode` union type derived from it.
- Resources are statically imported JSON files (`./locales/en.json`, `sw.json`, `fr.json`) — all three locale bundles are always included in the client bundle (no lazy/async loading per locale).
- `fallbackLng: 'en'`.
- `interpolation.escapeValue: false` (React already escapes, so i18next doesn't need to).
- `detection.order: ['localStorage', 'navigator']`, `detection.caches: ['localStorage']` — prefers a previously-saved language choice over browser locale, and persists any detected/changed language back to `localStorage`.
- `react.useSuspense: false` — translated components render immediately with fallback/key text rather than suspending while translations load; since resources are bundled synchronously this mostly matters only for edge cases/timing, but it does mean there is no `<Suspense>` boundary requirement anywhere translations are used.
- Guarded by `if (!i18n.isInitialized)` so `main.tsx`'s `import './i18n/config'` is idempotent even if re-evaluated (e.g. HMR).
