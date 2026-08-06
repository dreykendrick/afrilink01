# PART 14 — Error Handling, Empty States & Offline Behavior

## 1. `getUserFriendlyError` — Full Mapping Table (verbatim, from `src/utils/errorMessages.ts`)

Function signature: `getUserFriendlyError(error: unknown, fallback?: string): string`. Every call logs `console.error('[Error]', errorMessage)` first (the RAW technical message, not the friendly one), then tests patterns **in this exact order** (first match wins):

| # | Regex pattern (case-insensitive) | User-facing message |
|---|---|---|
| 1 | `failed to fetch|network|net::err|econnrefused|enotfound` | `Network problem. Please check your internet connection and try again.` |
| 2 | `timeout|timed out` | `The request took too long. Please try again.` |
| 3 | `otp|verification code|sms delivery|send.*code` | `We couldn't send the verification code right now. Please try again in a moment.` |
| 4 | `invalid.*code|expired.*code|no valid otp` | `The code is invalid or has expired. Please request a new one.` |
| 5 | `invalid login credentials` | `Invalid email or password. Please check and try again.` |
| 6 | `email not confirmed` | `Please verify your email before signing in.` |
| 7 | `user already registered` | `An account with this email already exists. Please sign in instead.` |
| 8 | `jwt|token.*expired|session.*expired` | `Your session has expired. Please sign in again.` |
| 9 | `not authenticated|log ?in.*required` | `Please sign in to continue.` |
| 10 | `permission denied|403|unauthorized|forbidden` | `You don't have permission to perform this action.` |
| 11 | `42501` | `Permission denied. Please ensure you are signed in correctly.` |
| 12 | `missing.*field|required.*field|fill.*all` | `Please fill in all required fields.` |
| 13 | `invalid.*email` | `Please enter a valid email address.` |
| 14 | `invalid.*phone` | `Please enter a valid phone number.` |
| 15 | `password.*short|password.*6` | `Password must be at least 6 characters.` |
| 16 | `23505|already exists|duplicate` | `This item already exists. Please use a different name.` |
| 17 | `500|internal.*error|server.*error` | `Something went wrong on our side. Please try again later.` |
| 18 | `edge function|non-2xx|status code` | `Something went wrong. Please try again.` |

If **no pattern matches**, returns `fallback` if the caller supplied one, otherwise the generic default: `Something went wrong. Please try again.`

### `extractErrorMessage(error)` (private helper) coercion order:
1. Falsy error → `''`.
2. `string` → returned as-is.
3. `instanceof Error` → `.message`.
4. Plain object → checks `obj.message` (string) → `obj.error` (string) → `obj.error_description` (string), in that priority order.
5. Anything else → `String(error)`.

### `friendlyErrors` constant object (for direct use without pattern matching)
```
network: 'Network problem. Please check your internet connection and try again.'
otpSend: "We couldn't send the verification code right now. Please try again in a moment."
otpInvalid: 'The code is invalid or has expired. Please request a new one.'
loginFailed: 'Login failed. Please check your details and try again.'
sessionExpired: 'Your session has expired. Please sign in again.'
permissionDenied: "You don't have permission to perform this action."
serverError: 'Something went wrong on our side. Please try again later.'
generic: 'Something went wrong. Please try again.'
```

Note: `friendlyErrors.loginFailed` ("Login failed. Please check your details and try again.") differs slightly in wording from the pattern-matched login error (#5 "Invalid email or password..."), so both variants must be preserved verbatim if replicated in Flutter — they are used in different contexts (direct constant use vs. pattern-matched Supabase error).

---

## 2. Toast vs. Inline Error Conventions

Two parallel toast systems coexist in this codebase:

1. **Radix/shadcn toast system** (`src/hooks/use-toast.ts` + `src/components/ui/toast.tsx`, rendered via a `<Toaster>` mounted at app root): Used via `toast({ title, description, variant })`. This is the dominant pattern for **destructive** (error) feedback across forms: 81 occurrences of `variant: 'destructive'` were found across `src/`, concentrated in:
   - `src/components/auth/ForgotPasswordPage.tsx`, `LoginPage.tsx`, `ResetPasswordPage.tsx`, `SignupPage.tsx`, `VerificationForm.tsx`
   - `src/components/dashboard/AddProductModal.tsx`, `EditProductModal.tsx`, `ExternalWithdrawModal.tsx`, `NewWithdrawModal.tsx`, `VendorDashboard.tsx`, `VerificationStatusCard.tsx`, `WithdrawModal.tsx`
   - `src/components/onboarding/AffiliateProfileSetup.tsx`, `PhoneVerificationFlow.tsx`, `RegistrationFlow.tsx`, `VendorProfileSetup.tsx`
   - Convention: `toast({ title: 'Error', description: getUserFriendlyError(error.message) or getUserFriendlyError(error), variant: 'destructive' })` in `catch` blocks after a failed Supabase call/edge function call/form submission. Non-destructive (success) toasts use the default variant (no `variant` prop) with celebratory/confirmatory copy.
   - Because `TOAST_LIMIT = 1` in the reducer, only **one** toast can be visible at a time app-wide — a new toast immediately replaces any currently showing toast.
   - `TOAST_REMOVE_DELAY` is ~16.6 minutes — dismissed toasts stay in memory (though visually hidden via animation) for a very long time before being purged from the internal array; this is a known quirk of the shadcn template and not a deliberate long-toast-duration UX feature. Visual display duration is governed by Radix's own default auto-dismiss timing, not this constant.

2. **Sonner toast system** (`src/components/ui/sonner.tsx`, imported as `toast` from `sonner`): Used via imperative calls like `toast.error('Your cart is empty')` and `toast.success(...)` — a lighter-weight, non-form-blocking pattern seen in consumer-facing marketplace flows, e.g. `src/pages/Index.tsx:1032` (`toast.error('Your cart is empty')` when attempting checkout with nothing in cart). Sonner toasts theme-sync via `next-themes`' `useTheme()`.

3. **Inline errors**: Form-level validation errors (via `react-hook-form` + `zod` + `@hookform/resolvers`) are rendered inline beneath form fields (standard shadcn `FormMessage` pattern), separate from the toast system. Toasts are reserved for **submission-time failures** (network/server/auth errors returned from Supabase or edge functions), while **inline messages** are reserved for **client-side field validation** (e.g., "Invalid email", "Password too short") before submission is even attempted.

**Convention summary**: destructive toast = async operation failed after leaving the client (network, auth, server, edge function, RLS/permission errors); inline field error = synchronous client-side validation failure caught by zod schema before submission.

---

## 3. Empty States (exact copy, per screen)

| Screen / Component | File | Exact copy | Notes |
|---|---|---|---|
| Marketplace product grid | `src/pages/Index.tsx:989` | `No products found` | Rendered inside `<p className="text-muted-foreground">`, shown when the product query returns zero results (e.g., after filtering/search). |
| Cart drawer | `src/components/cart/CartDrawer.tsx:38` | `{t('cart.empty')}` (i18next key `cart.empty`) | Translated string — actual English text lives in the i18n translation resource file (not directly readable from this component); rendered when `items.length === 0`. |
| Help/Support FAQ search | `src/components/dashboard/HelpSupportPage.tsx:186` | `No matching FAQs found` | Shown when a FAQ search/filter yields no results. |
| Ledger / transaction history | `src/components/dashboard/LedgerHistory.tsx:79` | `No transactions yet` | Shown when the vendor/affiliate's ledger has zero entries. |
| Notification dropdown | `src/components/dashboard/NotificationDropdown.tsx:106` | `No notifications yet` | Rendered as `<p className="text-muted-foreground font-medium">`; shown when `notifications.length === 0` from `useNotifications()`. |
| Vendor orders list | `src/components/dashboard/VendorOrders.tsx:113` | `No orders yet` | Shown when the vendor has no orders returned from the order-guardian/orders query. |
| Cart empty (checkout attempt) | `src/pages/Index.tsx:1032` | `toast.error('Your cart is empty')` (Sonner toast, not an inline empty-state block) | Triggered when user attempts checkout/purchase action with an empty cart — this is a **toast**, not a static empty-state render. |

No other empty-state copy strings were found beyond these; all follow the same visual convention (`<p className="text-muted-foreground">` centered text, sometimes paired with an icon in the surrounding empty-state container).

---

## 4. 404 / NotFound Route Behavior

`src/pages/NotFound.tsx`:
- On mount (`useEffect` keyed on `location.pathname`), logs: `console.error("404 Error: User attempted to access non-existent route:", location.pathname)`.
- Renders a full-viewport centered block (`min-h-screen flex items-center justify-center bg-muted`) with:
  - Heading: `404`
  - Subtext: `Oops! Page not found`
  - Link: `Return to Home` — a plain `<a href="/">` (full page reload navigation, NOT a client-side `<Link>`/`useNavigate` call) styled as `text-primary underline hover:text-primary/90`.
- No retry logic, no automatic redirect, no telemetry beyond the console.error call. This is the React Router catch-all (`*`) route target.
- Flutter equivalent: an `onUnknownRoute`/`errorBuilder` in `go_router` (or `Navigator.onGenerateRoute` fallback) rendering an equivalent centered 404 screen with a button that pops to the app's root route, plus an analogous debug-log call (`debugPrint`/logging service) — but note the original uses a **hard navigation** (`<a href="/">`), not an in-app route transition, which a Flutter rebuild would likely replace with proper in-app navigation since there's no "browser" concept.

---

## 5. Network Failure Handling

- There is **no dedicated global network-error interceptor** in the codebase — no axios-style interceptor, no React Query global `onError` handler was found configured centrally (React Query is used for caching but any global error handling middleware wasn't located in the reviewed files).
- Network failures surface as raw Supabase client errors (`TypeError: Failed to fetch`, etc.) or `fetch()` promise rejections, which individual components catch in `try/catch` blocks and pass through `getUserFriendlyError()` before displaying via toast — pattern #1 in the mapping table (`Network problem. Please check your internet connection and try again.`) covers this.
- `usePushNotifications`'s `getVapidKey`, `storeSubscription`, `removeSubscription` each independently catch fetch failures and only `console.error` — **no user-facing toast/error surface exists for push subscription network failures**; they fail silently from the user's perspective (the `subscribe()`/`unsubscribe()` functions return `false`, and it is up to the calling UI component to decide whether to show any feedback).
- `useNotifications` similarly swallows all Supabase/network errors into `console.error` only — no toast is shown, and the UI simply keeps showing stale/last-known data or an empty list.

---

## 6. Offline Behavior & PWA Offline Caching

Configured entirely via `vite-plugin-pwa` in `vite.config.ts`:
- `registerType: "autoUpdate"` — service worker auto-updates in the background and takes over on next load without prompting the user.
- `manifest`: name `Winger - Africa's Premier Marketplace`, short_name `Winger`, theme_color `#f59e0b`, background_color `#0f172a`, `display: "standalone"`, `orientation: "portrait"`, `scope: "/"`, `start_url: "/"`, icons at `/pwa-192x192.png` and `/pwa-512x512.png` (both `purpose: "any maskable"`).
- **Workbox config**:
  - `skipWaiting: true`, `clientsClaim: true`, `cleanupOutdatedCaches: true` — new service worker versions activate immediately and take control of open clients without waiting for tab close.
  - `importScripts: ['/sw-push.js']` — injects the custom push-notification handler (see below) into the generated Workbox service worker.
  - `globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg}"]` — precaches all built static assets matching these extensions for offline app-shell availability.
  - `runtimeCaching`: only ONE runtime caching rule exists — Unsplash images (`https://images.unsplash.com/*`) are cached with a `CacheFirst` strategy, cache name `image-cache`, `maxEntries: 100`, `maxAgeSeconds: 604800` (7 days). **No other API calls (Supabase REST/Realtime/Storage, edge functions) are cached for offline use** — all dynamic data requests require network connectivity; there is no offline data fallback, no background sync, no IndexedDB caching layer for orders/products/cart beyond what's described below.
  - `navigateFallbackDenylist: [/^\/~oauth/]` — SPA navigation fallback (serving `index.html` for client-side routes) is disabled for paths starting with `/~oauth` (likely an OAuth callback route that must hit the network/server directly rather than being served the cached app shell).
- **Cart persistence** (`useCart`) is the only meaningful "offline-capable" state — it's stored in `localStorage`, so cart contents survive offline/reload, but checkout itself requires network (external checkout handoff to `shop.afrilink.info`).
- **No explicit "you are offline" banner/indicator component** was found in the reviewed files — the app does not appear to listen to `navigator.onLine`/`online`/`offline` window events anywhere in `src/hooks` or `src/utils`.
- Push notification service worker logic (`sw-push.js`, imported into the Workbox SW): listens for `push` events, parses JSON payload (falls back to plain text on parse failure), shows a notification via `self.registration.showNotification()` with icon/badge `/pwa-192x192.png`, a tag (`data.tag` or `afrilink-{timestamp}`), `vibrate: [200,100,200]`, and `requireInteraction: true` only for `type === 'warning'` or `type === 'error'` notifications. On `notificationclick`, focuses an existing open client window (navigating it to the notification's `url`/`link`, defaulting to `/`) or opens a new window if none exists. `notificationclose` just logs to console (`console.log('[sw-push] Notification closed:', ...)`) — no analytics backend call.
- **Flutter equivalent**: For a native app, offline behavior would need to be built from scratch (e.g., `connectivity_plus` for online/offline detection, `hive`/`sqflite`/`drift` for local caching of products/cart/orders, and `workmanager`/background sync for retrying failed operations) — none of this exists in the current web app beyond the trivial localStorage-based cart and the Unsplash image cache, so there is effectively **no real offline data experience to preserve/replicate** beyond "images may still show if previously viewed" and "cart survives a reload."

---

## 7. Retry Logic — Explicitly None

No exponential backoff, no retry queues, no "Retry" buttons were found in any hook or utility file reviewed (`useAuth`, `useCart`, `useNotifications`, `usePWA`, `usePushNotifications`, `errorMessages.ts`, `appUrl.ts`, `checkoutHandoff.ts`, `resetUrl.ts`). Every async operation is single-attempt:
- Failed Supabase queries/mutations are caught once and either logged (`console.error`) or surfaced via a single destructive toast; the user must manually re-trigger the action (e.g., resubmit a form, tap a button again) to retry.
- `getAppUrlAsync()` in `appUrl.ts` has an `inFlight` promise **deduplication** mechanism (prevents concurrent duplicate calls to the `app-config` edge function while one is already in progress) — but this is request coalescing, not retry-on-failure logic. If the `app-config` invoke fails, it falls through immediately to the hard-coded fallback URL with no retry attempt.
- `usePushNotifications`'s auto-resubscribe effect on login silently retries `subscribe()` exactly once per login/mount (wrapped in `try {} catch {}` with no further retry).
- **A Flutter rebuild should explicitly decide whether to introduce retry/backoff logic (e.g., via `dio`'s retry interceptor or manual exponential backoff) since none of the current UX patterns require preserving "no retry" as a deliberate design choice — it appears to simply not have been implemented.**

---

## 8. Permission / RLS Error Handling

- Postgres RLS violations surface as Supabase errors with code `42501` ("permission denied for ...") or generic `permission denied` text — both are explicitly mapped by `getUserFriendlyError` (patterns #10 and #11) to:
  - `You don't have permission to perform this action.` (generic 403/unauthorized/forbidden case)
  - `Permission denied. Please ensure you are signed in correctly.` (specific Postgres `42501` RLS violation code)
- In edge functions (server-side), unauthorized/forbidden access returns a JSON envelope `{ error: 'Unauthorized' }` with HTTP status `401`, or `{ error: 'Admin access required' }` with status `403` (seen in `admin-actions/index.ts`). These are raw JSON error bodies — the **client** is responsible for extracting `.error` (via `extractErrorMessage`'s `obj.error` check) and running it through `getUserFriendlyError` for display; the edge functions themselves do not send pre-humanized messages.
- `useAuth.switchRole()` guards against switching to a role the user doesn't hold by checking `availableRoles.includes(newRole)` client-side before ever hitting the backend — logs `console.error('User does not have this role')` and returns `false` (no toast triggered from within the hook itself; calling UI decides whether to show feedback).

---

## 9. Timeouts

- No explicit client-side timeout/AbortController configuration was found on any `fetch()` call (`usePushNotifications`'s VAPID key fetch, subscribe/unsubscribe calls) or on the Supabase client — timeouts are governed entirely by browser/OS defaults and whatever the Supabase JS SDK's internal defaults are.
- The only timeout-related concept is `getUserFriendlyError`'s pattern #2 (`timeout|timed out`) mapping raw timeout error text to `The request took too long. Please try again.` — this implies error-string based handling assumes *something upstream* (browser fetch, Supabase SDK, or an edge function) may eventually produce a message containing "timeout"/"timed out", but no explicit timeout is configured by this codebase's own code.
- Edge functions (Deno) rely on Supabase's platform-level function execution timeout (not configurable from the reviewed code) — functions returning slowly would eventually hit the platform's own timeout, not a custom one.

---

## 10. Edge Function Error Envelopes

Response body shapes vary slightly per function but converge on a consistent pattern: `{ success?: boolean, error: string, ...extra fields }` with an HTTP status code reflecting the failure type. Observed envelope shapes by function:

- **`app-config`**: `{ success: false, error: "Method not allowed" }` (405). Success: `{ success: true, appUrl }` (200).
- **`checkout-api`**: `{ success: false, error: 'Internal server error' }` (500); `{ success: false, error: 'Product not available', status, is_available }` (404) — includes extra debug fields (`status`, `is_available`) alongside the error; `{ success: false, error: 'Product not found' }` (404); `{ success: false, error: 'Missing required fields: products, buyer_name, buyer_email, buyer_phone, checkout_session_id' }` (implied 400). Success: `{ success: true, products: [...] }` / `{ success: true, product: {...} }`.
- **`checkout`**: Local `json(data, status)` helper — `{ success: false, error: 'Missing required fields' }` (400); `{ success: false, error: 'Products not available' }` (400); `{ success: false, error: 'Payment provider not configured' }` (503); `{ success: false, error: 'Payment provider error' }` (502, set after catching a Briq API exception and updating the payment record status to `FAILED`); `{ success: false, error: 'Not found' }` (404, default/fallback route); `{ success: false, error: err.message || 'Internal server error' }` (500, top-level catch-all) — this is the only function observed to sometimes leak a **raw exception message** to the client rather than always using a fixed string.
- **`admin-actions`**: `{ error: 'Unauthorized' }` (401); `{ error: 'Admin access required' }` (403). No `success` field used in this function — just bare `{ error }`.
- **`auth-email-hook`**: `{ error: 'Unauthorized' }` (401); `{ error: 'Invalid JSON in request body' }` (400); `{ error: 'Unknown email type: {type}' }` (400); `{ error: 'Server configuration error' }` (500); `{ error: 'Invalid signature' }` (401, webhook signature verification failure). Success path returns raw `html` content with status 200 (not JSON — this function renders email HTML templates).
- **`order-guardian`**: Local `json(data, status)` helper — `{ error: "Unauthorized" }` (401); `{ error: "Order service not configured" }` (503); `{ error: "Vendor code not set for this account", orders: [] }` (200 — degraded success with empty data rather than a hard error, notable pattern for a "soft failure"); `{ error: "Upstream error", details: body }` (proxied status code from an external "Order service"); `{ error: "Invalid JSON body" }` (400); `{ error: "Invalid amount" }` (400); `` { error: `Amount must exceed the ${WITHDRAWAL_FEE_TZS} TZS fee` } `` (400-ish, business-rule validation with an interpolated fee amount); `{ error: "Order service rejected withdrawal", details: upstream.body }`.
- **`payments-api`**: Uses `{ success: false, error: 'Payment not found' }`, `` { success: false, error: `Cannot confirm payment with status: ${payment.status}` } ``, `{ success: false, error: 'Order not found' }` — pattern of returning `success: false` + descriptive `error` string, sometimes interpolating current state into the message for debuggability.
- **`push-api`**: Local `json(body)` helper — `{ error: "Unauthorized" }` (401); `{ error: "Missing subscription fields" }` (400); `{ error: "Failed to store subscription" }` (500); `{ error: "Missing endpoint" }` (400); `{ error: "Not found" }` (404); `{ error: "Internal server error" }` (500, top-level catch).
- **`send-otp`**: `{ success: false, error: "Method not allowed" }` (405); `{ success: false, error: "Invalid request body" }` (400); `{ success: false, error: "Phone number is required" }` (400); `{ success: false, error: "SMS provider not configured" }` (500); `{ success: false, error: "SMS delivery failed" }` (500, after a failed upstream Briq API call, logged server-side via `console.error("Briq API failed", { status, data })`). Success: `{ success: true, ... queue_status, ... }` (200).

**General pattern for the client to replicate in Flutter**: Always check for an `error` (string) field in the decoded JSON body (regardless of whether `success` is also present), pass it through the same `getUserFriendlyError`-equivalent mapper, and treat HTTP status codes as secondary/supplementary information (some functions return 200 with an `error` field for "soft failures" like `order-guardian`'s `"Vendor code not set for this account"` case, so status-code-only error detection is insufficient — the response body must always be parsed).

---

## 11. Strict Console-Logging Convention

Observed conventions (38 `console.error` calls, 52 `console.log`/`console.warn` calls across `src/`):

- **`console.error`** is used exclusively for genuine failures: caught exceptions in `try/catch` blocks, Supabase query errors, auth errors, 404 route hits, subscription/push failures. Always includes a short bracketed or plain-English prefix describing the operation that failed (e.g., `'Error fetching notifications:'`, `'[Push] Subscribe error:'`, `'[Error]'` from `getUserFriendlyError`, `'404 Error: User attempted to access non-existent route:'`), followed by the error object/value as a second argument (never string-concatenated).
- **`console.warn`** is reserved for recoverable/non-fatal situations where the app falls back to a default rather than failing outright, e.g. `'[Cart] Failed to parse saved cart, resetting'` (localStorage JSON parse failure — cart is reset, not a crash), and `'[appUrl] VITE_APP_URL is not set – falling back to hard-coded production URL'` (only logged in non-dev/production builds, guarded by `!import.meta.env.DEV`).
- **`console.log`** is used for verbose diagnostic/dev tracing, often explicitly gated behind `import.meta.env.DEV` checks (e.g., all `[CheckoutHandoff]` logs in `checkoutHandoff.ts` only fire in dev mode), realtime payload tracing (`'Notification change:', payload` in `useNotifications`), and edge-function-side request tracing (`console.log('[send-otp] Briq API response status:', ...)`, `'Briq LIVE: Create response status:'`, etc.) — these run unconditionally server-side in edge functions (Deno logs are captured by Supabase's function logs dashboard, not user-visible).
- Bracketed module-tag prefixes are a consistent convention: `[Error]`, `[Push]`, `[Cart]`, `[appUrl]`, `[CheckoutHandoff]`, `[push-api]`, `[send-otp]` — enabling log filtering by subsystem.
- **No structured logging library** (e.g., no `pino`, `winston`, or remote error-tracking SDK like Sentry) is used anywhere in the reviewed files — all logging is raw `console.*` calls with no remote aggregation, meaning production errors are only visible via browser DevTools (client) or the Supabase Edge Function logs dashboard (server), with no crash reporting service integrated.
- **Flutter equivalent recommendation**: replicate the bracketed-tag convention using `debugPrint('[Tag] message')` or a lightweight `logger` package, gate verbose logs behind `kDebugMode`, and consider adding a proper crash-reporting SDK (e.g., Sentry, Firebase Crashlytics) during the rebuild since the original app has none.
