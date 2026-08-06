# KNOWN LIMITATIONS & MIGRATION RISKS (Part 21)

## Hidden / implicit logic
- **View state machine**: `src/pages/Index.tsx` (~1050 lines) drives most navigation through a single `view` string plus a URL query param, not the router. Every branch must be re-read before porting (see `NAVIGATION.md`); missing a branch silently loses a screen.
- **Role resolution**: active role is not in the database — it lives in `localStorage` under `afrilink_active_role_<userId>` and defaults to the first row in `user_roles`. A fresh Flutter install therefore starts on a possibly different role.
- **Onboarding completion** is inferred from the presence/completeness of `vendor_profiles` / `affiliate_profiles` rows (logo is mandatory to avoid an infinite redirect loop), not from an explicit flag.
- **Guest browsing** uses an `isGuestBrowsing` flag purely in memory; back navigation returns to role selection.
- **Phone verification back button performs a sign-out** — non-obvious UX contract.

## Frontend-only calculations
- Currency formatting (`Tsh`) and commission/earnings previews are computed client-side; authoritative split math lives in `payments-api`. The two must stay in sync.
- Delivery fee preview in checkout mirrors edge-function logic (`delivery_zones`, `cross_city_fees`).
- Affiliate share images are composed in a browser `<canvas>` — this has no direct Flutter equivalent and must be reimplemented with `dart:ui`/`screenshot`.

## Hardcoded values
- Support phone `+255 759 340 243` (WhatsApp + call links).
- Withdrawal fee `2000 TZS`, minimum withdrawal, platform fee percent (some server-side env, some literal in UI).
- External checkout host `shop.afrilink.info`, main app `afrilink01.vercel.app`, Order Guardian `order-guardian.vercel.app`.
- Android package/scheme still `com.kbsoftwares.afrilink`; Android `app_name` is still `Afrilink`.
- Briq SMS `sender_id` is `Afrilink` until the Winger sender ID is approved.

## Missing / partial APIs
- **No search backend**: marketplace search and filters are client-side over an already-fetched list — will not scale and there is no pagination or infinite scroll (see `SEARCH.md`).
- **No reviews/ratings feature** exists despite being commonly expected in a marketplace.
- **No order tracking for buyers** beyond the token-based confirmation page.
- Order Guardian is an external service that has returned 404s ("Upstream error") when routes are undeployed; the Flutter app must degrade gracefully.
- `admin_users` and `push_config` tables have zero RLS policies (fully locked to the client) — admin functionality lives in a separate admin project.

## Duplicate / divergent logic
- Two checkout paths coexist: the in-app `CheckoutModal` (affiliate purchases) and the external `shop.afrilink.info` handoff (marketplace purchases), each with its own attribution mode (`affiliate` vs `marketplace`).
- Two checkout edge functions exist: `checkout-api` (legacy, multi-route) and `checkout` (unified `POST /create`, Briq only, no STUB).
- Two withdrawal modals (`NewWithdrawModal` local wallet vs `ExternalWithdrawModal` Order Guardian) with different fee rules.
- Wallet data has two sources: local `wallets`/`ledger_entries` and the external Order Guardian wallet.

## Technical debt
- `Index.tsx` is a monolith mixing routing, data fetching and presentation.
- Edge functions use `// @ts-nocheck`, so type errors are unverified.
- Icon assets are all byte-identical 985x939 copies rather than correctly sized variants.
- No automated tests exist anywhere in the project.
- Money is stored inconsistently: `numeric` on `orders`/`profiles.wallet_balance`, `integer` (minor units) on `wallets`/`ledger_entries`/`payout_requests`. **This is the highest-risk item for a rebuild — confirm units per table before writing any Dart model.**
- Realtime requires `REPLICA IDENTITY FULL` on `notifications`, `wallets`, `orders`, `ledger_entries`; if the backend is rebuilt this must be reapplied.

## Migration risks
- Web Push (`sw-push.js`, VAPID) has no Flutter equivalent — a FCM/APNs migration plus a `push-api` change is required.
- PWA install prompt, `URL.createObjectURL`, and service-worker update strategy are browser-only concepts with no port.
- Leaflet/OSM Nominatim geocoding must be replaced; Nominatim usage policy differs from Google Maps.
- Deep links currently rely on the web domains; App Links/Universal Links verification files must remain hosted after the web app is retired.
- If the Lovable project is deleted, the **backend Supabase project must be preserved or rebuilt from `WINGER_BACKEND_MASTER_EXPORT.md`** — these Flutter docs describe the client only.
