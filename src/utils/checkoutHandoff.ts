/**
 * Marketplace Checkout Handoff
 *
 * Redirects buyers from the main app marketplace to the external checkout
 * system at shop.afrilink.info. The checkout system uses the route structure:
 *   /p/:productId?source=marketplace
 *
 * For multi-item carts the external checkout is single-product, so we
 * process one item at a time (first item in cart). Remaining items stay
 * in the cart for the buyer to check out next.
 */

import { CartItem } from '@/hooks/useCart';

const CHECKOUT_BASE_URL = 'https://shop.afrilink.info';

export interface CheckoutHandoffParams {
  items: CartItem[];
  affiliateCode?: string | null;
  purchaseMode: 'affiliate' | 'marketplace';
}

/**
 * Build the external checkout URL for a single product.
 */
export const buildCheckoutUrl = (
  productId: string,
  options: {
    source?: string;
    affiliateCode?: string | null;
    quantity?: number;
    vendorId?: string;
  } = {}
): string => {
  const url = new URL(`/p/${productId}`, CHECKOUT_BASE_URL);

  if (options.source) {
    url.searchParams.set('source', options.source);
  }

  // Only attach ref (affiliate code) if it's a true referral
  if (options.affiliateCode) {
    url.searchParams.set('ref', options.affiliateCode);
  }

  if (options.quantity && options.quantity > 1) {
    url.searchParams.set('qty', String(options.quantity));
  }

  if (options.vendorId) {
    url.searchParams.set('vendor', options.vendorId);
  }

  return url.toString();
};

/**
 * Perform the checkout handoff redirect for marketplace purchases.
 * Returns the product ID that was handed off (so the caller can
 * remove it from the cart) or null if no items.
 */
export const performMarketplaceCheckoutHandoff = (
  params: CheckoutHandoffParams
): { handedOffItemId: string; redirectUrl: string } | null => {
  const { items, affiliateCode, purchaseMode } = params;

  if (items.length === 0) {
    if (import.meta.env.DEV) {
      console.log('[CheckoutHandoff] No items to check out');
    }
    return null;
  }

  // Take the first item for the handoff
  const item = items[0];

  const redirectUrl = buildCheckoutUrl(item.id, {
    source: purchaseMode === 'marketplace' ? 'MARKETPLACE' : undefined,
    affiliateCode: purchaseMode === 'affiliate' ? affiliateCode : null,
    quantity: item.quantity,
    vendorId: item.vendorId || undefined,
  });

  if (import.meta.env.DEV) {
    console.log('[CheckoutHandoff] Redirecting to external checkout:', {
      productId: item.id,
      productTitle: item.title,
      purchaseMode,
      affiliateCode: purchaseMode === 'affiliate' ? affiliateCode : null,
      redirectUrl,
      remainingItems: items.length - 1,
    });
  }

  return { handedOffItemId: item.id, redirectUrl };
};
