/**
 * Canonical application URL utility
 * 
 * Production: Uses VITE_APP_URL (https://shop.afrilink.info)
 * Preview/Dev: Falls back to window.location.origin
 * 
 * Use this for ALL externally-shared URLs:
 * - Affiliate links
 * - Share/copy-to-clipboard links
 * - Email redirect URLs
 * - Order confirmation links
 */
export const getAppUrl = (): string => {
  return import.meta.env.VITE_APP_URL || window.location.origin;
};
