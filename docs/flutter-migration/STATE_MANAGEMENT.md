# PART 8 — State Management

This document exhaustively catalogs every piece of application state in the current React/Vite/Supabase codebase ("Winger" / AfriLink), so it can be reproduced 1:1 in a Flutter rebuild.

## 8.1 Overview of the current approach

State is managed with plain React primitives — there is **no Redux, Zustand, Recoil, or MobX**. The layering is:

1. **React Context providers** (app-wide, wrap the whole tree in `src/App.tsx`):
   - `ThemeProvider` (from `next-themes`) — `attribute="class"`, `defaultTheme="dark"`, `enableSystem`.
   - `AuthProvider` (`src/hooks/useAuth.tsx`) — Supabase auth session, user, role.
   - `CartProvider` (`src/hooks/useCart.tsx`) — shopping cart, persisted to `localStorage`.
2. **TanStack Query** (`@tanstack/react-query`) — a single `QueryClient` is instantiated in `App.tsx` with **default options (no custom `staleTime`, `cacheTime`/`gcTime`, or `retry` overrides)**. Notably, **TanStack Query is installed and the provider wraps the app, but the actual data-fetching in `Index.tsx` and the dashboards does NOT use `useQuery`/`useMutation` — it uses raw `useState` + `useEffect` + direct `supabase.from(...)` calls.** TanStack Query is therefore mostly unused infrastructure today (available for future use, e.g. by shadcn components), not the primary data layer.
3. **Local component state** (`useState`/`useRef`) inside `src/pages/Index.tsx` (the single-page "router" that switches between ~18 views) and inside dashboard/settings components.
4. **`localStorage`** — used directly (not through a wrapper) for: cart items, affiliate code, active role per user, onboarding-seen flag, cached canonical app URL, i18next language cache.
5. **URL query string** (`window.location.search` + `window.history.replaceState`) — used as a lightweight "router" to persist the current `view` (screen) and onboarding `role` across reloads, without React Router route params (React Router itself is only used for a handful of standalone pages: `/`, `/reset-password`, `/p/:productId`, `/confirm/:orderId`, `/checkout/confirm`).

## 8.2 Global state (Context providers)

### 8.2.1 `AuthProvider` (`src/hooks/useAuth.tsx`)
Provided via React Context, consumed everywhere via `useAuth()`.

State variables:
- `user: User | null` — Supabase auth user object.
- `session: Session | null` — Supabase auth session.
- `loading: boolean` — true until the first `onAuthStateChange`/`getSession()` resolves.
- `userRole: 'vendor' | 'affiliate' | null` — the **currently active** role for a multi-role user.
- `availableRoles: ('vendor' | 'affiliate')[]` — all roles the user has (from `user_roles` table).

Effects:
- One `useEffect` (deps `[fetchUserRoles]`) that:
  - Subscribes to `supabase.auth.onAuthStateChange` FIRST (sets `session`, `user`; on user present, defers `fetchUserRoles(userId)` via `setTimeout(…, 0)` to avoid Supabase client deadlock; on no user, clears `userRole`/`availableRoles`; sets `loading=false`).
  - THEN calls `supabase.auth.getSession()` once to hydrate any existing session on mount (sets `session`/`user`, calls `fetchUserRoles` if present, sets `loading=false`).
  - Cleanup: unsubscribes the auth listener.

Derived/callback logic:
- `fetchUserRoles(userId)` (`useCallback`, deps `[]`): queries `user_roles` table for `role` rows matching `user_id`; sets `availableRoles`; reads active-role preference from `localStorage` key `afrilink_active_role_{userId}`; if that saved role is in the fetched roles it becomes `userRole`, otherwise defaults to `roles[0]` and persists it back to `localStorage`.
- `switchRole(newRole)` (`useCallback`, deps `[user, availableRoles]`): guards against `!user` or role not in `availableRoles`; sets `userRole` and persists to `localStorage` key `afrilink_active_role_{user.id}`.
- `addRole(newRole)` (`useCallback`, deps `[user, availableRoles, switchRole, fetchUserRoles]`): if role already present, delegates to `switchRole`; otherwise inserts a row into `user_roles`, refetches roles, sets `userRole`, persists to `localStorage`.
- `refreshRoles()` (`useCallback`, deps `[user, fetchUserRoles]`): re-runs `fetchUserRoles` for the current user.
- `signOut()`: calls `supabase.auth.signOut()`; manually clears `user`, `session`, `userRole`, `availableRoles` (does not clear `availableRoles`'s localStorage key — only role selection persistence per-user remains keyed by user id and is naturally orphaned since the user signs out).

**Auth/session state persisted:** Supabase's own SDK persists the JWT/session in its configured storage (localStorage by default, see `src/integrations/supabase/client.ts`), independent of this Context. The Context is purely an in-memory reactive mirror plus role bookkeeping.

### 8.2.2 `CartProvider` (`src/hooks/useCart.tsx`)
State variables:
- `items: CartItem[]` — each item: `{ id, title, price, image, quantity, commission, vendorId, slug? }`. Initialized lazily from `localStorage.getItem('cart')` (parsed JSON; on parse failure, logs a warning, clears the `cart` key, and resets to `[]`).
- `affiliateCode: string | null` — initialized lazily from `localStorage.getItem('affiliateCode')`.

Effects:
- `useEffect` on `[items]` — writes `JSON.stringify(items)` to `localStorage['cart']` on every change (i.e., cart is persisted on every mutation, not debounced).
- `useEffect` on `[affiliateCode]` — writes `affiliateCode` to `localStorage['affiliateCode']` if truthy, else removes the key.

Actions:
- `addToCart(item)` — if an item with the same `id` exists, increments its `quantity`; else appends with `quantity: 1`. **Note: `vendorId` attribution is stored per cart item** (each cart line carries its own `vendorId`), enabling multi-vendor carts even though the external checkout only processes one item at a time (see `checkoutHandoff.ts`).
- `removeFromCart(id)` — filters item out.
- `updateQuantity(id, quantity)` — if `quantity < 1`, delegates to `removeFromCart`; else maps and replaces quantity.
- `clearCart()` — resets `items` to `[]` **and** resets `affiliateCode` to `null`. This is explicitly called from `Index.tsx`'s `handleLogout()` (cart is cleared on logout) and from `CheckoutModal.tsx` after a successful order/payment redirect.
- Derived (not stored, computed every render): `totalItems = sum(quantity)`, `totalPrice = sum(price*quantity)`.

**Cart persistence rule:** cart survives page reloads and is NOT scoped per-user — it lives at a single global `localStorage['cart']` key, so it is shared across whichever account is active in the browser (guest or logged-in). It is only cleared explicitly on logout or after checkout completes.

### 8.2.3 `ThemeProvider` (next-themes)
- Not custom code; wraps `<html class="dark|light">`. `defaultTheme="dark"`, `enableSystem` (so it can follow OS preference), `attribute="class"`. Theme choice, once changed via next-themes' internal API (not currently exposed by any UI component we found in scope), is persisted by next-themes itself to `localStorage['theme']`. No custom theme toggle component was found within the files reviewed — dark is effectively the default/only active theme in current UI.

### 8.2.4 TanStack QueryClient
- `const queryClient = new QueryClient()` — default config, no custom `staleTime`/`cacheTime`/`retry`/`refetchOnWindowFocus` overrides anywhere in the codebase reviewed. Provided at the app root but not actively used for the main marketplace/dashboard data fetches (see PERFORMANCE.md for implications when rebuilding caching behavior).

## 8.3 Screen-level state — `src/pages/Index.tsx` (`IndexContent` component)

This single component is the de-facto app shell/router and owns the largest concentration of state. Every `useState` call, in declaration order:

| State variable | Type | Initial value | Purpose |
|---|---|---|---|
| `view` (via `setViewState`, wrapped by `setView`) | `View` (union of 18 view names) | From URL (`getViewFromUrl()`) or `'landing'` | Which full-screen "page" is rendered — acts as the app's router/state-machine. |
| `selectedProduct` | `Product \| null` | `null` | Product currently open in `ProductModal`. |
| `notification` | `string \| null` | `null` | Text for the transient `<Notification>` toast-like banner. |
| `pendingUserId` | `string \| null` | `null` | User id captured mid-signup before verification/login completes. |
| `cartOpen` | `boolean` | `false` | Whether `<CartDrawer>` is visible. |
| `onboardingRole` | `'vendor' \| 'affiliate' \| null` | From URL (`role` param) | Role selected during onboarding, used before account creation. |
| `postGrabProductId` | `string \| null` | `null` | Product id an unauthenticated/incomplete-profile user tried to "Grab Link" for — resumed after login/profile completion. |
| `isGuestBrowsing` | `boolean` | `false` | Tracks if user entered the marketplace via "browse as guest" from role-selection (affects back-button behavior in `MarketplaceNav`). |
| `searchTerm` | `string` | `''` | Marketplace search box value. |
| `selectedCategory` | `string` | `'All'` | Marketplace category filter. |
| `commissionFilter` | `string` | `'all'` | One of `'all' \| '5+' \| '10+' \| '15+' \| '20+'`. |
| `priceFilter` | `string` | `'all'` | One of `'all' \| '0-50000' \| '50000-100000' \| '100000-500000' \| '500000+'`. |
| `products` | `Product[]` | `[]` | The logged-in vendor's own products (dashboard). |
| `marketplaceProducts` | `Product[]` | `[]` | All approved products shown in the marketplace/landing page. |
| `rawProducts` | `any[]` | `[]` | Unformatted vendor product rows straight from Supabase (kept alongside the formatted `products` for lookups, e.g. affiliate link generation). |
| `profile` | `{ full_name; wallet_balance; verification_photo_url; verification_status; phone_verified } \| null` | `null` | Current user's `profiles` row. |
| `roleAvatarUrl` | `string \| null` | `null` | Vendor logo or affiliate avatar URL, set once the relevant profile subtype is fetched. |
| `vendorStats` | `VendorStats` | `{ revenue:0, sales:0, products:0, pending:0 }` | Derived vendor dashboard stats computed from `products` fetch. |
| `affiliateStats` | `AffiliateStats` | `{ commission:0, clicks:0, conversions:0, rate:0 }` | Derived affiliate dashboard stats computed from `affiliate_links` fetch. |
| `affiliateLinks` | `any[]` | `[]` | Raw affiliate link rows for the current affiliate user. |
| `dataLoading` | `boolean` | `false` | Loading flag while `fetchUserData` (or marketplace fetch) is in flight; drives the dashboard/marketplace spinner and disables pull-to-refresh. |
| `isRoleSwitching` | `boolean` | `false` | True while `handleSwitchRole`/`handleAddRole` runs; blocks rendering with a full-screen spinner. |

Refs:
- `isRecoveryLocked` (`useRef`, holds a function) and `recoveryLocked` (`useRef<boolean>`, initialized by calling `isRecoveryLocked.current()`) — together implement a "lock" so that once a Supabase password-recovery deep link is detected, no other effect can navigate away from the `reset-password` view until the user reaches `login`.

Callbacks (`useCallback`):
- `setView(newView, role?)` — deps `[]`. Central "view + URL" setter; enforces the recovery lock; updates `updateUrlView`; smooth-scrolls to top on every view change.
- `handleRefresh()` — deps `[]`. Calls `fetchUserData()` (used by dashboard pull-to-refresh).
- `handleMarketplaceRefresh()` — deps `[]`. Calls `fetchMarketplaceProducts()` (used by marketplace pull-to-refresh).
- `getMobileActiveTab()` — deps `[view]`. Maps `view` to one of the 5 mobile bottom-nav tabs.

Effects (`useEffect`), each with exact dependency array:
1. `[]` — on mount: reads `?ref=` query param for affiliate attribution → `setAffiliateCode(ref)` + fires `supabase.rpc('resolve_affiliate_link', { p_code: ref })` (fire-and-forget click tracking). Also detects password-recovery redirects (`pathname === '/reset-password'` or `isRecoveryHash()`), locking the view.
2. `[]` — subscribes to `supabase.auth.onAuthStateChange`; on `PASSWORD_RECOVERY` event, locks/forces `reset-password` view. Cleanup unsubscribes.
3. `[user, setView]` — sets a default view (`onboarding` or `role-selection`) only if the URL doesn't already specify a view and there's no logged-in user; skips entirely if recovery-locked.
4. `[user, userRole]` — if both present and view isn't `verification`/`reset-password`, calls `handlePostLogin()` → `fetchUserData()`. Skips if recovery-locked.
5. `[view]` — when `view === 'landing'` or `view === 'marketplace'`, calls `fetchMarketplaceProducts()`.

Data-fetch functions (plain async functions, not `useCallback`, called imperatively):
- `fetchUserData()` — the single largest function; branches heavily on `userRole`:
  - Fetches `profiles` row; if `!phone_verified` → routes to `phone-verification` view and returns early.
  - **Vendor branch:** fetches `vendor_profiles`; if incomplete (`business_name`, `city`, `vendor_type`, `pickup_location`, `logo_url` all required) → routes to `vendor-profile-setup`; else fetches all `products` for `vendor_id = user.id`, computes `vendorStats` (revenue = Σ sales×price, sales = Σ sales, products = count of approved, pending = count of pending).
  - **Affiliate branch:** fetches `affiliate_profiles`; if incomplete (`display_name`, `avatar_url`) → routes to `affiliate-profile-setup`; else, if there's a `postGrabProductId` pending, fetches marketplace products, generates the affiliate link, opens the `ProductModal` for that product, and routes to `marketplace`. Otherwise fetches all `status='approved'` products for the marketplace view and all `affiliate_links` for the user, computing `affiliateStats` (clicks, conversions, commission sums, and `rate = round(conversions/clicks*100)` or 0 if no clicks).
  - Ends by auto-routing to `dashboard` unless current view is in a "block auto redirect" allow-list (`marketplace`, `affiliate-profile-setup`, `vendor-profile-setup`, `phone-verification`).
  - Wrapped in `try/finally` toggling `dataLoading`.
- `fetchMarketplaceProducts()` — fetches all `status='approved'` products (no vendor filter), maps to `Product[]`, sets `marketplaceProducts`, and **returns** the array (used synchronously by callers like the affiliate post-grab flow).

Derived (computed each render, not stored as state):
- `currentUser: User | null` — composed from `user` + `profile` + `userRole` + `roleAvatarUrl`.
- `categories` — `['All', ...unique categories from marketplaceProducts]`.
- `filteredProducts` — client-side filter of `marketplaceProducts` by `searchTerm` (case-insensitive substring match against `title` OR `description`), `selectedCategory`, `commissionFilter` (`>=` thresholds), and `priceFilter` (numeric range buckets). See SEARCH.md for exact semantics.

### 8.3.1 URL query-param view persistence ("Bug Fix C")
- `getViewFromUrl()` parses `?view=` and `?role=` from `window.location.search`; also special-cases the Supabase password-recovery hash (`#...type=recovery`) to force `reset-password`.
- `updateUrlView(view, role?)` writes `view`/`role` back into the query string via `window.history.replaceState` (no navigation/reload), preserving the recovery hash only while on `reset-password`.
- This means **the current screen and onboarding role survive a hard page refresh** (except that all in-memory data — products, profile, stats — must be refetched, since only the view name is persisted, not the underlying data).
- Flutter equivalent should persist the equivalent "current route/tab" (e.g., via named routes + deep link restoration) but should likewise treat it as *navigation state only*, refetching domain data on relaunch.

## 8.4 Screen-level state — Dashboards & Settings

### 8.4.1 `VendorDashboard.tsx`
- `isAddModalOpen: boolean` (`useState`, default `false`) — controls `AddProductModal` visibility.
- `takedownProductId: string | null` (default `null`) — product pending a takedown confirmation dialog.
- `editingProduct: Product | null` (default `null`) — product open in `EditProductModal`.
- All actual product/stat data (`products`, `stats`) comes down as **props** from `Index.tsx`, not owned locally.

### 8.4.2 `AffiliateDashboard.tsx`
- `selectedProduct: Product | null` (default `null`) — product open in a modal for "grab link" flow.
- Product list/stats (`products`, `stats`) are props from `Index.tsx`.

### 8.4.3 `SettingsPage.tsx`
- `saving: boolean` — toggled during profile save.
- `fullName: string` — initialized from `currentUser.name`; editable form field.
- `phone: string` — editable form field.
- `vendorLocation: VendorLocation | null` and `vendorLocationLoaded: boolean` — lazily-fetched vendor pickup-location data plus a loaded flag to avoid re-fetch/flicker.
- `imageUrl: string | null` — the persisted avatar/logo URL from the backend.
- `imageFile: File | null` — the newly selected file pending upload.
- `imagePreview: string | null` — an object URL created via `URL.createObjectURL(file)` for instant local preview; **explicitly revoked with `URL.revokeObjectURL(imagePreview)`** before creating a new preview and again after successful upload (memory-leak prevention pattern — must be replicated as "dispose of temporary image byte buffers/decoded image after upload" in Flutter, since there's no direct blob-URL analog).
- `fileInputRef` (`useRef<HTMLInputElement>`) — hidden `<input type="file">` trigger.
- Notification-preference toggles (currently front-end only / no evidence of persistence wiring beyond local state in the excerpt reviewed): `emailNotifications` (default `true`), `marketingEmails` (default `false`), `orderUpdates` (default `true`), `promotionalAlerts` (default `false`).
- `handlePushToggle` (`useCallback`) — wired to `usePushNotifications` hook's `subscribe`/`unsubscribe`.
- Two `useEffect`s (exact deps not fully enumerated in this pass) load the vendor location and hydrate `phone` from the profile on mount/user change.

## 8.5 Other hooks with self-contained state

### 8.5.1 `useNotifications` (`src/hooks/useNotifications.tsx`)
- `notifications: Notification[]`, `unreadCount: number`, `loading: boolean`.
- `fetchNotifications` (`useCallback`, deps `[user]`) — fetches latest 20 notifications for the user ordered by `created_at desc`; recomputes `unreadCount`.
- Effect `[fetchNotifications]` — runs fetch on mount/user change.
- Effect `[user]` — opens a Supabase Realtime channel (`notifications-changes`) filtered to `user_id=eq.{id}`, listening for `INSERT`/`UPDATE`/`DELETE` `postgres_changes` and mutating local state accordingly (optimistic realtime cache, not TanStack Query cache). Cleanup removes the channel.
- Mutators: `markAsRead`, `markAllAsRead`, `deleteNotification`, `clearAll` — each does an optimistic local state update after a successful Supabase write.

### 8.5.2 `usePWA` (`src/hooks/usePWA.tsx`)
- `deferredPrompt`, `isInstallable`, `isInstalled`, `isIOS` — all local `useState`, hydrated once via a mount-only `useEffect` (`[]`) that checks `display-mode: standalone` media query, iOS `navigator.standalone`, user agent sniffing, and registers `beforeinstallprompt`/`appinstalled` window listeners (cleaned up on unmount).

### 8.5.3 `usePushNotifications` (`src/hooks/usePushNotifications.tsx`)
- `permission: PushPermission`, `isSubscribed: boolean`, `isLoading: boolean`.
- `vapidKeyRef` (`useRef<string | null>`) — in-memory cache of the fetched VAPID key so it's only fetched once per session.
- Effect `[isSupported]` — hydrates `permission`/`isSubscribed` from the browser `Notification`/`ServiceWorkerRegistration` APIs.
- Effect `[user?.id, isSupported]` (deliberately excludes `subscribe` from deps via eslint-disable) — auto re-subscribes silently on login if permission was already granted previously.

### 8.5.4 `use-mobile.tsx`
- `isMobile: boolean | undefined` — derived from `window.matchMedia('(max-width: 767px)')`, updated via a `change` listener registered in a mount-only effect.

### 8.5.5 `PullToRefresh.tsx` (mobile gesture component)
- `pulling`, `refreshing`, `pullDistance` — local UI-only state driving the pull-to-refresh gesture; `startY`/`containerRef` are refs. `threshold = 80`, `maxPull = 120` are magic-number constants (see CONFIGURATION.md).

## 8.6 Language/i18n state
- Managed by `i18next` + `i18next-browser-languagedetector`, not custom React state. Detection order: `localStorage` first, then `navigator` (browser locale). Detected/selected language is cached to `localStorage` (`caches: ['localStorage']`, key is i18next's default `i18nextLng`). Three locales are bundled and eagerly loaded (`en`, `sw`, `fr`) — no lazy-loading of locale bundles. `useSuspense: false` is set (see CONFIGURATION.md) so components must handle the "key flashes then translates" case rather than suspending.

## 8.7 Error state
There is **no centralized error-state store**. Errors are handled ad hoc per call site:
- Toasts via `sonner`'s `toast.error(...)` / `toast.success(...)` for user-facing async action results (role switch, link generation, checkout, etc.).
- `console.error(...)` for developer-facing logging.
- `getUserFriendlyError()` (`src/utils/errorMessages.ts`) is a pure function (no state) that maps raw error strings/objects to a curated user-friendly message via an ordered list of regex patterns (network, OTP, auth, permission, validation, duplicate, server/unknown), with a generic fallback. It is invoked at point-of-use (e.g., `CheckoutModal`), not globally intercepted.
- No error boundary component was found in the reviewed files; a Flutter rebuild should decide whether to add a global error boundary/handler (recommended) even though the current React app doesn't have one for this scope.

## 8.8 Pagination state
There is **no pagination state anywhere in the reviewed code**. All lists (`products`, `marketplaceProducts`, `notifications` [capped by `.limit(20)`], `affiliate_links`) are fetched in a single request with no `page`/`offset`/`cursor` state and no "load more" UI. See SEARCH.md and PERFORMANCE.md for implications.

## 8.9 Summary table: state persistence tiers

| Tier | Examples | Storage |
|---|---|---|
| In-memory only (lost on refresh) | `view`'s underlying data (products/profile/stats), `selectedProduct`, `notification`, filters (`searchTerm` etc.), dashboard modal open/closed flags | React state, cleared on reload |
| URL-persisted | `view`, onboarding `role` | Query string via `history.replaceState` |
| `localStorage`-persisted | cart items, affiliate code, active role per user id, onboarding-seen flag, cached canonical app URL, i18next language, next-themes theme | Browser `localStorage` |
| Server-persisted (source of truth) | profile, products, vendor/affiliate profile completeness, wallet balance, affiliate links/stats, notifications | Supabase Postgres, fetched imperatively on each relevant view/mount, no client cache layer |
| Supabase SDK-managed | Auth session/JWT | Supabase client's own storage adapter (localStorage by default) |
