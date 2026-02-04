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

const STORAGE_KEY = 'afrilink_app_url';
const LOVABLE_HOST_RE = /(\.lovableproject\.com$|\.lovable\.app$)/i;

let inFlight: Promise<string> | null = null;

const normalizeUrl = (url: string): string => url.replace(/\/+$/, '');

const readCachedUrl = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeCachedUrl = (url: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, url);
  } catch {
    // ignore
  }
};

/**
 * Sync getter. Prefer this when you must render immediately.
 */
export const getAppUrl = (): string => {
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl) return normalizeUrl(envUrl);

  const cached = readCachedUrl();
  if (cached) return normalizeUrl(cached);

  return normalizeUrl(window.location.origin);
};

/**
 * Async getter. Ensures we resolve the canonical URL even in preview/dev.
 */
export const getAppUrlAsync = async (): Promise<string> => {
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl) return normalizeUrl(envUrl);

  const cached = readCachedUrl();
  if (cached) return normalizeUrl(cached);

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('app-config');
        if (error) throw error;

        const appUrl = (data?.appUrl || data?.app_url || '') as string;
        if (appUrl) {
          const normalized = normalizeUrl(appUrl);
          writeCachedUrl(normalized);
          return normalized;
        }
      } catch {
        // ignore and fall back
      }

      return normalizeUrl(window.location.origin);
    })().finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
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
