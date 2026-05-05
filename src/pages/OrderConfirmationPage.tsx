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
      const { data: orderRows } = await supabase.rpc('get_order_by_token' as any, {
        p_order_id: orderId,
        p_token: token,
      });
      const orderData = Array.isArray(orderRows) ? orderRows[0] : orderRows;

      if (!orderData) {
        setOrder(null);
        setLoading(false);
        return;
      }

      setOrder(orderData);

      const { data: itemRows } = await supabase.rpc('get_order_items_by_token' as any, {
        p_order_id: orderId,
        p_token: token,
      });
      const rows = (itemRows || []) as any[];
      setItems(rows.map((r) => ({
        id: r.id,
        product_id: r.product_id,
        quantity: r.quantity,
        price: r.price,
        commission_amount: r.commission_amount,
      })));
      const mapped: Record<string, ProductInfo> = {};
      for (const r of rows) {
        mapped[r.product_id] = { id: r.product_id, title: r.product_title, vendor_id: r.vendor_id };
      }
      setProducts(mapped);

      setLoading(false);
    };

    fetchOrder();
  }, [orderId, token]);

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const handleConfirm = async () => {
    if (!order || actionLoading || !token) return;
    if (order.status === 'delivered_confirmed') {
      setMessage('This order has already been confirmed.');
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('confirm_delivery_with_token' as any, {
        p_order_id: order.id,
        p_token: token,
      });
      if (error) throw error;

      setOrder((prev: any) => ({ ...prev, status: 'delivered_confirmed' }));
      setMessage('Thanks for confirming! Your delivery has been marked complete.');
    } catch (error: any) {
      setMessage('Unable to confirm delivery at this time.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportProblem = async () => {
    if (!order || actionLoading || !token) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('report_delivery_issue_with_token' as any, {
        p_order_id: order.id,
        p_token: token,
      });
      if (error) throw error;
      setOrder((prev: any) => ({ ...prev, status: 'delivery_issue' }));
      setMessage('Thanks for letting us know. Our support team will contact you shortly.');
    } catch (error: any) {
      setMessage('Unable to submit the issue right now.');
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
