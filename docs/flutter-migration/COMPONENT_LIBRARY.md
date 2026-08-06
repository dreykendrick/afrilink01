# PART 7 — Component Library

## 7.1 App Components

### StatsCard (`src/components/dashboard/StatsCard.tsx`)
- **Purpose**: Gradient KPI tile shown on dashboards (earnings, sales, referrals, etc).
- **Props**: `icon: LucideIcon`, `value: string | number`, `label: string`, `gradient: string` (Tailwind gradient class fragment, e.g. `"from-afrilink-amber to-afrilink-orange"`), `subtext?: string`.
- **States**: static display only (no internal state); hover triggers `hover:scale-105` (desktop pointer).
- **Behavior/Variants**: Icon rendered top, bold value, label, optional smaller subtext; entrance animation `fade-in zoom-in-95 duration-500`; fully responsive sizing (`text-xl sm:text-3xl`, `p-4 sm:p-6`).
- **Where used**: vendor/affiliate dashboards to show stats grids.
- **Dependencies**: `lucide-react` (icon typing only), Tailwind `shadow-card`.

### ProductCard (`src/components/marketplace/ProductCard.tsx`)
- **Purpose**: Marketplace product tile with image, pricing, commission/earnings estimate, add-to-cart CTA.
- **Props**: `product: Product` (title, image, price, category, commission, sales, description), `onAddToCart(productId)`, `onGrabLink(productId)`, `onClick(product)`, `index: number` (used for staggered animation delay).
- **States**: `active:scale-[0.98]` press feedback (mobile), `sm:hover:scale-105` (desktop hover), lazy-loaded image (`loading="lazy"`).
- **Behavior**: Clicking card body calls `onClick`; clicking "Add to Cart" button calls `stopPropagation()` then `onAddToCart`; commission badge computed inline (`price * commission / 100`, rounded); mobile shows compact layout (category as image-overlay chip, description hidden), desktop reveals category text line + description.
- **Where used**: Marketplace grids/lists.
- **Dependencies**: `lucide-react` (`ShoppingCart`), `@/types` (`Product`), `@/utils/currency` (`formatCurrency`).

### InstallPrompt (`src/components/mobile/InstallPrompt.tsx`)
- **Purpose**: PWA "Add to Home Screen" promotion banner + full-screen iOS install guide.
- **Props**: `className?: string`.
- **States**: `dismissed` (persisted 7 days via `localStorage['afrilink_install_dismissed']`), `showIOSGuide` (full-screen takeover for iOS since `beforeinstallprompt` isn't supported there).
- **Behavior**: Reads `usePWA()` for `isInstallable`, `isInstalled`, `isIOS`, `promptInstall`; renders nothing if installed/dismissed/not-installable-and-not-iOS; non-iOS taps "Install" call `promptInstall()` (native browser prompt); iOS taps show a 2-step visual guide (Share → Add to Home Screen) with `Share`/`Plus`/`Download` icons.
- **Layout**: Compact banner fixed at `bottom-20 left-4 right-4` (above mobile nav) on mobile, `sm:bottom-4` on larger screens; full-screen guide is a `fixed inset-0` backdrop-blurred overlay.
- **Dependencies**: `lucide-react` (`Download, X, Share, Plus`), `@/components/ui/button`, `@/hooks/usePWA`, `@/lib/utils` (`cn`).

### MobileBottomNav (`src/components/mobile/MobileBottomNav.tsx`)
- **Purpose**: Fixed 5-tab bottom navigation bar for mobile viewports.
- **Props**: `activeTab: 'dashboard'|'marketplace'|'settings'|'help'|'profile'`, `onNavigate(tab)` callback with a differently-typed action union (`'help-support'`, `'verification-manage'` instead of `'help'`/`'profile'`), `userRole: 'vendor'|'affiliate'`.
- **States**: per-item active/inactive styling (icon scale 110%, 10%-opacity pill bg, full-opacity label when active vs 70% opacity inactive).
- **Behavior**: i18n labels via `react-i18next` `useTranslation()` (`nav.home`, `nav.market`, `nav.settings`, `nav.help`, `nav.verification` keys); `sm:hidden` (mobile-only); `safe-area-bottom` padding.
- **Dependencies**: `lucide-react` (`Home, Store, User, HelpCircle, Settings`), `react-i18next`, `@/lib/utils`.

### PullToRefresh (`src/components/mobile/PullToRefresh.tsx`)
- **Purpose**: Custom touch-driven pull-to-refresh wrapper for scrollable content.
- **Props**: `children: ReactNode`, `onRefresh: () => Promise<void>`, `disabled?: boolean`.
- **States**: `pulling`, `refreshing`, `pullDistance` (0–120px, threshold 80px, resistance 0.4×).
- **Behavior**: `onTouchStart/Move/End` handlers gate on `container.scrollTop === 0`; renders a `Loader2` spinner inside a scaling/rotating circle proportional to pull progress; on release past threshold, calls `onRefresh()` and shows `animate-spin` until resolved.
- **Dependencies**: `lucide-react` (`Loader2`), `@/lib/utils`.

### SwipeableCard (`src/components/mobile/SwipeableCard.tsx`)
- **Purpose**: Generic swipe-to-reveal-action wrapper (e.g. swipe list item to archive/delete).
- **Props**: `children`, `onSwipeLeft?`, `onSwipeRight?`, `leftAction?: ReactNode` (revealed on left-swipe), `rightAction?: ReactNode` (revealed on right-swipe), `className?`, `threshold?` (default 80px).
- **States**: `offset` (translateX, clamped ±120px, 0.6× resistance), `swiping`, gesture-locks to horizontal after 10px movement to avoid hijacking vertical scroll.
- **Behavior**: Background action revealed proportional to swipe distance (`opacity-100` once `|offset| > 20`); on release, if `|offset| >= threshold`, fires the relevant callback; otherwise snaps back (`transition: transform 0.2s ease-out`).
- **Dependencies**: `@/lib/utils`.

### Notification (`src/components/Notification.tsx`)
- **Purpose**: Simple auto-dismissing success toast (custom, not shadcn/Sonner).
- **Props**: `message: string`, `onClose: () => void`.
- **Behavior**: Auto-calls `onClose` after 3000ms via `setTimeout` (cleared on unmount); fixed top-right, slide-in-from-top entrance.
- **Dependencies**: `lucide-react` (`CheckCircle`).

### NavLink (`src/components/NavLink.tsx`)
- **Purpose**: Wrapper around `react-router-dom`'s `NavLink` exposing simple string `activeClassName`/`pendingClassName` props instead of the render-prop `className` function, for ergonomic `cn()` composition.
- **Props**: All standard `NavLinkProps` (minus `className`) plus `className?: string`, `activeClassName?: string`, `pendingClassName?: string`.
- **Behavior**: Internally computes `cn(className, isActive && activeClassName, isPending && pendingClassName)` and forwards a ref.
- **Dependencies**: `react-router-dom`, `@/lib/utils`.

## 7.2 Hooks (supporting components)

### useIsMobile (`src/hooks/use-mobile.tsx`)
- Returns `boolean` (initially `undefined` until measured, coerced with `!!`). Uses `matchMedia('(max-width: 767px)')`, breakpoint constant `MOBILE_BREAKPOINT = 768`. Re-evaluates on viewport `change` events.

### usePWA (`src/hooks/usePWA.tsx`)
- Returns `{ isInstallable, isInstalled, isIOS, promptInstall }`.
- Detects standalone/installed state via `matchMedia('(display-mode: standalone)')` and iOS's `navigator.standalone`.
- Detects iOS via UA sniffing (`/iPad|iPhone|iPod/` + absence of `MSStream`).
- Listens for `beforeinstallprompt` (captures deferred prompt, sets installable) and `appinstalled` events.
- `promptInstall()` triggers the captured native prompt and awaits `userChoice`, returning `true` on acceptance.

## 7.3 shadcn/ui Primitives (`src/components/ui/*`)

All built on Radix UI primitives + `class-variance-authority` (CVA) for variants + `cn()` (clsx+tailwind-merge) for class composition. Full inventory present in the repo: `accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle-group, toggle, tooltip, use-toast`.

Below: the primitives explicitly required for audit, each with props/variants/behavior.

### Button (`button.tsx`)
- **Props**: standard `<button>` attrs + `variant?: default|destructive|outline|secondary|ghost|link`, `size?: default|sm|lg|icon`, `asChild?: boolean` (renders via Radix `Slot` to merge props onto a custom child element, e.g. wrapping a `<Link>`).
- **States**: hover (variant-specific bg shift), `focus-visible` ring, `disabled:pointer-events-none disabled:opacity-50`.
- **Dependencies**: `@radix-ui/react-slot`, `class-variance-authority`.
- **Used**: nearly everywhere (forms, modals, nav, InstallPrompt, etc).

### Card (`card.tsx`)
- **Composition**: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` — all simple `forwardRef` div/heading/paragraph wrappers applying fixed Tailwind class strings, each accepting `className` for extension via `cn()`.
- **Used**: settings pages, forms, generic content panels (not the custom StatsCard/ProductCard which reimplement their own markup).

### Input (`input.tsx`)
- **Props**: all native `<input>` props; `type` passed straight through.
- **States**: `focus-visible` ring, `disabled:cursor-not-allowed disabled:opacity-50`, `placeholder:text-muted-foreground`.
- **Used**: all forms (auth, onboarding, checkout, settings).

### Dialog (`dialog.tsx`)
- **Composition**: `Dialog` (Root), `DialogTrigger`, `DialogPortal`, `DialogOverlay`, `DialogContent` (auto-wraps Portal+Overlay+built-in close button), `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`.
- **Behavior**: Controlled/uncontrolled via Radix `open`/`onOpenChange`; ESC/overlay-click to dismiss; focus-trapped.
- **Dependencies**: `@radix-ui/react-dialog`, `lucide-react` (`X`).
- **Used**: CheckoutModal and other modal flows.

### Drawer (`drawer.tsx`)
- **Composition**: `Drawer` (wraps `vaul`'s Root, `shouldScaleBackground` default `true`), `DrawerTrigger`, `DrawerPortal`, `DrawerClose`, `DrawerOverlay`, `DrawerContent` (includes built-in drag handle), `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription`.
- **Behavior**: Native-like bottom-sheet drag-to-dismiss gesture (from `vaul`), background scale-down effect while open.
- **Dependencies**: `vaul`.

### Sheet (`sheet.tsx`)
- **Props**: `SheetContent` takes `side?: top|bottom|left|right` (default `right`) via CVA `sheetVariants`.
- **Behavior**: Radix-Dialog-based slide-in panel with directional entrance/exit animation classes; includes close `X` button.
- **Dependencies**: `@radix-ui/react-dialog`, `class-variance-authority`, `lucide-react`.

### Badge (`badge.tsx`)
- **Props**: `variant?: default|secondary|destructive|outline`.
- **Used**: status labels, category/commission tags (though app also hand-rolls similar chips outside this component — see DESIGN_SYSTEM 6.18).

### Tabs (`tabs.tsx`)
- **Composition**: `Tabs` (Root), `TabsList` (`bg-muted` pill container), `TabsTrigger` (active state = `bg-background text-foreground shadow-sm`), `TabsContent`.
- **Dependencies**: `@radix-ui/react-tabs`.

### Toast (`toast.tsx` + `toaster.tsx` + `use-toast.ts`)
- **Composition**: `ToastProvider`, `ToastViewport`, `Toast` (CVA variants `default`/`destructive`), `ToastTitle`, `ToastDescription`, `ToastClose`, `ToastAction`.
- **Behavior**: Swipe-to-dismiss (Radix swipe data-attrs drive transform), auto-timeout managed by `use-toast.ts` state manager (`useToast()` hook + global `toast()` function, reducer-based queue, `TOAST_LIMIT`/`TOAST_REMOVE_DELAY` constants).
- **Dependencies**: `@radix-ui/react-toast`.

### Sonner (`sonner.tsx`)
- **Props**: forwards all Sonner `Toaster` props; reads `useTheme()` to sync theme (`light`/`dark`/`system`).
- **Behavior**: exports both `Toaster` (to mount once at app root) and `toast()` (imperative call-site API) re-exported from the `sonner` package.
- **Dependencies**: `next-themes`, `sonner`.

### Dropdown Menu (`dropdown-menu.tsx`)
- **Composition**: Root/Trigger/Portal/Sub/RadioGroup plus styled `Content`, `SubContent`, `Item`, `CheckboxItem` (with `Check` indicator), `RadioItem` (with `Circle` indicator), `Label`, `Separator`, `Shortcut` (right-aligned kbd hint text), `SubTrigger` (with `ChevronRight`).
- **Dependencies**: `@radix-ui/react-dropdown-menu`, `lucide-react`.

### Select (`select.tsx`)
- **Composition**: Root/Group/Value/Trigger (`ChevronDown` indicator)/Content (Portal + Viewport + Scroll Up/Down buttons)/Label/Item (`Check` indicator)/Separator.
- **Behavior**: `position="popper"` alignment translates content by `1px` depending on `data-side`; viewport width matches trigger width via CSS var `--radix-select-trigger-width`.
- **Dependencies**: `@radix-ui/react-select`, `lucide-react`.

### Skeleton (`skeleton.tsx`)
- Single `div` with `animate-pulse rounded-md bg-muted`; shape/size fully controlled by caller's `className`.

### Progress (`progress.tsx`)
- Radix `Progress.Root`/`Indicator`; `value` prop (0–100) drives `translateX(-{100-value}%)` on the indicator.
- **Dependencies**: `@radix-ui/react-progress`.

### Switch (`switch.tsx`)
- Radix `Switch.Root`/`Thumb`; `checked`/`onCheckedChange` controlled boolean toggle.
- **Dependencies**: `@radix-ui/react-switch`.

### Avatar (`avatar.tsx`)
- Composition: `Avatar` (Root, circular clip), `AvatarImage` (loads `src`, falls back gracefully), `AvatarFallback` (shown while loading/on error — typically initials or an icon).
- **Dependencies**: `@radix-ui/react-avatar`.

### Tooltip (`tooltip.tsx`)
- Composition: `TooltipProvider` (wrap app root once), `Tooltip` (Root, per-instance), `TooltipTrigger`, `TooltipContent` (`sideOffset` default 4).
- **Dependencies**: `@radix-ui/react-tooltip`.

### Alert (`alert.tsx`)
- Composition: `Alert` (`role="alert"`, `variant: default|destructive`), `AlertTitle`, `AlertDescription`. Expects an SVG icon as first child, absolutely positioned top-left with content-padding compensation.

### Carousel (`carousel.tsx`)
- **Props**: `opts` (Embla options), `plugins`, `orientation?: horizontal|vertical`, `setApi?` (exposes Embla API instance to parent).
- **Composition**: `Carousel` (Provider + root div, captures arrow-key navigation), `CarouselContent` (embla viewport ref + flex track), `CarouselItem` (slide, `basis-full`), `CarouselPrevious`/`CarouselNext` (circular icon Buttons, auto-disabled at track ends via `canScrollPrev/Next`).
- **Dependencies**: `embla-carousel-react`, `lucide-react` (`ArrowLeft, ArrowRight`), local `Button`.

### Input OTP (`input-otp.tsx`)
- **Composition**: `InputOTP` (wraps `OTPInput` from `input-otp` pkg), `InputOTPGroup`, `InputOTPSlot` (reads active slot state/char/fake-caret from `OTPInputContext`), `InputOTPSeparator` (renders a `Dot` icon between groups).
- **Dependencies**: `input-otp`, `lucide-react` (`Dot`).

## 7.4 Cross-cutting Notes for Flutter Rebuild
- Nearly all primitives are **stateless styling wrappers around Radix behavior** (focus management, portals, keyboard nav, animations) — in Flutter, equivalent behavior must be reconstructed with base widgets (`Focus`, `OverlayEntry`, `showDialog`, `showModalBottomSheet`) plus custom animation controllers to match the fade/zoom/slide timing documented in DESIGN_SYSTEM.md §6.13.
- Variant/size systems (CVA) should become Dart `enum`s mapped to `BoxDecoration`/`TextStyle`/`EdgeInsets` lookup tables mirroring the token tables above.
- Custom gesture components (`PullToRefresh`, `SwipeableCard`) have no Radix dependency and are the most directly portable — their pixel thresholds/resistance factors should be copied exactly (threshold 80, maxPull 120, resistance 0.4 / swipe maxOffset 120, resistance 0.6).
