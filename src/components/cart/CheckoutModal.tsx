import { useEffect, useState, useRef } from 'react';
import { CheckCircle2, CreditCard, Loader2, Truck, X } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/currency';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateTZPhone } from '@/utils/phone';
import { getUserFriendlyError } from '@/utils/errorMessages';
import { getAppUrlAsync } from '@/utils/appUrl';

const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
  purchaseMode?: 'affiliate' | 'marketplace';
}

interface ReceiptDetails {
  orderId: string;
  totalAmount: number;
  deliveryFee: number;
  confirmationLink: string;
}

export const CheckoutModal = ({ isOpen, onClose, onSuccess, purchaseMode = 'affiliate' }: CheckoutModalProps) => {
  const { items, totalPrice, affiliateCode, clearCart } = useCart();
  const { user, userRole } = useAuth();
  const effectiveAffiliateCode = purchaseMode === 'marketplace' ? null : affiliateCode;
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDetails | null>(null);
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    if (!form.name || !form.phone || !form.deliveryAddress || !form.deliveryCity) {
      toast.error('Please fill in all required fields');
      setLoading(false);
      return;
    }

    const phoneValidation = validateTZPhone(form.phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error);
      toast.error(phoneValidation.error || 'Invalid phone number');
      setLoading(false);
      return;
    }
    setPhoneError(null);

    if (!checkoutSessionRef.current) {
      checkoutSessionRef.current = crypto.randomUUID();
    }
    const checkoutSessionId = checkoutSessionRef.current;
    const normalizedPhone = phoneValidation.normalized || form.phone;

    try {
      // Both modes now route through the Checkout API
      if (purchaseMode === 'marketplace') {
        await handleApiCheckout(checkoutSessionId, normalizedPhone, 'marketplace');
      } else {
        await handleApiCheckout(checkoutSessionId, normalizedPhone, 'affiliate');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(getUserFriendlyError(error));
      checkoutSessionRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  /** Delegates order creation + payment to the Checkout API for both modes */
  const handleApiCheckout = async (checkoutSessionId: string, normalizedPhone: string, mode: 'affiliate' | 'marketplace') => {
    const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

    const orderPayload = {
      products: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      buyer_name: form.name,
      buyer_email: form.email || `${normalizedPhone}@buyer.afrilink`,
      buyer_phone: normalizedPhone,
      buyer_city: form.deliveryCity,
      buyer_address: form.deliveryAddress,
      buyer_country: form.deliveryCountry || undefined,
      delivery_type: 'delivery' as const,
      checkout_session_id: checkoutSessionId,
      purchase_mode: mode,
      buyer_user_id: user?.id || undefined,
      buyer_role: userRole || 'customer',
      affiliate_code: mode === 'affiliate' ? (effectiveAffiliateCode || undefined) : undefined,
    };

    if (import.meta.env.DEV) {
      console.log('[Checkout] Order payload:', JSON.stringify(orderPayload, null, 2));
    }

    const orderRes = await fetch(`${apiBase}/checkout-api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderRes.json();

    if (import.meta.env.DEV) {
      console.log('[Checkout] Order response:', JSON.stringify(orderData, null, 2));
      console.log('[Checkout] Vendor locations:', orderData.vendor_locations);
    }

    if (!orderData.success && !orderData.order_id) {
      throw new Error(orderData.error || 'Failed to create order');
    }

    const orderId = orderData.order_id;
    const totalAmount = orderData.total_amount ?? totalPrice;
    const deliveryFee = orderData.delivery_fee ?? 0;

    // Create payment via payments-api
    const paymentRes = await fetch(`${apiBase}/payments-api/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        amount: totalAmount,
        currency: 'TZS',
      }),
    });

    const paymentData = await paymentRes.json();

    if (paymentData.success && paymentData.redirect_url) {
      clearCart();
      checkoutSessionRef.current = null;
      window.location.href = paymentData.redirect_url;
      return;
    }

    // Fallback: show receipt if no redirect (STUB/DEMO mode)
    if (IS_DEMO_MODE || !paymentData.redirect_url) {
      const appUrl = await getAppUrlAsync();
      const confirmationLink = `${appUrl}/confirm/${orderId}`;
      setReceipt({
        orderId,
        totalAmount,
        deliveryFee,
        confirmationLink,
      });
      clearCart();
      checkoutSessionRef.current = null;
      return;
    }

    throw new Error(paymentData.error || 'Failed to create payment');
  };

  if (receipt) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-card rounded-2xl max-w-lg w-full p-6 border border-border shadow-card animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-afrilink-green" />
              <h2 className="text-xl font-bold text-foreground">Order placed</h2>
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
            <div className="p-4 bg-secondary/50 rounded-xl border border-border">
              {receipt.deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Delivery fee</span>
                  <span>{formatCurrency(receipt.deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-foreground mt-2">
                <span>Total</span>
                <span>{formatCurrency(receipt.totalAmount)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Delivery fee is calculated by the vendor/checkout system based on your location.
            </p>
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
          <div className="border-t border-border mt-3 pt-3">
            <div className="flex justify-between">
              <span className="font-semibold text-foreground">Subtotal</span>
              <span className="font-bold text-primary text-lg">{formatCurrency(totalPrice)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Delivery fee will be calculated at checkout</p>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-primary text-white rounded-xl font-bold hover:shadow-glow transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              `Place Order — ${formatCurrency(totalPrice)}`
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
