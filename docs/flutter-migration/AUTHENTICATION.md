# PART 13 — Authentication

Backed entirely by Supabase Auth (email/password) plus a custom phone-OTP
verification step done via Briq SMS (edge functions `send-otp`/`verify-otp`,
not Supabase's native phone auth). Roles are app-level (`user_roles` table),
not Supabase custom claims.

## Client setup
`src/integrations/supabase/client.ts` creates the client with:
```
auth: { storage: localStorage, persistSession: true, autoRefreshToken: true }
```
Flutter equivalent: `supabase_flutter` with its default `SharedPreferences`
(or secure storage) session persistence and auto refresh — behaviourally
equivalent, just swap the storage backend.

## Sign up (`SignupPage`)
- Validates `email` (valid email), `password` (min 6 chars), `fullName` (min 2 chars) with `zod`.
- Calls:
```
supabase.auth.signUp({
  email, password,
  options: {
    data: { full_name: fullName, role },   // role: 'vendor' | 'affiliate'
    emailRedirectTo: `${appUrl}/`
  }
})
```
  `appUrl` comes from `getAppUrlAsync()` (`src/utils/appUrl.ts`) which prefers
  `VITE_APP_URL`, falls back to a cached value in `localStorage['afrilink_app_url']`,
  or calls the `app-config` edge function, or finally hard-codes
  `https://afrilink01.vercel.app`.
- Role + an `applications` row are created automatically by a `handle_new_user`
  Postgres trigger (not shown in this repo's function list — a DB trigger on
  `auth.users`), seeded from `raw_user_meta_data.role`. This means the
  Flutter client's `signUp` call MUST include `data: {full_name, role}` in
  the same shape or the downstream role/application bootstrap will not fire.
- Error handling: `'User already registered'` → friendly "Account Exists" message; all other errors go through `getUserFriendlyError()`.
- On success (`data.user` present): app immediately calls
  `onSignupSuccess(data.user.id)`, sending the user into the phone-verification
  step (see below) — a session already exists by this point (unless the
  project has "confirm email" enabled, in which case `data.session` is null and
  the app should also handle the pending-confirmation state — check project
  Auth settings before assuming a session exists after sign up).

## Email confirmation
- Standard Supabase confirm-email flow using the `signup` template rendered by
  `auth-email-hook`. The confirmation link's redirect target is whatever
  `emailRedirectTo` was passed at signUp time (`${appUrl}/`), i.e. the app root
  — the SPA then reads the resulting session from the URL hash automatically
  via supabase-js. Flutter must handle the equivalent deep link
  (`afrilink://` custom scheme or a universal/app link to `/`) and call
  `supabase.auth.getSessionFromUrl()`/rely on `supabase_flutter`'s deep link
  handling for magic-link/confirmation URLs.

## Sign in (`LoginPage`)
```
supabase.auth.signInWithPassword({ email, password })
```
- Errors mapped: `'Invalid login credentials'` → generic validation message;
  `'Email not confirmed'` → "verify your email" prompt; otherwise
  `getUserFriendlyError(error.message)`.
- On success, navigates to `'dashboard'` view. Role/session state is populated
  by the global `onAuthStateChange` listener in `AuthProvider`, not by this
  component directly.

## Password reset flow
1. **Request** (`ForgotPasswordPage`):
   ```
   const redirectTo = await getResetRedirectUrlAsync(); // `${appUrl}/reset-password`
   supabase.auth.resetPasswordForEmail(email, { redirectTo });
   ```
   Always shows a generic "If an account exists..." success message regardless
   of whether the email exists or the call errored (prevents account
   enumeration). Errors are only logged to console.
2. **Email delivery**: `auth-email-hook` renders the `recovery` template and
   **forcibly rewrites** the confirmation URL's `redirect_to` param (or the
   whole URL, if it's a Lovable preview host) to the hard-coded
   `MAIN_APP_URL = https://afrilink01.vercel.app/reset-password` — i.e. the
   recovery link always lands on the *main app* domain's `/reset-password`
   route, never the shop subdomain, and never a preview URL, irrespective of
   what `VITE_APP_URL` is configured to elsewhere. A Flutter/mobile deep-link
   strategy must intercept this exact URL pattern (universal link on
   `afrilink01.vercel.app/reset-password`) to hand off into the app — see
   `src/utils/resetUrl.ts`'s `getResetDeepLink(token)` which builds
   `afrilink://reset-password?token=<token>` as the Phase-2 native handoff
   (TODOs in that file describe the required `assetlinks.json` /
   `apple-app-site-association` / intent-filter / Associated-Domains wiring —
   still to be implemented, treat as a spec for the Flutter app's own linking
   setup, not something already live).
3. **Landing on `/reset-password`** (`Index.tsx` routing + `recoveryLocked`):
   - The SPA detects either `window.location.pathname === '/reset-password'`
     or a `type=recovery` hash fragment on initial load, and immediately sets
     `recoveryLocked.current = true` plus forces `view = 'reset-password'`.
   - It also listens for the Supabase `PASSWORD_RECOVERY` auth event (fired
     once supabase-js parses the recovery token out of the URL fragment and
     establishes a temporary "recovery session") and re-applies the same lock
     if the event arrives after the initial URL check.
   - **Recovery lock semantics**: while `recoveryLocked.current` is true, the
     app's view-state setter (`setViewState`) refuses to navigate away to any
     view other than `'reset-password'` or `'login'` — this prevents other
     effects (e.g. "user has a role → redirect to dashboard") from hijacking
     the screen away from the password-reset form while a recovery session is
     active. The lock is released only after the reset completes
     (`recoveryLocked.current = false` set inside the view-change guard when
     transitioning to `'login'`).
   - Flutter equivalent: on receiving the recovery deep link, the app must
     enter an equivalent "locked" state/route that cannot be preempted by
     normal auth-state-driven navigation until the user finishes setting a
     new password (or explicitly backs out).
4. **`ResetPasswordPage`**:
   - On mount, checks `supabase.auth.getSession()` for an existing (recovery)
     session and also listens for `PASSWORD_RECOVERY` / `INITIAL_SESSION`
     events, with a 2.5s safety timeout so the UI doesn't hang if the event is
     delayed. If no session materializes, shows an "Invalid or Expired Link"
     state with a button back to `forgot-password`.
   - On submit: validates password (zod: min 8 chars, confirm-match), then
     `supabase.auth.updateUser({ password })`.
   - On success: shows a 3-second "Password Reset Complete" confirmation, then
     navigates to `'login'` and calls `supabase.auth.signOut({ scope: 'global' })`
     to invalidate the temporary recovery session everywhere (order matters:
     navigate first to release the recovery lock, small delay, then sign out —
     replicate this sequencing in Flutter to avoid UI flicker/race with the
     auth-state listener).
   - A "Open in Winger App" button extracts the `access_token` (from the URL
     hash) or `token` query param and builds `getResetDeepLink(token)` =
     `afrilink://reset-password?token=<token>` for handing off to a native app
     — this is the exact contract the Flutter app should register a URL
     scheme handler for.

## Session persistence & refresh
- `persistSession: true` + `autoRefreshToken: true` — supabase-js stores the
  session (access + refresh token) in `localStorage` and silently refreshes
  before expiry. `supabase_flutter` does the same by default; ensure
  `Supabase.initialize` uses persistent (not memory-only) storage.
- `AuthProvider` reads the session two ways on mount, in this order:
  1. Registers `supabase.auth.onAuthStateChange` **first**.
  2. Then calls `supabase.auth.getSession()` to hydrate any existing session.
  This ordering matters because Supabase can fire an initial auth event before
  `getSession()` resolves; registering the listener first guarantees no event
  is missed. Flutter should mirror this: subscribe to
  `Supabase.instance.client.auth.onAuthStateChange` before/independently of
  calling `currentSession`.

## `onAuthStateChange` listener & the setTimeout deadlock-avoidance pattern
```
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setUser(session?.user ?? null);
  if (session?.user) {
    setTimeout(() => { fetchUserRoles(session.user.id); }, 0);   // <-- deferred
  } else {
    setUserRole(null); setAvailableRoles([]);
  }
  setLoading(false);
});
```
- The role fetch (`supabase.from('user_roles').select(...)`, a network/DB call)
  is deliberately wrapped in `setTimeout(..., 0)` instead of being awaited
  directly inside the callback. This is the **documented Supabase pattern** to
  avoid a deadlock: making a Supabase call synchronously inside the
  `onAuthStateChange` callback can block the auth client's internal state
  machine (the callback runs inside the same tick that manages session
  locking), so any additional Supabase calls must be deferred to the next
  event-loop tick.
  In Flutter, the equivalent hazard doesn't exist in the same form (no shared
  JS event loop with the SDK's internal mutex the same way), but as a safe
  practice still avoid awaiting further Supabase calls synchronously inside
  the `onAuthStateChange` stream listener callback — schedule them via
  `Future.microtask`/`scheduleMicrotask` or fire-and-forget with `unawaited()`
  to keep the pattern equivalent and avoid any analogous reentrancy issues.

## Role fetching & multi-role model
- Roles live in `user_roles(user_id, role)`, `role` ∈ `'vendor' | 'affiliate' | 'admin'` (enum `app_role`). A user may hold multiple roles simultaneously (e.g. vendor **and** affiliate); `admin` is a separate elevated role, not exposed through `AuthProvider`'s `userRole`/`availableRoles` (those are typed to only `'vendor'|'affiliate'`) — admin-ness is checked separately via the `is_admin` RPC wherever admin UI/edge-function access is gated.
- `fetchUserRoles(userId)`:
  ```
  supabase.from('user_roles').select('role').eq('user_id', userId)
  ```
  Sets `availableRoles` to the full list. Then determines the **active** role:
  - Reads `localStorage['afrilink_active_role_' + userId]`.
  - If that saved role is present in `availableRoles`, uses it.
  - Otherwise defaults to `availableRoles[0]` and persists that choice to the
    same localStorage key.
- **`afrilink_active_role_<userId>` localStorage key** is the single source of
  truth for "which dashboard is currently active" for multi-role users — it is
  **not** stored server-side. Flutter must replicate this exact per-user key
  pattern using local persistent storage (e.g. `shared_preferences` keyed by
  `afrilink_active_role_$userId`) so behavior (and any potential shared
  device/browser expectations) match.
- `switchRole(newRole)`: only allowed if `newRole` is already in
  `availableRoles`; updates in-memory state + the localStorage key. No network
  call.
- `addRole(newRole)`: if the user already has the role, delegates to
  `switchRole`. Otherwise inserts a new `user_roles` row
  (`{user_id, role: newRole}`) directly via the client (RLS must allow
  self-insert of a *non-admin* role — verify the actual RLS policy before
  assuming any role string is accepted; in practice this path is used for a
  vendor "become an affiliate too" style upsell, not for granting admin).
  After the insert, refetches all roles and switches to the new one.
- `refreshRoles()`: re-runs `fetchUserRoles` for the current user — call after
  any external event that might have changed role assignment (e.g. an admin
  approving an `applications` row elsewhere, which is picked up via the
  `notifications` realtime channel + a manual "refresh" action, not an
  automatic role-table subscription).

## Sign out
```
await supabase.auth.signOut();
setUser(null); setSession(null); setUserRole(null); setAvailableRoles([]);
```
Note: this is a **local-scope** sign out (default scope), except the
password-reset completion flow explicitly uses `signOut({ scope: 'global' })`
to kill the recovery session across all devices/tabs. Flutter should offer
both: a normal sign-out (revoke current session/refresh token) and reuse the
global-scope variant specifically after a password reset.

## Protected view logic / permission checks
- There is no traditional router-guard/HOC in this codebase (`Index.tsx` is a
  single-page state machine driven by a `view` string, not React Router
  routes, for the authenticated app shell). The pattern to replicate in
  Flutter:
  - If `loading` (initial session check in flight) → show a splash/loading
    screen, do not navigate.
  - If `recoveryLocked` → force the password-reset screen regardless of auth
    state (see above).
  - Else if `user && userRole && view !== 'verification'` → route to the
    dashboard for `userRole`.
  - Else if `user` but no `userRole` yet (e.g. mid on-boarding, application
    pending) → route to a `'verification'`/onboarding-status view.
  - Else (`!user`) → show landing/login/signup views.
- **Admin role restrictions**: there is no dedicated "admin app view" wired
  into this consumer app's `userRole` state (`admin` is excluded from the
  `AuthContextType.userRole` union entirely). Admin capabilities are only
  reachable through the `admin-actions` edge function, which independently
  re-verifies `is_admin(auth.uid())` server-side on every call — a Flutter
  build should likewise never trust a locally cached "is admin" flag for
  authorization, only for UI affordance, and must always let the backend's
  `is_admin` check be the actual gate.

## Phone OTP verification (onboarding step, not Supabase native phone auth)
- Flow (`PhoneVerificationFlow`, `RegistrationFlow`):
  1. `supabase.from('profiles').update({ phone, phone_verified:false }).eq('id', userId)` — save the phone number first, unverified.
  2. `supabase.functions.invoke('send-otp', { body: { phone } })` — triggers Briq SMS OTP (see API_REFERENCE.md §9).
  3. User enters the 6-digit code; `supabase.functions.invoke('verify-otp', { body: { phone, code } })`.
  4. On `{ verified: true }`: `supabase.from('profiles').update({ phone_verified: true }).eq('id', userId)` — the **client**, not the edge function, flips the flag. A Flutter implementation must perform this same follow-up write; there is no server-side auto-update.
- This OTP step is entirely independent of Supabase Auth sessions — it never
  creates or modifies an `auth.users` row or session; it only gates
  `profiles.phone_verified`, which the app treats as a required onboarding
  milestone before granting full dashboard access.

## Custom branded auth emails (`auth-email-hook`)
- All Supabase Auth transactional emails (`signup`, `invite`, `magiclink`,
  `recovery`, `email_change`, `reauthentication`) are intercepted by Supabase's
  **Send Email Hook**, routed to the `auth-email-hook` edge function, which
  renders Winger-branded React-Email templates and sends via the Lovable Email
  API rather than Supabase's default email sender. This is purely a delivery
  concern — it doesn't change the client-side auth call, but it does mean:
  - The `recovery` email's link is hard-pinned to `afrilink01.vercel.app/reset-password` (see above), regardless of which subdomain initiated the flow.
  - Other email types keep the `redirect_to`/link as originally generated by Supabase, only substituting the branded HTML.
  - Flutter has no direct interaction with this function; it's purely a backend/email-delivery concern to be aware of when testing reset/signup flows end-to-end.
