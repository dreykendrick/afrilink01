# PART 19 — Dependencies, Internal Utilities, Hooks & Providers

This document exhaustively catalogs every npm dependency in `package.json`, internal `src/utils/*` helpers, custom hooks in `src/hooks/*`, context providers, Capacitor plugins, and Deno edge-function imports used by the Winger app, with notes on where each is used and the closest Flutter/pub.dev equivalent.

---

## 1. `dependencies`

| Package | Version | Purpose | Used where in this codebase | Closest Flutter/pub.dev equivalent |
|---|---|---|---|---|
| `@capacitor/android` | ^8.0.2 | Capacitor's Android native runtime, wraps the web app into a native Android shell. | Native Android build target (no direct JS import found in `src/`; used via `capacitor.config.ts` + `npx cap` tooling). | N/A — Flutter compiles natively to Android, no wrapper needed. |
| `@capacitor/cli` | ^8.0.2 | CLI for building/syncing Capacitor native projects. | Build tooling only. | `flutter` CLI / `flutter build apk`. |
| `@capacitor/core` | ^8.0.2 | Core Capacitor JS bridge/runtime. | Present but no explicit plugin imports found in `src/` (grep found no `Capacitor.` or `@capacitor/*` plugin usage beyond core+android+cli deps) — i.e., project is currently a PWA wrapped by Capacitor shell with no native plugin calls wired up yet. | Not needed; Flutter has native platform channels built-in. |
| `@hookform/resolvers` | ^3.10.0 | Adapter connecting `zod` schemas to `react-hook-form` validation. | Form validation resolvers across auth/onboarding/dashboard forms using `zodResolver`. | `flutter_form_builder` + custom validators, or `reactive_forms` with schema validation. |
| `@radix-ui/react-*` (accordion, alert-dialog, aspect-ratio, avatar, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toast, toggle, toggle-group, tooltip) | various ^1.x/^2.x | Unstyled, accessible headless UI primitives that back all `src/components/ui/*` shadcn components. | Every shadcn/ui component wrapper in `src/components/ui/` (accordion.tsx, dialog.tsx, dropdown-menu.tsx, select.tsx, tabs.tsx, toast.tsx, tooltip.tsx, etc.) used pervasively across the whole app. | Flutter's built-in Material/Cupertino widgets (`Dialog`, `PopupMenuButton`, `DropdownButton`, `TabBar`, `Tooltip`, `Switch`, `Checkbox`, `Slider`, `ExpansionTile` for accordion). No 1:1 package needed — Flutter provides these as first-class widgets. |
| `@supabase/supabase-js` | ^2.93.2 | Supabase JS client: auth, Postgres queries via PostgREST, realtime channels, storage, edge function invocation. | `src/integrations/supabase/client.ts` (client singleton), used throughout hooks (`useAuth`, `useNotifications`, etc.) and nearly every data-fetching component. | `supabase_flutter` (official Supabase Flutter SDK). |
| `@tanstack/react-query` | ^5.83.0 | Server-state caching/fetching library (queries, mutations, cache invalidation). | Used across dashboard/data-fetching components for querying Supabase data with caching, likely wrapped in a `QueryClientProvider` at app root. | `flutter_riverpod` with `AsyncValue`, or `flutter_query` / manual `FutureProvider` caching. |
| `@types/leaflet` | ^1.9.21 | TypeScript type definitions for Leaflet maps. | Type support only for `leaflet` usage. | N/A (Dart is statically typed already). |
| `class-variance-authority` (cva) | ^0.7.1 | Utility to build variant-based conditional className strings (used by all shadcn/ui components e.g. `toastVariants`, `buttonVariants`). | `src/components/ui/toast.tsx`, `button.tsx`, `badge.tsx`, etc. | Not applicable — Flutter uses `ThemeData`/widget style objects instead of conditional className generation. |
| `clsx` | ^2.1.1 | Conditionally join className strings. | `src/lib/utils.ts` (`cn()` helper). | N/A — Flutter doesn't use className strings. |
| `cmdk` | ^1.1.1 | Command-menu / palette component (⌘K style). | Powers the shadcn `Command` component (`src/components/ui/command.tsx`) if present in project. | `flutter_command_palette` or custom `showSearch` implementation. |
| `date-fns` | ^3.6.0 | Date formatting/manipulation utility library. | Formatting dates in dashboards (orders, ledger, notifications timestamps). | `intl` package (`DateFormat`) or `jiffy`. |
| `embla-carousel-react` | ^8.6.0 | Lightweight carousel/slider library. | Backs `src/components/ui/carousel.tsx` (product image carousels, banners). | `carousel_slider` or Flutter's built-in `PageView`. |
| `i18next` | ^25.8.0 | Core internationalization framework. | Configured for the app's translation system (English + possibly Swahili), paired with `react-i18next`. | `easy_localization` or `flutter_localizations` + `intl`. |
| `i18next-browser-languagedetector` | ^8.2.0 | Detects user's browser/device language for i18next. | Used in i18n init config to auto-select locale. | `Platform.localeName` / `flutter_localizations` `WidgetsBinding.instance.window.locale`. |
| `input-otp` | ^1.4.2 | One-time-password input component (segmented digit boxes). | Phone/OTP verification screens (`VerificationForm.tsx`, `PhoneVerificationFlow.tsx`). | `pinput` package. |
| `leaflet` | ^1.9.4 | Open-source interactive maps library. | Any map display (e.g., vendor location picking) referencing Leaflet. | `flutter_map` (with OpenStreetMap tiles) or `google_maps_flutter`. |
| `lucide-react` | ^0.462.0 | Icon set (SVG icon React components). | Icons throughout the entire UI (buttons, nav, cards, toasts' X icon, etc.). | `lucide_icons` Flutter package (official Lucide port) or Material Icons. |
| `next-themes` | ^0.3.0 | Theme (dark/light) provider/switcher, originally for Next.js but works standalone. | `src/components/ui/sonner.tsx` uses `useTheme()` to sync Sonner toast theme; likely a `ThemeProvider` wraps the app root for light/dark mode toggling. | `ThemeMode` + `ThemeData`/`Provider`/`flutter_riverpod` theme controller. |
| `react` | ^18.3.1 | Core React library. | Entire app. | Flutter framework itself (Dart, widget tree). |
| `react-day-picker` | ^8.10.1 | Calendar/date-picker component. | Backs shadcn `Calendar` component (`src/components/ui/calendar.tsx`) for date selection in forms. | `table_calendar` or `showDatePicker` (Material built-in). |
| `react-dom` | ^18.3.1 | React DOM renderer. | App entry (`main.tsx`). | N/A (Flutter renders via Skia/Impeller, no DOM). |
| `react-hook-form` | ^7.61.1 | Form state management/validation library. | All forms: login, signup, product forms, withdraw modals, onboarding flows. | `flutter_form_builder` or `reactive_forms`. |
| `react-i18next` | ^16.5.4 | React bindings for i18next (`useTranslation`, `t()`). | `t('cart.empty')` and similar calls seen in `CartDrawer.tsx`; used broadly for translated strings. | `easy_localization`'s `tr()` / `context.tr()`, or generated `AppLocalizations`. |
| `react-resizable-panels` | ^2.1.9 | Resizable split-pane layout component. | Backs shadcn `resizable.tsx` component (desktop dashboard layouts, if used). | `flutter_split_view` or manual `Draggable`/`Flexible` layout. |
| `react-router-dom` | ^6.30.1 | Client-side routing/navigation. | App-wide route definitions (`App.tsx`), `useLocation`/`useNavigate` used in `NotFound.tsx` and elsewhere. | `go_router` (recommended) or Navigator 2.0. |
| `recharts` | ^2.15.4 | Charting library (line/bar/pie charts) built on D3. | Dashboard analytics/earnings charts for vendors/affiliates. | `fl_chart` or `syncfusion_flutter_charts`. |
| `sonner` | ^1.7.4 | Toast notification library (the "modern" toaster, alternative/complement to Radix toast). | `src/components/ui/sonner.tsx`; `toast.error(...)`/`toast.success(...)` calls e.g., `toast.error('Your cart is empty')` in `Index.tsx`. | `fluttertoast` or `flutter_toast_x`, or a custom `SnackBar`/overlay-based toast system. |
| `tailwind-merge` | ^2.6.0 | Merges conflicting Tailwind classes intelligently. | `src/lib/utils.ts` `cn()` helper (combined with `clsx`). | N/A — no Tailwind equivalent needed in Flutter (use `ThemeData`/design tokens). |
| `tailwindcss-animate` | ^1.0.7 | Tailwind plugin providing animation utility classes (used by Radix state-driven animations, e.g. toast slide-in/out). | Toast/dialog/dropdown open/close animation classes throughout `ui/*` components. | Flutter's built-in `AnimatedContainer`, `Hero`, `implicit animations`, or `flutter_animate` package. |
| `vaul` | ^0.9.9 | Drawer/bottom-sheet component (mobile-friendly). | Backs shadcn `Drawer` component — likely used for mobile cart drawer (`CartDrawer.tsx`) or mobile menus. | `showModalBottomSheet` (Material built-in) or `wolt_modal_sheet`. |
| `vite-plugin-pwa` | ^1.2.0 | Vite plugin generating PWA manifest + service worker (Workbox) for installable web app / offline caching. | Configured in `vite.config.ts` (see manifest details in ERROR_HANDLING.md offline section); generates `sw.js`, imports `/sw-push.js` for push notification handling. | N/A for native Flutter apps; for Flutter Web PWA support use `flutter build web --pwa-strategy` and manually configure `manifest.json`/service worker, or ignore since native app doesn't need PWA install semantics. |
| `zod` | ^3.25.76 | Schema validation library (TypeScript-first). | Paired with `@hookform/resolvers` for validating all forms (signup, product creation, withdrawal amounts, etc.). | No exact match — validation typically done manually or via `json_serializable` + custom validators, or `flutter_form_builder` validators. |

## 2. `devDependencies`

| Package | Version | Purpose | Used where | Flutter equivalent |
|---|---|---|---|---|
| `@eslint/js` | ^9.32.0 | ESLint base JS rule config. | Lint tooling. | `flutter_lints` / `dart analyze`. |
| `@lovable.dev/vite-plugin-dev-server-bridge` | ^1.0.2 | Lovable platform's dev-server integration plugin (build tooling internal to Lovable editor). | `vite.config.ts` plugin pipeline (not shown explicitly in the viewed config but declared as devDependency for the Lovable environment). | N/A — Lovable-specific tooling, irrelevant to Flutter rebuild. |
| `@lovable.dev/vite-plugin-hmr-gate` | ^1.3.4 | Lovable HMR gating plugin for the dev preview environment. | Dev tooling only. | N/A. |
| `@tailwindcss/typography` | ^0.5.16 | Tailwind plugin for prose/typography styling (e.g., markdown/rich text content). | Tailwind config for any long-form text blocks (help/FAQ pages, terms). | Flutter's `Text`/`RichText` styling, or `flutter_markdown` package's stylesheet. |
| `@types/node` | ^22.16.5 | TypeScript types for Node.js APIs. | Build config type-checking (`vite.config.ts`). | N/A. |
| `@types/react`, `@types/react-dom` | ^18.3.x | TypeScript types for React/ReactDOM. | Type-checking entire app. | N/A (Dart typed natively). |
| `@vitejs/plugin-react-swc` | ^3.11.0 | Vite plugin using SWC compiler for fast React Fast Refresh. | `vite.config.ts` (`react()` plugin). | N/A — Flutter uses its own toolchain (`flutter run` hot reload). |
| `autoprefixer` | ^10.4.21 | PostCSS plugin adding vendor prefixes to CSS. | Tailwind/PostCSS build pipeline. | N/A. |
| `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`, `globals` | various | Linting toolchain enforcing code quality/hooks rules. | Project-wide lint config (`eslint.config.js`). | `flutter_lints` package + `analysis_options.yaml`. |
| `lovable-tagger` | ^1.1.11 | Lovable-specific dev plugin that tags JSX elements with source location metadata for the visual editor. | `vite.config.ts` (`componentTagger()` in dev mode only). | N/A — Lovable-editor-specific, irrelevant to Flutter. |
| `postcss` | ^8.5.6 | CSS transformation tool underpinning Tailwind. | Build pipeline. | N/A. |
| `tailwindcss` | ^3.4.17 | Utility-first CSS framework — the styling system for the entire UI. | Every component's `className` styling. | N/A — replaced by Flutter's `ThemeData`, `TextStyle`, and widget composition; consider a design-token mapping doc separately. |
| `typescript` | ^5.8.3 | TypeScript compiler. | Entire codebase type system. | Dart's built-in static typing. |
| `vite` | ^7.3.1 | Build tool/dev server. | Project build system (`vite.config.ts`, `npm run dev/build`). | `flutter build` / `flutter run` tooling. |

---

## 3. Internal Utilities (`src/utils/*`)

### `src/utils/appUrl.ts`
Centralizes resolution of the canonical production app URL, used for all externally shared links (affiliate links, share/copy links, email redirects, order confirmation links).

- **Constants**: `STORAGE_KEY = 'afrilink_app_url'`; `LOVABLE_HOST_RE` regex matching `*.lovableproject.com` / `*.lovable.app` hosts; `FALLBACK_APP_URL = 'https://afrilink01.vercel.app'`.
- **`normalizeUrl(url)`**: strips trailing slashes.
- **`readCachedUrl()` / `writeCachedUrl(url)`**: get/set the canonical URL in `localStorage` under `afrilink_app_url`, silently swallowing storage errors.
- **`getAppUrl()`** (sync): Returns `import.meta.env.VITE_APP_URL` if set (normalized). Else returns cached localStorage value if present. Else, in production (`!import.meta.env.DEV`), logs a `console.warn` and returns the hard-coded `FALLBACK_APP_URL`. **Never** falls back to `window.location.origin` in production.
- **`getAppUrlAsync()`** (async): Same precedence as sync version, but if neither env var nor cache exists, invokes the Supabase edge function `app-config` (via `supabase.functions.invoke('app-config')`) to fetch `appUrl`/`app_url` from the backend, caches it, and returns it. Deduplicates concurrent calls via an `inFlight` promise. On any invoke error, silently falls through to the hard-coded fallback (with a dev-only console warning suppressed, non-dev warns).
- **`maybeRedirectToCanonicalDomain()`**: If the URL contains `__lovable_token` query param (Lovable editor preview), primes the URL cache via `getAppUrlAsync()` but does **not** redirect. Otherwise, if the current hostname matches the Lovable preview regex, resolves the canonical URL and does a `window.location.replace(...)` to the canonical host, preserving path/query/hash. All exceptions are silently swallowed.

### `src/utils/checkoutHandoff.ts`
Handles handoff of marketplace purchases to an **external** checkout system hosted at `https://shop.afrilink.info`, since that external system only supports single-product checkout (route pattern `/p/{slug}?source=marketplace`).

- **`buildCheckoutUrl(slugOrId, options)`**: Builds a URL `https://shop.afrilink.info/p/{slugOrId}` with optional query params: `source`, `ref` (affiliate code — only attached if `affiliateCode` truthy), `qty` (only if quantity > 1), `vendor` (vendorId).
- **`performMarketplaceCheckoutHandoff({ items, affiliateCode, purchaseMode })`**: Takes the **first item only** from the cart array (multi-item carts are processed one at a time; remaining items stay in cart). Uses `item.slug || item.id` as the identifier. Sets `source: 'MARKETPLACE'` only when `purchaseMode === 'marketplace'`; sets `ref` only when `purchaseMode === 'affiliate'` (using `affiliateCode`, else `null`). Passes `quantity` and `vendorId`. Returns `{ handedOffItemId, redirectUrl }` or `null` if the cart is empty. In dev mode (`import.meta.env.DEV`), logs verbose `console.log` diagnostics about the handoff (product id/slug/title, purchase mode, affiliate code, redirect URL, remaining item count) and logs when there are no items to check out.

### `src/utils/currency.ts`
- **`formatCurrency(amount: number): string`** — Returns `` `Tsh ${amount.toLocaleString()}` `` (Tanzanian Shilling formatting with locale-based thousands separators, no decimal handling, no currency code beyond literal `"Tsh"` prefix).

### `src/utils/errorMessages.ts`
See full detail and complete mapping table in `ERROR_HANDLING.md` (Part 14). Summary of API surface:
- **`getUserFriendlyError(error: unknown, fallback?: string): string`** — Extracts a message from any error shape, `console.error('[Error]', errorMessage)` logs the raw message, tests it against an ordered list of regex→message mappings, and returns the first match's friendly message, or `fallback` (or a generic default) if nothing matches.
- **`extractErrorMessage(error): string`** (private) — Handles `string`, `Error` instances, and plain objects with `.message`, `.error`, or `.error_description` string fields; falls back to `String(error)`.
- **`friendlyErrors`** — An exported const object of pre-written strings for common scenarios (`network`, `otpSend`, `otpInvalid`, `loginFailed`, `sessionExpired`, `permissionDenied`, `serverError`, `generic`) for direct use when the calling code knows the exact context rather than relying on pattern matching.

### `src/utils/phone.ts`
Tanzania-specific phone number validation.
- **`validateTZPhone(phone: string): PhoneValidationResult`** where `PhoneValidationResult = { isValid: boolean; error: string | null; normalized: string | null }`.
  - Rejects empty/non-string input → error `'Phone number is required'`.
  - Strips spaces, dashes, parentheses.
  - Rejects any character outside `[\d+]` → error `'Phone number contains invalid characters'`.
  - If starts with `+255`: must be exactly 13 chars total, else error `'Invalid phone format. Use +255XXXXXXXXX'`. Valid → returned normalized as-is.
  - If starts with `0`: must be exactly 10 digits, else error `'Invalid phone format. Use 0XXXXXXXXX'`. Valid → normalized to `+255` + remainder (strips leading 0).
  - If starts with `255` (no plus): must be exactly 12 digits, else error `'Invalid phone format. Use +255XXXXXXXXX'`. Valid → normalized by prefixing `+`.
  - Any other pattern → error `'Invalid phone format. Use +255XXXXXXXXX or 0XXXXXXXXX'`.

### `src/utils/resetUrl.ts`
Centralized password-reset URL builder ensuring reset links always point at the canonical production domain, never a preview domain.
- **Constants**: `RESET_PATH = '/reset-password'`; `DEEP_LINK_SCHEME = 'afrilink://'`.
- **`getResetRedirectUrl(): string`** (sync) — `${getAppUrl()}${RESET_PATH}`.
- **`getResetRedirectUrlAsync(): Promise<string>`** (async) — `${await getAppUrlAsync()}${RESET_PATH}`.
- **`getResetDeepLink(token: string): string`** — Builds `afrilink://reset-password?token=<encoded>` for a (currently unimplemented — see TODO comments in file) native mobile deep-link flow.
- File contains an extensive TODO comment block documenting Phase 2 mobile deep-linking requirements: hosting `/.well-known/assetlinks.json` (Android App Links, package `com.kbsoftwares.afrilink`), `/.well-known/apple-app-site-association` (iOS Universal Links), configuring Associated Domains (`applinks:afrilink01.vercel.app`) in Xcode, and adding Android intent filters for `afrilink://reset-password` and autoVerify HTTPS intent filters. **This confirms deep linking is NOT yet implemented — a Flutter rebuild must implement this from scratch** using `app_links` or `uni_links` plus platform-specific Universal Links/App Links configuration.

### `src/utils/slug.ts`
- **`slugify(value: string): string`** — Lowercases, trims, strips all non-alphanumeric/non-space/non-hyphen chars, collapses whitespace runs to single hyphens, collapses multiple hyphens to one.
- **`getProductSlug(title: string, id?: string): string`** — Returns `slugify(title)`, optionally suffixed with `-` + first 6 chars of `id` if provided (used to disambiguate products with identical titles).

### `src/lib/utils.ts`
- **`cn(...inputs: ClassValue[])`** — Combines `clsx` (conditional class joining) with `tailwind-merge` (dedupes conflicting Tailwind utility classes). Used by virtually every UI component to merge default/variant classes with consumer-provided `className` props. Not applicable to Flutter (no CSS class strings).

---

## 4. Custom Hooks (`src/hooks/*`)

### `useAuth` (`src/hooks/useAuth.tsx`) — Context Provider + Hook
Provides authentication state and multi-role account management (users can be both `vendor` and `affiliate`).

- **Context shape (`AuthContextType`)**:
  - `user: User | null` — Supabase auth user object.
  - `session: Session | null` — Supabase session (JWT etc.).
  - `loading: boolean` — true until initial session check completes.
  - `userRole: 'vendor' | 'affiliate' | null` — currently active role.
  - `availableRoles: ('vendor' | 'affiliate')[]` — all roles the user holds (from `user_roles` table).
  - `signOut(): Promise<void>` — calls `supabase.auth.signOut()`, resets all local state to null/empty.
  - `switchRole(newRole): Promise<boolean>` — switches active role only if user already has that role in `availableRoles`; persists choice to `localStorage` key `afrilink_active_role_${user.id}`; returns `false` (with `console.error`) if role not available or no user.
  - `addRole(newRole): Promise<boolean>` — if user already has the role, delegates to `switchRole`. Otherwise inserts a row into `user_roles` table via Supabase; on error logs and returns `false`; on success calls `fetchUserRoles` to refresh, sets the new role active, persists to localStorage, returns `true`.
  - `refreshRoles(): Promise<void>` — re-fetches roles for current user.
- **Internal behavior**:
  - `fetchUserRoles(userId)`: queries `user_roles` table filtered by `user_id`; on Supabase error, `console.error`s and returns silently (does not throw/surface to UI). Sets `availableRoles`. Determines active role: prefers value saved in `localStorage['afrilink_active_role_' + userId]` if it's among the fetched roles; otherwise defaults to first role in the list and persists that choice.
  - On mount: sets up `supabase.auth.onAuthStateChange` listener FIRST (updates `session`/`user`, defers role-fetch via `setTimeout(...,0)` to avoid Supabase client deadlock, resets role state to null/[] on logout, sets `loading=false`), THEN checks `supabase.auth.getSession()` for an existing session on load (also fetching roles if a user exists, sets `loading=false`).
  - Cleanup: unsubscribes the auth listener on unmount.
- **`useAuth()` hook**: throws `Error('useAuth must be used within an AuthProvider')` if used outside `<AuthProvider>`.
- No retry logic; no distinct loading states per-action (e.g., no `isSwitchingRole` flag) — only the single global `loading`.

### `useCart` (`src/hooks/useCart.tsx`) — Context Provider + Hook
Manages the shopping cart entirely client-side via `localStorage` (no backend cart table).

- **`CartItem`**: `{ id, title, price, image, quantity, commission, vendorId, slug? }`.
- **Context shape (`CartContextType`)**: `items: CartItem[]`, `addToCart(item)`, `removeFromCart(id)`, `updateQuantity(id, quantity)`, `clearCart()`, `totalItems: number` (sum of quantities), `totalPrice: number` (sum of price×quantity), `affiliateCode: string | null`, `setAffiliateCode(code)`.
- **Persistence**: Cart initialized from `localStorage['cart']` (JSON-parsed); if parsing fails, `console.warn('[Cart] Failed to parse saved cart, resetting')`, clears the corrupt key, and starts with an empty array. Every change to `items` re-serializes and writes to `localStorage['cart']`. `affiliateCode` similarly persisted to `localStorage['affiliateCode']` (removed from storage when set to `null`).
- **`addToCart`**: if an item with the same `id` exists, increments its quantity by 1 (ignores/does not update other fields like price); otherwise appends a new entry with `quantity: 1`.
- **`updateQuantity(id, quantity)`**: if `quantity < 1`, delegates to `removeFromCart`; otherwise sets exact quantity.
- **`clearCart()`**: empties `items` and also clears `affiliateCode`.
- **`useCart()`**: throws `Error('useCart must be used within a CartProvider')` if used outside provider.

### `useNotifications` (`src/hooks/useNotifications.tsx`)
Manages the in-app notification center backed by Supabase `notifications` table with realtime updates.

- **`Notification` type**: `{ id, user_id, title, message, type: 'info'|'success'|'warning'|'error', read, link: string|null, created_at }`.
- **Returned API**: `{ notifications, unreadCount, loading, markAsRead(id), markAllAsRead(), deleteNotification(id), clearAll(), refetch }`.
- **`fetchNotifications`**: if no `user`, resets to empty/`loading=false`. Else selects up to 20 notifications for the user ordered by `created_at desc`. On Supabase error, throws internally then caught → `console.error('Error fetching notifications:', error)` (no UI-facing error state exposed — failures are silent to the user beyond staying in `loading` false with stale/empty data). Always sets `loading=false` in `finally`.
- **Realtime subscription**: Subscribes to a Supabase Realtime channel `notifications-changes` filtering `postgres_changes` on `public.notifications` where `user_id=eq.<user.id>`. Handles `INSERT` (prepends new notification, increments unread count), `UPDATE` (replaces matching notification, recomputes unread count via a nested `setNotifications` callback pattern), `DELETE` (removes from list). Every change payload is `console.log`ged. Channel is removed via `supabase.removeChannel(channel)` on unmount/user change.
- **`markAsRead(id)`**: updates `read: true` for one row; on error throws→caught→`console.error`; on success updates local state and decrements `unreadCount` (floored at 0).
- **`markAllAsRead()`**: bulk updates all unread rows for the user to `read: true`; on error `console.error`; on success sets all local notifications to read and `unreadCount = 0`.
- **`deleteNotification(id)`**: deletes row; on error `console.error`; on success removes from local list and decrements unread count if it was unread.
- **`clearAll()`**: deletes all rows for user; on error `console.error`; on success empties local list and zeroes unread count.
- **No retry logic anywhere.** All Supabase errors caught and only logged to console — no toast/snackbar is surfaced from within this hook itself (calling components may or may not show their own error toast).

### `usePWA` (`src/hooks/usePWA.tsx`)
Manages the "Add to Home Screen" install prompt flow for the web PWA.

- **Returns**: `{ isInstallable, isInstalled, isIOS, promptInstall }`.
- **Detection**: `isInstalled` = `window.matchMedia('(display-mode: standalone)').matches` OR iOS's `navigator.standalone`. `isIOS` = user-agent test for iPad/iPhone/iPod (excluding `MSStream`, i.e. not old IE).
- **Listens for**: `beforeinstallprompt` window event (captures/prevents default, stores the deferred prompt, sets `isInstallable=true`); `appinstalled` event (marks installed, clears state).
- **`promptInstall()`**: Calls `.prompt()` on the stored `BeforeInstallPromptEvent`, awaits `.userChoice`; if `outcome === 'accepted'`, clears prompt state and returns `true`; else returns `false`. Returns `false` immediately if no deferred prompt is stored.
- This entire concept (native install prompt / "Add to Home Screen") **does not exist in Flutter** — a native Flutter app is installed via the app store or APK/IPA directly; there is no equivalent API needed. If web/PWA support is retained separately, this logic has no direct Flutter analog.

### `usePushNotifications` (`src/hooks/usePushNotifications.tsx`)
Manages Web Push subscription lifecycle via the Service Worker Push API and a custom Supabase Edge Function backend (`push-api`).

- **Returns**: `{ permission: 'granted'|'denied'|'default'|'unsupported', isSubscribed, isLoading, subscribe(), unsubscribe(), isSupported }`.
- **`isSupported`**: `'serviceWorker' in navigator && 'PushManager' in window`.
- On mount: sets `permission` from `Notification.permission` (or `'unsupported'` if not supported); checks `navigator.serviceWorker.ready` for an existing `PushSubscription` to set `isSubscribed`.
- **`getVapidKey()`**: Fetches VAPID public key from `https://{VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/push-api/vapid-key` with `apikey` header = `VITE_SUPABASE_PUBLISHABLE_KEY`; caches in a ref; on failure logs `console.error('[Push] Failed to fetch VAPID key:', error)` and returns `null`.
- **`storeSubscription(subscription)`**: POSTs subscription JSON (`endpoint`, `p256dh`, `auth`, `platform: 'web'`) with `Authorization: Bearer <access_token>` to `push-api/subscribe`; requires an active Supabase session, else returns `false`; catches/logs errors, returns `response.ok`.
- **`removeSubscription(endpoint)`**: DELETEs to same endpoint with `{ endpoint }` body; same auth/error pattern.
- **`subscribe()`**: Requests `Notification.requestPermission()`; if not granted, logs `console.log('[Push] Permission denied')` and returns `false`. Fetches VAPID key (fails → `console.error`, returns `false`). Gets/creates a `PushSubscription` via `registration.pushManager.subscribe()` using `urlBase64ToUint8Array` to convert the VAPID key. Stores subscription on backend; sets `isSubscribed=true` on success. All exceptions caught and logged as `console.error('[Push] Subscribe error:', error)`.
- **`unsubscribe()`**: Gets current subscription, calls `.unsubscribe()`, then removes it from backend by endpoint. Always sets `isSubscribed=false` regardless. Errors logged as `console.error('[Push] Unsubscribe error:', error)`.
- **Auto re-subscribe effect**: On user login, if not already subscribed and `Notification.permission === 'granted'`, silently calls `subscribe()` again (wrapped in try/catch that swallows all errors) to keep push registration in sync across devices/sessions.
- **No retry/backoff logic** anywhere in this hook — single-attempt operations only.
- Flutter equivalent: `firebase_messaging` (FCM) for push notifications (would replace this entire Web Push + custom VAPID/edge-function architecture), or `flutter_local_notifications` for local notification display combined with a native push service.

### `useIsMobile` (`src/hooks/use-mobile.tsx`)
- Simple responsive breakpoint hook: `MOBILE_BREAKPOINT = 768`. Uses `window.matchMedia('(max-width: 767px)')` with a change listener; returns boolean `isMobile` (defaults to `undefined` until first effect run, coerced to boolean via `!!isMobile`).
- Flutter equivalent: `MediaQuery.of(context).size.width` breakpoint checks, or `LayoutBuilder`.

### `useToast` / `toast` (`src/hooks/use-toast.ts`)
A hand-rolled toast state manager (separate from `sonner`, backs the Radix-based `<Toast>` components in `src/components/ui/toast.tsx` + `<Toaster>`).

- **Constants**: `TOAST_LIMIT = 1` (only one toast visible at a time — new toasts replace old ones in the visible slice); `TOAST_REMOVE_DELAY = 1000000` ms (~16.6 minutes) — an intentionally very long delay before a dismissed toast is actually removed from memory (relies on exit animation + eventual GC rather than quick cleanup; effectively toasts are removed from DOM by Radix animation but state cleanup is delayed).
- **Reducer actions**: `ADD_TOAST` (prepends, slices to `TOAST_LIMIT`), `UPDATE_TOAST` (patches by id), `DISMISS_TOAST` (sets `open:false` for one or all toasts, queues removal), `REMOVE_TOAST` (filters out by id, or clears all if no id).
- **Module-level singleton store**: `memoryState` + `listeners` array outside React (not using Context) — `dispatch()` mutates `memoryState` and notifies all subscribed `useToast()` instances. This means toast state is global across the whole app regardless of component tree position.
- **`toast(props)`**: Generates an incrementing numeric id (`genId()`, wraps at `Number.MAX_SAFE_INTEGER`), dispatches `ADD_TOAST` with `open: true` and an `onOpenChange` handler that dismisses on close. Returns `{ id, dismiss, update }` for imperative control.
- **`useToast()` hook**: Subscribes/unsubscribes to the singleton store; returns `{ toasts, toast, dismiss(toastId?) }`.
- Flutter equivalent: A custom global `OverlayEntry`/`SnackBar` queue manager, or packages like `another_flushbar`, `toastification`, or `flutter_riverpod`-backed toast controller mimicking this exact single-slot behavior.

---

## 5. Context Providers Summary

| Provider | File | Wraps | State exposed |
|---|---|---|---|
| `AuthProvider` | `src/hooks/useAuth.tsx` | Entire app (likely near root in `App.tsx`) | user, session, loading, userRole, availableRoles + role/auth actions |
| `CartProvider` | `src/hooks/useCart.tsx` | Entire app or marketplace section | cart items, totals, affiliate code + cart actions |
| (Toast state) | `src/hooks/use-toast.ts` | N/A — module-level singleton, not a React Context Provider | toasts array + toast/dismiss functions |
| `ToastProvider` (Radix) | `src/components/ui/toast.tsx` | Toast viewport rendering only (via `ToastPrimitives.Provider`) | Radix toast primitive context |
| `next-themes` `ThemeProvider` | (implied, used by `sonner.tsx`'s `useTheme()`) | Likely wraps app root for dark/light theme | `theme`, `setTheme` |

No standalone `NotificationsProvider` or `PWAProvider` component exists — `useNotifications`, `usePWA`, and `usePushNotifications` are plain hooks (not Context-backed), meaning each component calling them gets its own independent state/subscription instance (potential for duplicate Supabase Realtime channel subscriptions if used in multiple components simultaneously).

---

## 6. Capacitor Plugins

- **Configured plugins**: Only `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` are declared as dependencies. No `@capacitor/ios` package is present. No additional Capacitor plugins (e.g., `@capacitor/push-notifications`, `@capacitor/app`, `@capacitor/preferences`, `@capacitor/splash-screen`, `@capacitor/status-bar`) are installed or imported anywhere in `src/`.
- **`capacitor.config.ts`**: `{ appId: 'com.kbsoftwares.afrilink', appName: 'Winger', webDir: 'dist' }` — minimal config, no plugin-specific config blocks (no `SplashScreen`, `PushNotifications`, etc. config keys).
- **Conclusion**: The app is fundamentally a PWA (installable web app via `vite-plugin-pwa` + web push via VAPID/Service Worker) with Capacitor wired up only for an Android native wrapper build, but no native plugin bridging code has been written. A Flutter rebuild does not need to replicate any Capacitor plugin behavior — only the underlying features (push notifications, offline caching, install-to-home-screen semantics) described above and in `ERROR_HANDLING.md`.

---

## 7. Deno Edge Function Imports (`supabase/functions/*`)

Edge functions run on Supabase's Deno runtime. Based on code inspection, functions are directories: `_shared/email-templates`, `admin-actions`, `app-config`, `auth-email-hook`, `checkout`, `checkout-api`, `order-guardian`, `payments-api`, `push-api`, `send-otp`, `verify-otp`.

Common patterns observed across all functions:
- Standard Deno `Deno.serve(...)`-style handler (implied by `index.ts` naming convention for Supabase Edge Functions).
- CORS handling via a shared `corsHeaders` object/import, with `OPTIONS` preflight returning `new Response('ok', { headers: corsHeaders })` or `new Response(null, { headers: corsHeaders })`.
- Supabase server-side client construction (service-role `adminClient`/`supabase` and a request-scoped `userClient`/`supabaseAuth` built from the caller's `Authorization` bearer token) — implies import of `@supabase/supabase-js` (or the Deno-compatible `esm.sh`/`npm:` specifier equivalent) inside each function.
- JSON response helper patterns (`json(data, status)` local helper functions) wrapping `new Response(JSON.stringify(...), { status, headers: {...corsHeaders, 'Content-Type': 'application/json'} })`.
- External HTTP calls to third-party APIs: **Briq** SMS/payment gateway (referenced in `send-otp`, `payments-api`, `checkout` — "Briq LIVE" create/verify payment calls, SMS delivery).
- `admin-actions` function performs privileged moderation actions (approve/reject/take-down) requiring an `Unauthorized`/`Admin access required` check via role validation against the database.
- `payments-api` calls a Postgres RPC function `credit_wallet` via `adminClient.rpc('credit_wallet', {...})` for platform/affiliate/vendor ledger crediting — implies Supabase RPC/Postgres function definitions outside the JS layer.
- `order-guardian` proxies to an external "Order service" (upstream microservice) and requires `Vendor code not set for this account` validation; enforces a `WITHDRAWAL_FEE_TZS` constant when validating withdrawal amounts.
- `auth-email-hook` validates a **webhook signature** (likely `standardwebhooks` or Supabase's built-in webhook signing) and renders HTML email templates from `_shared/email-templates`.
- No explicit `npm:`/`https://esm.sh/` import specifiers were captured in the grep output snippets, but the presence of `@supabase/supabase-js`-style client calls (`.auth.getUser()`, `.from(...)`, `.rpc(...)`) confirms edge functions import the Supabase JS client via Deno-compatible URL imports (standard Supabase Edge Function convention: `import { createClient } from "npm:@supabase/supabase-js@2"` or via `esm.sh`).

Flutter/Dart equivalent: These edge functions are backend-only and are **not rewritten in Flutter** — a Flutter client would continue to call the same Supabase Edge Function HTTP endpoints (via `supabase_flutter`'s `functions.invoke()` or plain `http`/`dio` requests with matching headers), so this section is primarily informative for understanding the API contract Flutter must replicate on the client side (see `ERROR_HANDLING.md` for the response envelope shapes).
