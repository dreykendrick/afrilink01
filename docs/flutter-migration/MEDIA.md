# MEDIA & ASSETS (Part 12)

## Brand
The app was rebranded **AfriLink -> Winger**. All user-visible strings say "Winger".
Exceptions intentionally left as "Afrilink":
- SMS `sender_id` in `supabase/functions/send-otp/index.ts` = `Afrilink` (Winger sender ID not yet approved by Briq).
- Infrastructure identifiers: Android package `com.kbsoftwares.afrilink`, deep-link scheme `afrilink://`, domains `afrilink01.vercel.app` / `shop.afrilink.info`, localStorage key `afrilink_active_role_<userId>`.

## Raster assets
| Path | Size (px) | Mode | Bytes | Purpose | Referenced by |
|---|---|---|---|---|---|
| `src/assets/winger-logo.png` | 985x939 | RGBA (transparent) | 998293 | Primary logo | `LandingPage.tsx`, `DashboardNav.tsx`, `LoginPage.tsx`, `SignupPage.tsx` (ES6 import, bundled+hashed by Vite) |
| `public/favicon.png` | 985x939 | RGBA | 998293 | Browser favicon | `index.html` |
| `public/apple-touch-icon.png` | 985x939 | RGBA | 998293 | iOS home-screen icon | `index.html` |
| `public/pwa-192x192.png` | 985x939 | RGBA | 998293 | PWA manifest icon 192 | `vite.config.ts` PWA manifest |
| `public/pwa-512x512.png` | 985x939 | RGBA | 998293 | PWA manifest icon 512 (also maskable) | manifest |
| `public/app-icon-192.png` | 985x939 | RGBA | 998293 | Legacy/alt icon | manifest history |
| `public/app-icon-512.png` | 985x939 | RGBA | 998293 | Legacy/alt icon | manifest history |
| `public/placeholder.svg` | vector | - | - | Product image fallback | product cards/modals |

All icon files are byte-identical copies of the logo (white borders removed, alpha background). **Migration note:** they are NOT resized to their nominal dimensions — Flutter should generate properly sized icons (`flutter_launcher_icons`) from the 985x939 master instead of copying it.

## Android native assets
`android/app/src/main/res/`:
- `mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi,anydpi-v26}` — launcher icons (`ic_launcher`, `ic_launcher_round`, adaptive `ic_launcher.xml` + `ic_launcher_foreground.xml` in `drawable-v24`, background colour in `values/ic_launcher_background.xml`).
- `drawable-{land,port}-{mdpi..xxxhdpi}` — Capacitor splash screens.
- `values/strings.xml` — `app_name` = `Afrilink`, `package_name`/`custom_url_scheme` = `com.kbsoftwares.afrilink`.
- `xml/file_paths.xml` — FileProvider paths for share/download.

## Deep-link association files
- `public/.well-known/assetlinks.json` — Android App Links.
- `public/.well-known/apple-app-site-association` — iOS Universal Links.

## Icons (vector, in-app)
No SVG icon files are shipped. All UI icons come from **`lucide-react` ^0.462.0** rendered inline as SVG (see `DESIGN_SYSTEM.md` for the used-icon list). Flutter equivalent: `lucide_icons` package or bundled SVGs via `flutter_svg`.

## Fonts
No custom font files are bundled and no web-font `<link>` is present. Typography falls back to the Tailwind default `font-sans` stack (system UI fonts). Flutter should either mirror the platform default or explicitly adopt Inter-like system fonts.

## Video / Lottie / animations
- No video assets.
- No Lottie/Rive files.
- All motion is CSS: Tailwind `tailwindcss-animate` utilities plus custom keyframes in `src/index.css` (accordion, fade-in, zoom-in, `animate-spin` on `Loader2`). Documented in `DESIGN_SYSTEM.md`.

## Images produced at runtime
- Product images: Supabase Storage bucket `product-images`, path `products/{userId}/{productId}/{uuid}.{ext}`.
- Vendor logos: bucket `vendor-logos`.
- Affiliate avatars: bucket `affiliate-avatars`.
- All buckets are public-read; uploads are RLS-restricted to `auth.uid()`.
- Constraints: max 5 MB per image; HEIC/HEIF rejected; previews use `URL.createObjectURL` with explicit revoke on cleanup (never base64 in state).
- Affiliate share images are re-rendered client-side through a `<canvas>` then shared via `navigator.share()` / downloaded as a blob.

## Other public files
- `public/robots.txt`
- `public/sw-push.js` — web-push service worker (notification click -> focus/open URL).
