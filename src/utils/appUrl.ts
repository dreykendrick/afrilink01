import { supabase } from '@/integrations/supabase/client';

/**
 * Canonical application URL utility
 *
 * IMPORTANT: In this project, the canonical production domain is configured via
 * environment configuration (VITE_APP_URL). In the browser, build-time env vars
 * may not always be available, so we also support fetching the value from a
 * backend function and caching it locally.
 *
 * Use this for ALL externally-shared URLs:
 * - Affiliate links
 * - Share/copy-to-clipboard links
 * - Email redirect URLs
 * - Order confirmation links
 */

const APP_URL = 'https://wingerapp.dev';

export const getAppUrl = (): string => {
  return APP_URL;
};

export const getAppUrlAsync = async (): Promise<string> => {
  return APP_URL;
};

/**
 * Optional: if someone opens an old lovable* domain link, redirect to canonical.
 * Skips Lovable editor preview sessions (identified by __lovable_token).
 */
export const maybeRedirectToCanonicalDomain = async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    // In Lovable editor preview, never redirect, but do prime the cache so
    // copy-to-clipboard actions remain synchronous/fast.
    if (params.has('__lovable_token')) {
      await getAppUrlAsync();
      return;
    }

    if (!LOVABLE_HOST_RE.test(window.location.hostname)) return;

    const canonical = await getAppUrlAsync();
    const canonicalHost = new URL(canonical).hostname;
    if (canonicalHost === window.location.hostname) return;

    const nextUrl = `${normalizeUrl(canonical)}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(nextUrl);
  } catch {
    // ignore
  }
};
