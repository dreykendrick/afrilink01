import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/currency';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  commission_amount: number;
}

interface ProductInfo {
  id: string;
  title: string;
  vendor_id: string;
}

export const OrderConfirmationPage = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Record<string, ProductInfo>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      if (!token) {
        setOrder(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('confirmation_token', token)
        .maybeSingle();

      if (!orderData) {
        setOrder(null);
        setLoading(false);
        return;
      }

      setOrder(orderData);

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id, product_id, quantity, price, commission_amount')
        .eq('order_id', orderId);

      setItems(orderItems || []);

      if (orderItems && orderItems.length > 0) {
        const productIds = orderItems.map((item) => item.product_id);
        const { data: productData } = await supabase
          .from('products')
          .select('id, title, vendor_id')
          .in('id', productIds);

        const mapped = (productData || []).reduce<Record<string, ProductInfo>>((acc, product) => {
          acc[product.id] = product;
          return acc;
        }, {});
        setProducts(mapped);
      }

      setLoading(false);
    };

    fetchOrder();
  }, [orderId, token]);

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const handleConfirm = async () => {
    if (!order || actionLoading) return;
    if (order.status === 'delivered_confirmed') {
      setMessage('This order has already been confirmed.');
      return;
    }

    setActionLoading(true);
    try {
      const totalCommission = items.reduce(
        (sum, item) => sum + item.commission_amount * item.quantity,
        0,
      );

      if (order.affiliate_link_id && totalCommission > 0) {
        const { data: link } = await supabase
          .from('affiliate_links')
          .select('commission_earned, affiliate_id')
          .eq('id', order.affiliate_link_id)
          .single();

        if (link) {
          await supabase
            .from('affiliate_links')
            .update({ commission_earned: (link.commission_earned || 0) + totalCommission })
            .eq('id', order.affiliate_link_id);

          const { data: affiliateProfile } = await supabase
            .from('profiles')
            .select('wallet_balance')
            .eq('id', link.affiliate_id)
            .single();

          await supabase
            .from('profiles')
            .update({ wallet_balance: (affiliateProfile?.wallet_balance || 0) + totalCommission })
            .eq('id', link.affiliate_id);

          await supabase.from('transactions').insert({
            user_id: link.affiliate_id,
            type: 'commission',
            amount: totalCommission,
            description: `Commission released for order #${order.id.slice(0, 8)}`,
            reference_id: order.id,
          });
        }
      }

      const vendorTotals = items.reduce<Record<string, number>>((acc, item) => {
        const product = products[item.product_id];
        if (!product) return acc;
        const vendorAmount = item.price * item.quantity - item.commission_amount * item.quantity;
        acc[product.vendor_id] = (acc[product.vendor_id] || 0) + vendorAmount;
        return acc;
      }, {});

      for (const [vendorId, amount] of Object.entries(vendorTotals)) {
        const { data: vendorProfile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', vendorId)
          .single();

        await supabase
          .from('profiles')
          .update({ wallet_balance: (vendorProfile?.wallet_balance || 0) + amount })
          .eq('id', vendorId);

        await supabase.from('transactions').insert({
          user_id: vendorId,
          type: 'sale',
          amount,
          description: `Payout released for order #${order.id.slice(0, 8)}`,
          reference_id: order.id,
        });
      }

      await supabase
        .from('orders')
        .update({ status: 'delivered_confirmed' })
        .eq('id', order.id);

      setOrder((prev: any) => ({ ...prev, status: 'delivered_confirmed' }));
      setMessage('Thanks for confirming! Your delivery has been marked complete.');
    } catch (error: any) {
      setMessage(error.message || 'Unable to confirm delivery at this time.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportProblem = async () => {
    if (!order || actionLoading) return;
    setActionLoading(true);
    try {
      await supabase
        .from('orders')
        .update({ status: 'delivery_issue' })
        .eq('id', order.id);
      setOrder((prev: any) => ({ ...prev, status: 'delivery_issue' }));
      setMessage('Thanks for letting us know. Our support team will contact you shortly.');
    } catch (error: any) {
      setMessage(error.message || 'Unable to submit the issue right now.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
          <p className="text-muted-foreground">Invalid or expired confirmation link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Confirm delivery</h1>
          <p className="text-sm text-muted-foreground">Order ID: {order.id}</p>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {products[item.product_id]?.title || 'Product'} x{item.quantity}
              </span>
              <span className="text-foreground">{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total items</span>
            <span>{totalItems}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-foreground">
            <span>Total paid</span>
            <span>{formatCurrency(order.total_amount)}</span>
          </div>
        </div>

        {message && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 p-3 text-sm">
            <CheckCircle2 className="w-4 h-4 text-afrilink-green" />
            <span>{message}</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={handleConfirm}
            disabled={actionLoading}
            className="w-full py-3 bg-gradient-primary text-white rounded-xl font-bold hover:shadow-glow transition-all duration-300 disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Yes, I received my order'}
          </button>
          <button
            onClick={handleReportProblem}
            disabled={actionLoading}
            className="w-full py-3 border border-border rounded-xl font-semibold text-foreground hover:bg-secondary transition-all duration-300 disabled:opacity-50"
          >
            Report a problem
          </button>
        </div>
      </div>
    </div>
  );
};
