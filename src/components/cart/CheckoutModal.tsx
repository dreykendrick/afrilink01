import { useEffect, useMemo, useState, useRef } from 'react';
import { CheckCircle2, CreditCard, Loader2, Truck, X } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/currency';
import { calculateDelivery } from '@/utils/delivery';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateTZPhone } from '@/utils/phone';
import { getUserFriendlyError } from '@/utils/errorMessages';

const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
}

interface VendorProfile {
  user_id: string;
  city?: string | null;
  country?: string | null;
}

interface ReceiptDetails {
  orderId: string;
  totalAmount: number;
  deliveryFee: number;
  confirmationLink: string;
  deliveryEstimate: string;
}

export const CheckoutModal = ({ isOpen, onClose, onSuccess }: CheckoutModalProps) => {
  const { items, totalPrice, affiliateCode, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDetails | null>(null);
  const [vendorProfiles, setVendorProfiles] = useState<Record<string, VendorProfile>>({});
  const [vendorProfilesError, setVendorProfilesError] = useState<string | null>(null);
  const [vendorProfilesLoading, setVendorProfilesLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const checkoutSessionRef = useRef<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryCountry: '',
  });

  useEffect(() => {
    if (!isOpen) {
      setReceipt(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchVendorProfiles = async () => {
      if (!isOpen || items.length === 0) return;
      setVendorProfilesError(null);
      setVendorProfilesLoading(true);
      try {
        const vendorIds = Array.from(new Set(items.map((item) => item.vendorId)));
        const { data, error } = await (supabase
          .from('vendor_profiles' as any)
          .select('user_id, city, country')
          .in('user_id', vendorIds) as unknown as Promise<{ data: any[]; error: any }>);

        if (error) throw error;

        if (data) {
          const mapped = (data as any[]).reduce<Record<string, VendorProfile>>((acc, profile: any) => {
            acc[profile.user_id] = profile;
            return acc;
          }, {});
          setVendorProfiles(mapped);
        }
      } catch (error: any) {
        console.error('Failed to load vendor profiles:', error);
        setVendorProfilesError('Unable to load delivery zones. Please retry.');
      } finally {
        setVendorProfilesLoading(false);
      }
    };

    fetchVendorProfiles();
  }, [isOpen, items]);

  const deliveryBreakdown = useMemo(() => {
    if (!form.deliveryCity) return [];

    const vendors = Object.values(vendorProfiles);
    if (vendors.length === 0) return [];

    return vendors.map((vendor) => {
      const vendorItems = items.filter((item) => item.vendorId === vendor.user_id);
      const freeDelivery = vendorItems.some((item) => item.freeDelivery);
      return {
        vendorId: vendor.user_id,
        city: vendor.city,
        result: calculateDelivery({
          vendorCity: vendor.city,
          vendorCountry: vendor.country,
          buyerCity: form.deliveryCity,
          buyerCountry: form.deliveryCountry,
          freeDelivery,
        }),
      };
    });
  }, [form.deliveryCity, form.deliveryCountry, items, vendorProfiles]);

  const deliveryFeeTotal = deliveryBreakdown.reduce((sum, vendor) => sum + vendor.result.fee, 0);
  const deliverySupported = deliveryBreakdown.every((vendor) => vendor.result.isSupported);
  const deliveryEstimate = deliveryBreakdown[0]?.result.estimate ?? '2–5 business days';
  const grandTotal = totalPrice + deliveryFeeTotal;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Disable submit instantly (before await)
    if (loading) return;
    setLoading(true);
    
    if (!form.name || !form.phone || !form.deliveryAddress || !form.deliveryCity) {
      toast.error('Please fill in all required fields');
      setLoading(false);
      return;
    }

    // Validate Tanzania phone
    const phoneValidation = validateTZPhone(form.phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error);
      toast.error(phoneValidation.error || 'Invalid phone number');
      setLoading(false);
      return;
    }
    setPhoneError(null);

    if (!deliverySupported) {
      toast.error('We do not support international delivery at this time.');
      setLoading(false);
      return;
    }

    // Generate idempotency key for this checkout session
    if (!checkoutSessionRef.current) {
      checkoutSessionRef.current = crypto.randomUUID();
    }
    const checkoutSessionId = checkoutSessionRef.current;

    try {
      // Check for duplicate order using checkout_session_id (Bug Fix B)
      // Note: checkout_session_id column must be added via migration
      const existingOrderQuery = supabase
        .from('orders')
        .select('id') as any;
      const { data: existingOrder } = await existingOrderQuery
        .eq('checkout_session_id', checkoutSessionId)
        .maybeSingle();

      if (existingOrder) {
        toast.error('This order has already been placed.');
        checkoutSessionRef.current = null;
        setLoading(false);
        return;
      }

      let affiliateLinkId = null;
      let affiliateId = null;
      if (affiliateCode) {
        const { data: linkData } = await supabase
          .from('affiliate_links')
          .select('id, affiliate_id, conversions')
          .eq('code', affiliateCode)
          .maybeSingle();

        if (linkData) {
          affiliateLinkId = linkData.id;
          affiliateId = linkData.affiliate_id;
          // Only increment conversions in DEMO_MODE (Bug Fix E)
          if (IS_DEMO_MODE) {
            await supabase
              .from('affiliate_links')
              .update({ conversions: (linkData.conversions || 0) + 1 })
              .eq('id', linkData.id);
          }
        }
      }

      const confirmationToken = crypto.randomUUID();
      const deliveryTypeLabel = deliveryBreakdown[0]?.result.label ?? 'Intercity delivery (distance-based)';

      // Use pending_payment by default, 'paid' only in DEMO_MODE (Bug Fix A)
      const orderStatus = IS_DEMO_MODE ? 'paid' : 'pending_payment';

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: form.name,
          customer_email: form.email || `${form.phone}@buyer.afrilink`,
          total_amount: grandTotal,
          status: orderStatus,
          affiliate_link_id: affiliateLinkId,
          customer_phone: phoneValidation.normalized || form.phone,
          delivery_address: form.deliveryAddress,
          delivery_city: form.deliveryCity,
          delivery_country: form.deliveryCountry || null,
          delivery_fee: deliveryFeeTotal,
          delivery_type: deliveryTypeLabel,
          confirmation_token: confirmationToken,
          checkout_session_id: checkoutSessionId,
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        commission_amount: Math.round((item.price * item.commission) / 100),
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      if (affiliateId && affiliateLinkId) {
        const totalCommission = orderItems.reduce((sum, item) => sum + item.commission_amount * item.quantity, 0);
        await supabase.from('transactions').insert({
          user_id: affiliateId,
          type: 'commission_pending',
          amount: totalCommission,
          description: `Pending commission for order #${order.id.slice(0, 8)}`,
          reference_id: order.id,
        });
      }

      for (const item of items) {
        const vendorAmount = item.price * item.quantity - Math.round((item.price * item.commission * item.quantity) / 100);
        await supabase.from('transactions').insert({
          user_id: item.vendorId,
          type: 'sale_pending',
          amount: vendorAmount,
          description: `Pending sale for ${item.title} x${item.quantity}`,
          reference_id: order.id,
        });
      }

      const confirmationLink = `${window.location.origin}/confirm/${order.id}?token=${confirmationToken}`;
      setReceipt({
        orderId: order.id,
        totalAmount: grandTotal,
        deliveryFee: deliveryFeeTotal,
        confirmationLink,
        deliveryEstimate,
      });
      clearCart();
      checkoutSessionRef.current = null; // Reset for next checkout
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(getUserFriendlyError(error));
      checkoutSessionRef.current = null; // Reset on error to allow retry
    } finally {
      setLoading(false);
    }
  };

  if (receipt) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-card rounded-2xl max-w-lg w-full p-6 border border-border shadow-card animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-afrilink-green" />
              <h2 className="text-xl font-bold text-foreground">{IS_DEMO_MODE ? 'Payment received' : 'Order placed (payment pending)'}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-secondary/50 rounded-xl border border-border">
              <p className="text-sm text-muted-foreground">Order ID</p>
              <p className="font-semibold text-foreground">{receipt.orderId}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Truck className="w-4 h-4" />
              <span>Delivery estimate: {receipt.deliveryEstimate}</span>
            </div>
            <div className="p-4 bg-secondary/50 rounded-xl border border-border">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Delivery fee</span>
                <span>{formatCurrency(receipt.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-foreground mt-2">
                <span>{IS_DEMO_MODE ? 'Total paid' : 'Total due'}</span>
                <span>{formatCurrency(receipt.totalAmount)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Buyer confirmation link</p>
              <div className="p-3 bg-muted rounded-lg text-xs break-all text-foreground">
                {receipt.confirmationLink}
              </div>
              <p className="text-xs text-muted-foreground">
                We will send this link to the buyer via SMS/WhatsApp for delivery confirmation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSuccess?.(receipt.orderId);
                setReceipt(null);
              }}
              className="w-full py-3 bg-gradient-primary text-white rounded-xl font-bold hover:shadow-glow transition-all duration-300"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-card rounded-2xl max-w-lg w-full p-6 border border-border shadow-card animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Checkout</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-secondary/50 rounded-xl border border-border">
          <h3 className="font-semibold text-foreground mb-3">Order Summary</h3>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.title} x{item.quantity}</span>
                <span className="text-foreground">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery</span>
              <span className="text-foreground">{formatCurrency(deliveryFeeTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-foreground">Total</span>
              <span className="font-bold text-primary text-lg">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Full Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              placeholder="Enter your name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Phone Number *</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => {
                setForm((f) => ({ ...f, phone: e.target.value }));
                setPhoneError(null);
              }}
              className={`w-full px-4 py-3 bg-secondary border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground ${phoneError ? 'border-destructive' : 'border-border'}`}
              placeholder="+255XXXXXXXXX or 0XXXXXXXXX"
              required
            />
            {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email (optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Delivery Location *</label>
            <input
              type="text"
              value={form.deliveryAddress}
              onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              placeholder="Street address or landmark"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">City *</label>
              <input
                type="text"
                value={form.deliveryCity}
                onChange={(e) => setForm((f) => ({ ...f, deliveryCity: e.target.value }))}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                placeholder="City"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Country</label>
              <input
                type="text"
                value={form.deliveryCountry}
                onChange={(e) => setForm((f) => ({ ...f, deliveryCountry: e.target.value }))}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                placeholder="Country"
              />
            </div>
          </div>

          {vendorProfilesError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive space-y-2">
              <p>{vendorProfilesError}</p>
              <button
                type="button"
                className="text-sm font-semibold text-destructive underline underline-offset-4"
                onClick={() => {
                  if (!isOpen || items.length === 0) return;
                  setVendorProfilesError(null);
                  setVendorProfilesLoading(true);
                  (supabase
                    .from('vendor_profiles' as any)
                    .select('user_id, city, country')
                    .in('user_id', Array.from(new Set(items.map((item) => item.vendorId)))) as unknown as Promise<{ data: any[]; error: any }>)
                    .then(({ data, error }) => {
                      if (error) throw error;
                      const mapped = (data || []).reduce<Record<string, VendorProfile>>((acc, profile: any) => {
                        acc[profile.user_id] = profile;
                        return acc;
                      }, {});
                      setVendorProfiles(mapped);
                      setVendorProfilesError(null);
                    })
                    .catch((error) => {
                      console.error('Failed to reload vendor profiles:', error);
                      setVendorProfilesError('Unable to load delivery zones. Please retry.');
                    })
                    .finally(() => setVendorProfilesLoading(false));
                }}
              >
                Retry loading zones
              </button>
            </div>
          )}

          {vendorProfilesLoading && (
            <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading delivery zones...
            </div>
          )}

          {deliveryBreakdown.length > 0 && (
            <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-2 text-sm">
              {deliveryBreakdown.map((vendor) => (
                <div key={vendor.vendorId} className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ships from {vendor.city || 'Vendor hub'}</span>
                  <span className={vendor.result.isSupported ? 'text-foreground' : 'text-destructive'}>
                    {vendor.result.label}
                  </span>
                </div>
              ))}
              {!deliverySupported && (
                <p className="text-xs text-destructive">International delivery is not supported for this order.</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !deliverySupported}
            className="w-full py-3 bg-gradient-primary text-white rounded-xl font-bold hover:shadow-glow transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay ${formatCurrency(grandTotal)}`
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
