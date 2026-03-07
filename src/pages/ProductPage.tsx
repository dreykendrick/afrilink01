import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, Truck, Link2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/currency';
import { CheckoutModal } from '@/components/cart/CheckoutModal';
import { toast } from 'sonner';

interface VendorProfile {
  city?: string | null;
  verification_status?: string | null;
}

// Check if user has affiliate attribution for checkout
const hasAffiliateAttribution = (): boolean => {
  const affiliateCode = localStorage.getItem('affiliateCode');
  return Boolean(affiliateCode);
};

export const ProductPage = () => {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const { addToCart, setAffiliateCode, affiliateCode } = useCart();
  const [product, setProduct] = useState<any | null>(null);
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [hasAffiliateRef, setHasAffiliateRef] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setAffiliateCode(ref);
      setHasAffiliateRef(true);

      // Track click via checkout-api (uses service role, no RLS issue)
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/checkout-api/track-click`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: ref }),
        }
      ).catch(() => {});
    } else {
      if (hasAffiliateAttribution()) {
        setHasAffiliateRef(true);
      }
    }
  }, [searchParams, setAffiliateCode]);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      
      if (!productId) {
        setProduct(null);
        setLoading(false);
        return;
      }

      // CRITICAL FIX 3: Single query by ID instead of fetching all products
      const { data, error } = await supabase
        .from('products')
        .select('id, title, description, price, commission, category, image_url, image_urls, vendor_id, status, sales')
        .eq('id', productId)
        .eq('status', 'approved')
        .eq('is_available', true)
        .maybeSingle();

      if (error) {
        console.error('Product fetch error:', error);
      }

      setProduct(data || null);

      if (data?.vendor_id) {
        const { data: vendor } = await (supabase
          .from('vendor_profiles' as any)
          .select('city, verification_status')
          .eq('user_id', data.vendor_id)
          .maybeSingle() as unknown as Promise<{ data: any; error: any }>);
        setVendorProfile(vendor || null);
      }

      setLoading(false);
    };

    fetchProduct();
  }, [productId]);

  const imageUrls = useMemo(() => {
    if (!product) return [];
    if (product.image_urls && product.image_urls.length > 0) return product.image_urls;
    return product.image_url ? [product.image_url] : [];
  }, [product]);
  const mainImage = imageUrls[0] || 'https://images.unsplash.com/photo-1503602642458-232111445657?w=1200&q=80';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Product not found.</div>
      </div>
    );
  }

  const handleBuyNow = () => {
    if (!hasAffiliateRef && !hasAffiliateAttribution()) {
      toast.error('Checkout is available only via affiliate link');
      return;
    }
    
    addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image_url || mainImage,
      commission: product.commission,
      vendorId: product.vendor_id,
      
    });
    setCheckoutOpen(true);
  };

  const canCheckout = hasAffiliateRef || hasAffiliateAttribution();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-border">
              <img
                src={mainImage}
                alt={product.title}
                className="w-full h-80 object-cover"
              />
            </div>
            {imageUrls.length > 1 && (
              <div className="grid grid-cols-3 gap-3">
                {imageUrls.slice(1, 4).map((url: string) => (
                  <div key={url} className="rounded-xl overflow-hidden border border-border">
                    <img src={url} alt="Product" className="w-full h-24 object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-primary font-semibold">{product.category}</p>
              <h1 className="text-3xl font-bold text-foreground mt-2">{product.title}</h1>
              <p className="text-muted-foreground mt-3">{product.description}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold text-primary">{formatCurrency(product.price)}</span>
              <span className="text-sm text-afrilink-green font-medium">Earn {product.commission}% commission</span>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-afrilink-green" />
                <span>Secured by AfriLink</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-afrilink-amber" />
                <span>Delivery handled by vendor — fee calculated at checkout</span>
              </div>
              <div>
                <span className="text-foreground font-medium">Sold by:</span>{' '}
                {vendorProfile?.verification_status === 'verified' ? 'Verified Vendor' : 'Vendor'}
              </div>
              <div>
                <span className="text-foreground font-medium">Ships from:</span>{' '}
                {vendorProfile?.city || 'AfriLink hub'}
              </div>
              <div>
                <span className="text-foreground font-medium">Payment methods:</span> Card, Mobile Money
              </div>
            </div>
            {canCheckout ? (
              <button
                onClick={handleBuyNow}
                className="w-full py-3 bg-gradient-primary text-white rounded-xl font-bold hover:shadow-glow transition-all duration-300"
              >
                Buy Now
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-600 dark:text-amber-400">
                    Checkout is available only via affiliate link. Ask a friend for their referral link!
                  </div>
                </div>
                <button
                  disabled
                  className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-bold cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Link2 className="w-4 h-4" />
                  Buy via Affiliate Link
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={() => toast.success('Order placed successfully!')}
      />
    </div>
  );
};
