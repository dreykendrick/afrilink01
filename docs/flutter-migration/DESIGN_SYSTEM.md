# PART 6 — Design System

> Source of truth files: `src/index.css`, `tailwind.config.ts`, `src/App.css`, `components.json`, `index.html`, `vite.config.ts`.
> All colors are defined as HSL CSS custom properties (space-separated triplets, no `hsl()` wrapper) consumed via `hsl(var(--token))`. Hex equivalents below were computed from the raw H/S/L values for Flutter `Color(0xFF......)` porting.

## 6.1 Theme Engine

- Library: `next-themes`.
- Configured in `src/App.tsx`: `<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>`.
  - `attribute="class"` → toggles the `dark` class on `<html>`; all dark-mode CSS lives under `.dark { ... }` selector overrides in `src/index.css`.
  - `defaultTheme="dark"` → app boots in dark mode unless the OS/user preference or persisted `theme` localStorage key says otherwise.
  - `enableSystem` → respects `prefers-color-scheme` when no explicit user choice stored.
- `components.json` (shadcn/ui config): style "default", `tailwind.cssVariables: true`, `baseColor: "slate"`, no class prefix, RSC disabled, aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`.
- **Flutter equivalent**: `ThemeMode.dark` default with `ThemeMode.system` fallback logic, `SharedPreferences`-backed override, and two `ThemeData` objects (light/dark) mirroring the token tables below.

## 6.2 CSS Custom Properties — Light Mode (`:root`)

| Token | HSL raw | Hex | Semantic meaning |
|---|---|---|---|
| `--background` | `0 0% 98%` | `#FAFAFA` | App/page background |
| `--foreground` | `222 47% 11%` | `#0F1729` | Primary body text |
| `--card` | `0 0% 100%` | `#FFFFFF` | Card/surface background |
| `--card-foreground` | `222 47% 11%` | `#0F1729` | Text on cards |
| `--popover` | `0 0% 100%` | `#FFFFFF` | Popover/dropdown/tooltip surface |
| `--popover-foreground` | `222 47% 11%` | `#0F1729` | Text on popovers |
| `--primary` | `32 95% 50%` | `#F98806` | Brand amber — primary actions/CTAs |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text/icons on primary surfaces |
| `--secondary` | `220 14% 96%` | `#F3F4F6` | Secondary buttons/surfaces |
| `--secondary-foreground` | `222 47% 11%` | `#0F1729` | Text on secondary surfaces |
| `--muted` | `220 14% 96%` | `#F3F4F6` | Muted backgrounds (skeletons, subtle fills) |
| `--muted-foreground` | `220 9% 46%` | `#6B7280` | De-emphasized/secondary text |
| `--accent` | `32 95% 50%` | `#F98806` | Accent = same as primary (amber) |
| `--accent-foreground` | `0 0% 100%` | `#FFFFFF` | Text on accent surfaces |
| `--destructive` | `0 84% 60%` | `#EF4343` | Errors, delete actions |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Text on destructive surfaces |
| `--border` | `220 13% 91%` | `#E5E7EB` | Default border color |
| `--input` | `220 13% 91%` | `#E5E7EB` | Input border color |
| `--ring` | `32 95% 50%` | `#F98806` | Focus ring color |
| `--radius` | `1rem` | — | Base corner radius (16px) |
| `--sidebar-background` | `0 0% 100%` | `#FFFFFF` | Sidebar surface |
| `--sidebar-foreground` | `222 47% 11%` | `#0F1729` | Sidebar text |
| `--sidebar-primary` | `32 95% 50%` | `#F98806` | Sidebar active/primary item |
| `--sidebar-primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on sidebar primary |
| `--sidebar-accent` | `220 14% 96%` | `#F3F4F6` | Sidebar hover/accent |
| `--sidebar-accent-foreground` | `222 47% 11%` | `#0F1729` | Text on sidebar accent |
| `--sidebar-border` | `220 13% 91%` | `#E5E7EB` | Sidebar border |
| `--sidebar-ring` | `32 95% 50%` | `#F98806` | Sidebar focus ring |

### Brand palette ("afrilink-*" tokens, legacy name retained after Winger rebrand)

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--afrilink-amber` | `32 95% 50%` | `#F98806` | Primary brand color, gradients |
| `--afrilink-orange` | `25 95% 48%` | `#EF6706` | Gradient pairing with amber |
| `--afrilink-purple` | `280 70% 50%` | `#9D26D9` | Hero gradient, purple accents |
| `--afrilink-slate-900` | `222 47% 11%` | `#0F1729` | Darkest slate (text/dark bg) |
| `--afrilink-slate-800` | `215 28% 17%` | `#1F2937` | Dark surface tier |
| `--afrilink-slate-700` | `217 19% 27%` | `#384252` | Mid slate tier |
| `--afrilink-green` | `142 71% 40%` | `#1EAE53` | Success/earnings/commission accents |
| `--afrilink-blue` | `199 89% 45%` | `#0D98D9` | Info accents, blue gradient |
| `--afrilink-pink` | `330 81% 55%` | `#E92F8C` | Purple→pink gradient accent |

Exposed in Tailwind as `text-afrilink-amber`, `bg-afrilink-green`, `afrilink.slate.900` etc. (see `tailwind.config.ts` → `theme.extend.colors.afrilink`).

## 6.3 CSS Custom Properties — Dark Mode (`.dark`)

| Token | HSL raw | Hex | Notes |
|---|---|---|---|
| `--background` | `222 47% 11%` | `#0F1729` | Dark navy background |
| `--foreground` | `0 0% 100%` | `#FFFFFF` | White text |
| `--card` | `215 28% 17%` | `#1F2937` | Elevated dark surface |
| `--card-foreground` | `0 0% 100%` | `#FFFFFF` | Text on dark cards |
| `--popover` | `215 28% 17%` | `#1F2937` | Popover surface |
| `--popover-foreground` | `0 0% 100%` | `#FFFFFF` | Popover text |
| `--primary` | `32 95% 56%` | `#F99624` | Brighter amber for dark bg contrast |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on primary |
| `--secondary` | `217 33% 17%` | `#1D283A` | Secondary dark surface |
| `--secondary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on secondary |
| `--muted` | `217 33% 17%` | `#1D283A` | Muted dark surface |
| `--muted-foreground` | `215 16% 47%` | `#65758B` | Muted dark text |
| `--accent` | `32 95% 56%` | `#F99624` | Accent (matches primary) |
| `--accent-foreground` | `0 0% 100%` | `#FFFFFF` | Text on accent |
| `--destructive` | `0 84% 60%` | `#EF4343` | Same as light |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Text on destructive |
| `--border` | `217 33% 17%` | `#1D283A` | Dark border |
| `--input` | `217 33% 17%` | `#1D283A` | Dark input border |
| `--ring` | `32 95% 56%` | `#F99624` | Focus ring |
| `--sidebar-background` | `220 26% 14%` | `#1A212D` | Dark sidebar surface |
| `--sidebar-foreground` | `0 0% 100%` | `#FFFFFF` | Sidebar text |
| `--sidebar-primary` | `32 95% 56%` | `#F99624` | Sidebar active |
| `--sidebar-primary-foreground` | `0 0% 100%` | `#FFFFFF` | — |
| `--sidebar-accent` | `217 33% 17%` | `#1D283A` | Sidebar hover |
| `--sidebar-accent-foreground` | `0 0% 100%` | `#FFFFFF` | — |
| `--sidebar-border` | `217 33% 17%` | `#1D283A` | — |
| `--sidebar-ring` | `32 95% 56%` | `#F99624` | — |

Dark brand palette:

| Token | HSL | Hex |
|---|---|---|
| `--afrilink-amber` | `32 95% 56%` | `#F99624` |
| `--afrilink-orange` | `25 95% 53%` | `#F97415` |
| `--afrilink-purple` | `280 70% 50%` | `#9D26D9` (unchanged) |
| `--afrilink-slate-900` | `222 47% 11%` | `#0F1729` (unchanged) |
| `--afrilink-slate-800` | `215 28% 17%` | `#1F2937` (unchanged) |
| `--afrilink-slate-700` | `217 19% 27%` | `#384252` (unchanged) |
| `--afrilink-green` | `142 71% 45%` | `#21C45D` |
| `--afrilink-blue` | `199 89% 48%` | `#0DA2E7` |
| `--afrilink-pink` | `330 81% 60%` | `#EC4699` |

## 6.4 Gradients

Defined as CSS vars with raw `linear-gradient(135deg, hsl(...), hsl(...))`, exposed via Tailwind `backgroundImage` utilities: `bg-gradient-primary`, `bg-gradient-hero`, `bg-gradient-card`, `bg-gradient-green`, `bg-gradient-blue`, `bg-gradient-purple`.

**Light mode:**
| Gradient | Definition | Approx hex stops |
|---|---|---|
| `--gradient-primary` | 135deg, hsl(32 95% 50%) → hsl(25 95% 48%) | `#F98806` → `#EF6706` |
| `--gradient-hero` | 135deg, hsl(220 14% 96%) → hsl(280 70% 95%) → hsl(220 14% 96%) | `#F3F4F6` → `#F3E5FC` → `#F3F4F6` |
| `--gradient-card` | 135deg, hsl(0 0% 100% / 0.8) → hsl(220 14% 96% / 0.5) | `#FFFFFF` @80% → `#F3F4F6` @50% |
| `--gradient-green` | 135deg, hsl(142 71% 40%) → hsl(158 64% 48%) | `#1EAE53` → `#2FD497` |
| `--gradient-blue` | 135deg, hsl(199 89% 45%) → hsl(189 94% 40%) | `#0D98D9` → `#09ACC2` |
| `--gradient-purple` | 135deg, hsl(280 70% 50%) → hsl(330 81% 55%) | `#9D26D9` → `#E92F8C` |

**Dark mode overrides:**
| Gradient | Definition | Approx hex stops |
|---|---|---|
| `--gradient-primary` | hsl(32 95% 56%) → hsl(25 95% 53%) | `#F99624` → `#F97415` |
| `--gradient-hero` | hsl(222 47% 11%) → hsl(280 70% 30%) → hsl(222 47% 11%) | `#0F1729` → `#5E1785` → `#0F1729` |
| `--gradient-card` | hsl(215 28% 17% / 0.5) → hsl(217 19% 27% / 0.3) | `#1F2937` @50% → `#384252` @30% |
| `--gradient-green` | hsl(142 71% 45%) → hsl(158 64% 52%) | `#21C45D` → `#3EDBA5` |
| `--gradient-blue` | hsl(199 89% 48%) → hsl(189 94% 43%) | `#0DA2E7` → `#0BB6CE` |
| `--gradient-purple` | hsl(280 70% 50%) → hsl(330 81% 60%) | `#9D26D9` → `#EC4699` |

Also used ad-hoc via Tailwind's arbitrary `bg-gradient-to-br from-X to-Y` (e.g. `StatsCard` receives a `gradient` prop string like `"from-afrilink-amber to-afrilink-orange"`, `InstallPrompt` uses `from-primary to-accent`).

**Flutter mapping**: `LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [...])` (135° ≈ top-left→bottom-right diagonal).

## 6.5 Shadows

| Token | CSS value | Notes |
|---|---|---|
| `--shadow-glow` (light) | `0 0 40px hsl(32 95% 50% / 0.2)` | Amber glow, 20% opacity, used on CTA hover (`hover:shadow-glow`) |
| `--shadow-glow` (dark) | `0 0 40px hsl(32 95% 56% / 0.3)` | Brighter amber, 30% opacity |
| `--shadow-card` (light) | `0 10px 30px hsl(222 47% 11% / 0.08)` | Soft card elevation |
| `--shadow-card` (dark) | `0 10px 30px hsl(222 47% 11% / 0.5)` | Stronger dark elevation |

Exposed as Tailwind `shadow-glow`, `shadow-card`. Standard shadcn shadows also used: `shadow-sm` (Card), `shadow-md`, `shadow-lg` (dialogs/popovers/dropdowns), `shadow-xl` (InstallPrompt card).

Flutter: use `BoxShadow(color, blurRadius, offset)`; glow ⇒ blurRadius 40, spreadRadius 0, offset (0,0), color amber @ 20–30% alpha; card ⇒ blurRadius 30, offset (0,10), color slate-900 @ 8–50% alpha.

## 6.6 Typography

- No custom `fontFamily` is declared in `tailwind.config.ts` or `index.css` — the app relies on Tailwind's default sans stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, ...`). `index.html` preconnects to Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) but no `<link>` stylesheet import was found, so effectively **system font stack** is in production use.
- Scale used across the app (Tailwind defaults observed in components): `text-[10px]`, `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px, `CardTitle`), `text-3xl` (30px, StatsCard value on ≥sm).
- Font weights: `font-medium` (500), `font-semibold` (600, most headings/buttons/badges), `font-bold` (700, StatsCard values, ProductCard titles).
- Line-height / tracking: `leading-none tracking-tight` on `CardTitle`/`DialogTitle`/`DrawerTitle`; `leading-relaxed` on alert paragraphs.
- Flutter mapping: define a `TextTheme` using system font (`Roboto`/`SF Pro` platform defaults or a chosen fallback), sizes 10/12/14/16/18/20/24/30 with matching FontWeights (w500/w600/w700).

## 6.7 Spacing Scale

Standard Tailwind spacing scale used throughout (no custom overrides): `0.5=2px,1=4px,1.5=6px,2=8px,3=12px,4=16px,6=24px,8=32px,10=40px,12=48px,16=64px,20=80px`. Notable custom utility:
- `.pb-mobile-nav { padding-bottom: 5rem; }` (80px) — reserves space above the fixed `MobileBottomNav` (h-16 = 64px + safe area) for scrollable content.
- Container: `center: true`, `padding: 2rem`, `2xl` breakpoint screen = `1400px` (see `tailwind.config.ts` `theme.container`).

## 6.8 Border Radius Tokens

| Tailwind class | Value | Formula |
|---|---|---|
| `rounded-lg` | `1rem` (16px) | `var(--radius)` |
| `rounded-md` | `0.875rem` (14px) | `calc(var(--radius) - 2px)` |
| `rounded-sm` | `0.75rem` (12px) | `calc(var(--radius) - 4px)` |
| `rounded-xl` / `rounded-2xl` / `rounded-full` | Tailwind defaults (12px / 16px / 9999px) | used ad hoc on cards/badges/buttons (e.g. StatsCard `rounded-xl sm:rounded-2xl`) |

Flutter: `BorderRadius.circular(16)` for `lg`, `14` for `md`, `12` for `sm`; base radius is notably large (pill-ish rounded cards), giving the app a soft, rounded aesthetic.

## 6.9 Icon Set

- Library: **lucide-react** (SVG icon set), imported per-component as tree-shaken named imports, e.g. `import { Home, Store, User } from 'lucide-react'`.
- 64 files import from `lucide-react`; ~166 distinct icon names referenced app-wide. Confirmed icons in the audited files include:
  - Navigation/UI: `Home`, `Store`, `User`, `HelpCircle`, `Settings`, `X`, `ChevronRight`, `ChevronDown`, `ChevronUp`, `ArrowLeft`, `ArrowRight`, `Check`, `Circle`, `Dot`
  - Commerce: `ShoppingCart`
  - Status/feedback: `CheckCircle`, `Loader2` (animated spinner via `animate-spin`)
  - PWA/install: `Download`, `Share`, `Plus`
- Icon sizing convention: Tailwind `w-*/h-*` utility classes (e.g. `w-4 h-4`, `w-5 h-5`, `w-6 h-6`, responsive `w-6 h-6 sm:w-8 sm:h-8`). Button CSS forces `[&_svg]:size-4 [&_svg]:shrink-0` by default (16px icons unless overridden).
- Flutter mapping: use `lucide_icons` Flutter package (community port) or Material equivalents mapped 1:1 per icon name; preserve the same numeric sizes (16/20/24/32px).

## 6.10 Buttons

`buttonVariants` (CVA) base classes: `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:ring-2 ... disabled:opacity-50`.

**Variants:**
| Variant | Style |
|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| `outline` | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` (transparent base) |
| `link` | `text-primary underline-offset-4 hover:underline` (no background) |

**Sizes:**
| Size | Style |
|---|---|
| `default` | `h-10 px-4 py-2` (40px tall) |
| `sm` | `h-9 rounded-md px-3` (36px) |
| `lg` | `h-11 rounded-md px-8` (44px) |
| `icon` | `h-10 w-10` (square, 40×40) |

- Focus ring: 2px `ring-ring` offset 2px. Disabled: `pointer-events-none opacity-50`.
- Custom ad-hoc buttons in app components (e.g. ProductCard "Add to Cart") bypass the shadcn Button and hand-roll classes: `bg-gradient-primary text-white rounded-lg font-semibold hover:shadow-glow active:scale-95 touch-manipulation`.
- Global touch rule: `button, a, [role="button"] { touch-manipulation }`; `.touch-target { min-height: 44px; min-width: 44px; }` ensures accessible tap targets.
- `.touch-feedback` utility: `active:scale-95 active:opacity-80 transition-transform duration-100` for custom pressable elements.

## 6.11 Card Anatomy

`Card` = `rounded-lg border bg-card text-card-foreground shadow-sm`.
Sub-parts: `CardHeader` (`flex flex-col space-y-1.5 p-6`), `CardTitle` (`text-2xl font-semibold leading-none tracking-tight`), `CardDescription` (`text-sm text-muted-foreground`), `CardContent` (`p-6 pt-0`), `CardFooter` (`flex items-center p-6 pt-0`).
App-specific cards (StatsCard, ProductCard) diverge: rounded-xl/2xl, `shadow-card`, gradient or plain `bg-card` fills, `border border-border hover:border-primary`, entrance animation `animate-in fade-in zoom-in-95 duration-500` with staggered `animationDelay`.

## 6.12 Input Styling

`Input`: `flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50`. File-input styling handled via `file:` variant utilities. 40px height, matches Button default height for form alignment.

`Select` trigger mirrors Input styling (`h-10`, same border/radius/focus), with a `ChevronDown` indicator (50% opacity) and Radix `Content` popover (`rounded-md border bg-popover shadow-md`, animated in/out with fade+zoom+slide-from-side).

`InputOTP`: 40×40px (`h-10 w-10`) bordered slots, `first:rounded-l-md last:rounded-r-md`, active slot gets `ring-2 ring-ring ring-offset-background` and `z-10`; blinking caret via `.animate-caret-blink` on a 1px-wide bar.

## 6.13 Animations & Keyframes

Tailwind-config keyframes (via `tailwindcss-animate` plugin, driven by Radix `data-state`):
- `accordion-down` / `accordion-up`: height 0 ↔ `var(--radix-accordion-content-height)`, `0.2s ease-out`.
- Radix-driven `animate-in`/`animate-out` utility classes power fade/zoom/slide transitions on Dialog, Sheet, Dropdown, Select, Tooltip, Toast content (`fade-in-0/fade-out-0`, `zoom-in-95/zoom-out-95`, `slide-in-from-*`, `slide-out-to-*`).

Custom keyframes in `src/index.css`:
- `@keyframes shimmer`: `translateX(-100%) skewX(-12deg)` → `translateX(200%) skewX(-12deg)` (skeleton shimmer sweep effect, though the shadcn `Skeleton` itself just uses `animate-pulse`).
- `@keyframes spin`: standard 360° rotation (pull-to-refresh spinner support, duplicating Tailwind's built-in `animate-spin`).

App-level motion classes seen in components: `animate-in fade-in zoom-in-95 duration-500` (StatsCard/ProductCard mount), `animate-in slide-in-from-bottom-4 duration-300` (InstallPrompt), `animate-in slide-in-from-top-5` (Notification toast), `hover:scale-105`, `active:scale-95`/`active:scale-[0.98]`, `transition-transform duration-300`, `transition-all duration-200`.

Reduced motion respected globally: `@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth } }` (App.css also gates `.logo-spin` behind the same media query, though that is Vite boilerplate not used in the real UI).

Global overscroll: `html { overscroll-behavior: none; }` plus inline `<style>` in `index.html`: `overscroll-behavior-y: contain` on `html, body`, and safe-area padding applied directly to `body`.

Flutter mapping: use `AnimatedContainer`/`AnimatedScale`/implicit animations (200–500ms, `Curves.easeOut`) for hover/active scale & fade+zoom entrance; `Curves.easeOut` ~ CSS ease-out.

## 6.14 Loading Indicators

- **Spinner**: `Loader2` icon from lucide-react + `animate-spin` Tailwind class (continuous 360° rotation, ~1s linear). Used in `PullToRefresh` (scaled/rotated proportionally to pull progress via inline `transform`) and generically for async button/page states elsewhere in the app.
- **Skeleton**: `<Skeleton>` = `animate-pulse rounded-md bg-muted` — a plain pulsing muted-color block sized via passed className (`h-4 w-full`, etc.) to approximate loading content shapes.
- **Progress bar**: Radix `Progress` — track `h-4 w-full rounded-full bg-secondary`, indicator `h-full bg-primary transition-all`, positioned via `translateX(-{100-value}%)`.
- **Pull-to-refresh** (`PullToRefresh.tsx`): custom touch-gesture-driven indicator; threshold 80px, max pull 120px, resistance factor 0.4; shows a rotating/scaling circular `Loader2` inside a `bg-primary/10` circle whose rotation/scale is proportional to pull progress (`rotate(progress*180deg) scale(0.5+progress*0.5)`), switches to `animate-spin` once refreshing.

## 6.15 Toasts / Sonner

Two toast systems coexist:
1. **shadcn Toast/Radix** (`toast.tsx` + `toaster.tsx` + `use-toast.ts`): `ToastViewport` fixed at `top-0` on mobile, moves to `bottom-0 right-0` at `sm:` breakpoint, `max-w-[420px]` on `md:`; toast card `rounded-md border p-6 pr-8 shadow-lg`; `default` variant = `bg-background text-foreground`; `destructive` variant = `bg-destructive text-destructive-foreground`; swipe-to-dismiss supported via Radix swipe data-attributes; close `X` button appears on hover/focus.
2. **Sonner** (`sonner.tsx`): theme-aware (`useTheme()` from next-themes passes `light`/`dark`/`system` straight into Sonner), styled via `toastOptions.classNames` to reuse the same background/foreground/border tokens (`bg-background text-foreground border-border shadow-lg`), action button = primary colors, cancel button = muted colors.
3. **Custom `Notification.tsx`**: a bespoke lightweight toast fixed at `top-4 right-4`, auto-dismiss after 3000ms, `bg-card border border-border rounded-xl px-6 py-4 shadow-card`, green `CheckCircle` icon + message, entrance `animate-in slide-in-from-top-5`.

Flutter: use a `ScaffoldMessenger`/`SnackBar` or an overlay-based toast package; replicate positioning (top on mobile / bottom-right on desktop-width), 3s auto-dismiss, and card-like rounded surface with border + shadow-card equivalent.

## 6.16 Dialogs

Radix `Dialog` (`dialog.tsx`): overlay `fixed inset-0 bg-black/80` with fade in/out; content centered (`left-1/2 top-1/2` translated -50%/-50%), `max-w-lg`, `gap-4 border bg-background p-6 shadow-lg`, `sm:rounded-lg` (no radius below `sm`, i.e. full-bleed on very small screens unless overridden), entrance/exit combine fade + zoom(95%) + slide-from-top(48%). Built-in top-right `X` close button (16px icon) with `sr-only` label. `DialogHeader`/`DialogFooter`/`DialogTitle` (`text-lg font-semibold`)/`DialogDescription` (`text-sm text-muted-foreground`) subcomponents.

## 6.17 Drawers / Bottom Sheets (vaul)

`Drawer` wraps **vaul**'s `Drawer.Root` (`shouldScaleBackground` defaults true — background scales down while drawer is open, native iOS-like effect). `DrawerContent`: `fixed inset-x-0 bottom-0 rounded-t-[10px] border bg-background`, `mt-24` reserved top margin, includes a drag handle bar (`mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted`). `DrawerHeader`/`DrawerFooter` follow Dialog's spacing conventions. This is the primary "bottom sheet" pattern for mobile-first flows.

`Sheet` (Radix Dialog-based, not vaul) provides directional slide-in panels (`side`: `top`/`bottom`/`left`/`right`, default `right`), width `w-3/4 sm:max-w-sm` for left/right sheets, full-width for top/bottom, `border-{b,t,r,l}` matching side, `duration-300` close / `duration-500` open.

Flutter equivalents: `showModalBottomSheet` with `isScrollControlled` + custom drag handle + background scale via `Transform.scale` on route transition, for vaul-style Drawer; `showGeneralDialog`/side-`Drawer` widget for Sheet.

## 6.18 Badges & Chips

`Badge` (CVA): base `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold`. Variants: `default` (`bg-primary text-primary-foreground`), `secondary` (`bg-secondary text-secondary-foreground`), `destructive` (`bg-destructive text-destructive-foreground`), `outline` (`text-foreground`, transparent bg, visible border). Fully pill-shaped (rounded-full).

App-specific "chips" (not using the Badge component, hand-rolled `<span>`s): ProductCard category chip (`text-[10px] bg-primary/90 text-primary-foreground px-2 py-0.5 rounded-full backdrop-blur-sm`) and commission chip (`bg-afrilink-green/90 text-white`), both overlaid on product images with `backdrop-blur-sm` translucency.

## 6.19 Switch, Avatar, Tooltip, Alert, Carousel — quick reference

- **Switch**: `h-6 w-11` pill track, `border-2 border-transparent`, checked = `bg-primary`, unchecked = `bg-input`; thumb `h-5 w-5 rounded-full bg-background shadow-lg`, translates `x-5` when checked.
- **Avatar**: `h-10 w-10 rounded-full overflow-hidden`; `AvatarImage` = `aspect-square h-full w-full`; `AvatarFallback` = centered `bg-muted` circle for initials/icon.
- **Tooltip**: Radix, `rounded-md border bg-popover px-3 py-1.5 text-sm shadow-md`, fade+zoom(95%) in/out, `sideOffset=4`, directional slide based on `data-side`.
- **Alert**: `rounded-lg border p-4`, icon absolutely positioned top-left (`[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4`), content padded left when icon present; `destructive` variant tints border/text/icon with `--destructive`.
- **Carousel**: Embla-powered (`embla-carousel-react`), horizontal or vertical axis, `CarouselContent` uses negative margin trick (`-ml-4`) with children padded (`pl-4`) for gap simulation; `CarouselPrevious`/`Next` are circular icon Buttons (`h-8 w-8 rounded-full`) absolutely positioned outside the track, disabled when `canScroll{Prev,Next}` is false; supports keyboard arrow navigation.

## 6.20 Dark Mode Support

- Implemented purely via Tailwind `darkMode: ["class"]` + `next-themes` toggling `.dark` on `<html>`.
- Every semantic token has a light and dark HSL pair (see 6.2/6.3); components never hardcode light/dark-specific colors — they consume the semantic Tailwind classes (`bg-background`, `text-foreground`, `bg-card`, etc.), so dark mode is "free" everywhere the token system is used consistently.
- A few explicit dark-mode overrides do exist outside variables, e.g. `Alert`'s destructive variant: `dark:border-destructive`.
- PWA `theme_color` (browser chrome) is fixed at `#f59e0b` (amber) regardless of light/dark, and `background_color` fixed at `#0f172a` (slate-900-ish) — these are static manifest values, not reactive to in-app theme.

## 6.21 Responsive Breakpoints & Mobile Behaviors

- Tailwind default breakpoints in use: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px); custom container `2xl` screen = `1400px` (`theme.container.screens["2xl"]`).
- JS-side mobile detection: `useIsMobile()` hook (`src/hooks/use-mobile.tsx`) uses `matchMedia('(max-width: 767px)')`, i.e. **MOBILE_BREAKPOINT = 768px**, matching Tailwind's `md`. Returns `boolean | undefined` until first measurement (SSR-safe pattern), listens for viewport `change` events.
- Mobile-first component pattern: most cards/lists use `sm:`-prefixed classes to progressively enhance from a compact mobile layout (e.g. ProductCard shows a category badge overlay + hides description on mobile, then reveals a text category line + description at `sm:`).
- Safe-area utilities (`src/index.css` `@layer utilities`): `.safe-area-top/bottom/left/right` map to `env(safe-area-inset-*)`, used e.g. by `MobileBottomNav` (`safe-area-bottom`) to avoid notch/home-indicator overlap on iOS.
- `.pb-mobile-nav { padding-bottom: 5rem }` — scrollable page containers add this class so content isn't hidden behind the fixed bottom nav (which is `h-16` = 64px plus safe-area inset).
- `MobileBottomNav` is hidden on non-mobile via `sm:hidden`, fixed at `bottom-0 left-0 right-0`, `z-50`, translucent blur (`bg-card/95 backdrop-blur-lg`), top border, 5 equally-flexed nav items (`flex-1`), 16px icons scale to 110% + 10%-opacity pill background when active.
- Other mobile-only utilities: `.scrollbar-hide` (hide scrollbars cross-browser), `.scroll-momentum` (`-webkit-overflow-scrolling: touch`), `.no-select` (disable text selection for touch UIs), `.gpu` (`translateZ(0)` + `will-change: transform` for compositor acceleration), `.touch-feedback` (press feedback), `.touch-target` (44×44 minimum hit area per Apple/Android HIG).
- Custom touch-gesture components (`PullToRefresh`, `SwipeableCard`) implement native-feeling mobile interactions purely in React state + inline transforms (no CSS animation library), important to replicate with Flutter `GestureDetector` + `AnimatedContainer`/physics-based drag in the rebuild.
- Viewport meta in `index.html`: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover` — pinch-zoom disabled, edge-to-edge safe-area support (`viewport-fit=cover`), body gets manual safe-area padding as a fallback/redundant layer to the Tailwind utilities.
