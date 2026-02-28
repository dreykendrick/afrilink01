import { getAppUrl, getAppUrlAsync } from '@/utils/appUrl';

/**
 * Centralized reset-password URL builder.
 *
 * All reset-link generation MUST go through these helpers so the base URL
 * is always the canonical production domain (VITE_APP_URL) and never a
 * preview / Lovable / Vercel-preview domain.
 *
 * PHASE 2 (mobile): The deep-link variant uses the `afrilink://` custom
 * scheme so that native apps can intercept the URL via App Links /
 * Universal Links.
 */

const RESET_PATH = '/reset-password';
const DEEP_LINK_SCHEME = 'afrilink://';

/** Synchronous – uses cached / env value */
export const getResetRedirectUrl = (): string => {
  return `${getAppUrl()}${RESET_PATH}`;
};

/** Async – resolves canonical URL from backend if needed */
export const getResetRedirectUrlAsync = async (): Promise<string> => {
  const base = await getAppUrlAsync();
  return `${base}${RESET_PATH}`;
};

/**
 * Build the deep-link URL for the mobile app.
 * Token is passed through so the native app can complete the flow.
 */
export const getResetDeepLink = (token: string): string => {
  return `${DEEP_LINK_SCHEME}reset-password?token=${encodeURIComponent(token)}`;
};

// TODO (Phase 2 – Mobile Deep Linking):
// ─────────────────────────────────────
// 1. Host `/.well-known/assetlinks.json` on the production domain for
//    Android App Links. This file must declare the app's package name
//    (com.kbsoftwares.afrilink) and SHA-256 cert fingerprint.
//
// 2. Host `/.well-known/apple-app-site-association` for iOS Universal
//    Links. This file must declare the app ID and allowed paths.
//
// 3. Configure Associated Domains in the iOS Xcode project:
//    `applinks:afrilink01.vercel.app`
//
// 4. In the Android AndroidManifest.xml, add an intent filter for
//    `afrilink://reset-password` and an `autoVerify` intent filter for
//    `https://afrilink01.vercel.app/reset-password`.
