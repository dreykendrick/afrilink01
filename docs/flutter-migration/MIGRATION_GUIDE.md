# FLUTTER REBUILD GUIDE (Parts 20 & 22)

Read alongside: `APP_OVERVIEW.md`, `SCREENS.md`, `NAVIGATION.md`, `USER_FLOWS.md`, `BUSINESS_RULES.md`, `VALIDATION.md`, `API_REFERENCE.md`, `AUTHENTICATION.md`, `DESIGN_SYSTEM.md`, `COMPONENT_LIBRARY.md`, `STATE_MANAGEMENT.md`, `NOTIFICATIONS.md`, `SEARCH.md`, `PERFORMANCE.md`, `CONFIGURATION.md`, `DEPENDENCIES.md`, `ERROR_HANDLING.md`, `MEDIA.md`, `KNOWN_LIMITATIONS.md`.

## 1. Recommended architecture
Feature-first Clean Architecture: `presentation` (widgets + controllers) / `domain` (entities, use-cases) / `data` (DTOs, repositories, datasources). The backend stays exactly as-is (Supabase + edge functions) — Flutter replaces the frontend only.

## 2. Folder structure
```
lib/
  main.dart
  app/            app widget, router, theme, bootstrap, DI setup
  core/           constants, env, errors, network, utils (currency, phone, slug, appUrl)
  l10n/           en / sw / fr ARB files
  features/
    auth/         login, signup, forgot/reset password, otp
    onboarding/   role selection, carousel, vendor & affiliate profile setup
    marketplace/  listing, filters, product detail, product card
    cart/         cart state, drawer, checkout modal, external handoff
    orders/       order confirmation, vendor orders (Order Guardian)
    wallet/       balance, ledger, withdrawals
    products/     vendor product CRUD, images, availability, takedown
    affiliate/    links, share images, stats
    notifications/ in-app list, realtime, push
    settings/     profile, avatar/logo, language, theme, help & support
  shared/         reusable widgets mirroring COMPONENT_LIBRARY.md
```

## 3. State management
`flutter_riverpod` (or `bloc` if the team prefers). Map current providers 1:1:
- `AuthProvider` -> `authControllerProvider` (StreamProvider over `Supabase.auth.onAuthStateChange` + roles fetch; keep the "listener first, then getSession" ordering; the React `setTimeout(...,0)` deadlock hack is unnecessary in Dart).
- `CartProvider` -> `cartControllerProvider` (persist to `shared_preferences`; clear on sign-out; keep mandatory `vendorId` per item).
- `ThemeProvider` -> `themeModeProvider` (default dark, system-aware).
- TanStack Query -> Riverpod `FutureProvider`/`AsyncNotifier` with explicit refresh; keep pull-to-refresh via `RefreshIndicator`.
- The `view` string state machine in `Index.tsx` becomes real routes (see below) — do not port the string switch.

## 4. Routing
`go_router` with typed routes. Replace the query-param view persistence with real paths:
`/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding/*`, `/verify-phone`, `/dashboard`, `/orders`, `/wallet`, `/settings`, `/help`, `/marketplace`, `/p/:idOrSlug`, `/cart`, `/checkout/confirm`, `/confirm/:orderId`.
Use `redirect` for auth/onboarding/verification guards. Register deep links: `afrilink://` custom scheme plus App Links / Universal Links using the existing `assetlinks.json` and `apple-app-site-association`.

## 5. Networking
`supabase_flutter` for auth, PostgREST, storage, realtime and `functions.invoke`. Wrap in repositories; centralise error translation through a Dart port of `getUserFriendlyError` (see `ERROR_HANDLING.md`). Use `dio` only for the external Order Guardian / Briq calls that already go through edge-function proxies — prefer keeping the proxy so secrets stay server-side.

## 6. Dependency injection
Riverpod providers as the DI container (`supabaseClientProvider` -> datasources -> repositories -> controllers). No `get_it` needed.

## 7. Caching & offline
- `shared_preferences` for session-adjacent prefs (active role key `afrilink_active_role_<userId>`, language, theme, cart).
- `cached_network_image` for product images, vendor logos, avatars.
- Optional `drift`/`hive` read-cache for the marketplace list; **do not** cache orders or wallet data locally (Order Guardian rule: always fetch live).
- Offline: show a connectivity banner (`connectivity_plus`) and a retry action — the web app currently has no offline mode.

## 8. Localization
`flutter_localizations` + ARB, seeded from `src/i18n/locales/{en,sw,fr}.json`. Device-locale detection with EN fallback.

## 9. Media & platform
`image_picker` + `flutter_image_compress` (enforce 5 MB, reject HEIC/HEIF), Supabase Storage upload to the same bucket paths. `share_plus` for affiliate share images, `flutter_map` or `google_maps_flutter` for the vendor location picker (current app uses Leaflet + OSM Nominatim geocoding for Tanzania).

## 10. Notifications
Replace Web Push with `firebase_messaging` (+ APNs). Keep the `push_subscriptions` table shape but store FCM tokens; the `push-api` edge function needs an FCM branch. Keep Supabase realtime subscriptions for `notifications`, `wallets`, `orders`, `ledger_entries`.

## 11. Theming
Port the CSS custom properties in `DESIGN_SYSTEM.md` into a `ThemeData` colour scheme (light + dark). Dark is the default. Never hardcode colours in widgets — use the theme extension.

## 12. Testing
Unit tests for currency/phone/slug/commission-split logic, repository tests against a staging Supabase project, widget tests for forms and validation messages, integration tests for signup -> onboarding -> product publish and browse -> cart -> checkout.

## 13. Suggested build order
1. Theme + design tokens + shared widgets.
2. Supabase bootstrap, auth, session persistence, role handling.
3. Onboarding (role selection, OTP, vendor/affiliate profile setup).
4. Marketplace browse + product detail (works for guests).
5. Cart + checkout + order confirmation.
6. Vendor dashboard: products CRUD, orders, wallet, withdrawals.
7. Affiliate dashboard: links, stats, share images.
8. Notifications (in-app + realtime + push).
9. Settings, help, localization, theming polish.
