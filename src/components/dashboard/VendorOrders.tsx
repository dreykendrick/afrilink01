import { useEffect, useState } from 'react';
import { Loader2, Package, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/currency';
import { Badge } from '@/components/ui/badge';

interface ExternalOrder {
  id?: string;
  order_id?: string;
  customer_name?: string;
  customer?: string;
  amount?: number;
  total?: number;
  total_amount?: number;
  status?: string;
  created_at?: string;
  date?: string;
  [key: string]: unknown;
}

const getStatusBadge = (status?: string) => {
  const s = (status || 'pending').toLowerCase();
  if (s.includes('paid') || s.includes('complete') || s.includes('delivered')) {
    return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">{status}</Badge>;
  }
  if (s.includes('cancel') || s.includes('reject') || s.includes('fail')) {
    return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0">{status}</Badge>;
  }
  if (s.includes('process') || s.includes('ship')) {
    return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">{status}</Badge>;
  }
  return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">{status || 'Pending'}</Badge>;
};

export const VendorOrders = () => {
  const [orders, setOrders] = useState<ExternalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setError('Not authenticated');
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/order-guardian/orders`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const result = await res.json();
      if (!res.ok) {
        setError(result?.error || 'Failed to load orders');
        setOrders([]);
        return;
      }
      const list: ExternalOrder[] = Array.isArray(result)
        ? result
        : Array.isArray(result?.orders)
        ? result.orders
        : Array.isArray(result?.data)
        ? result.data
        : [];
      setOrders(list);
      if (result?.error) setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="bg-card rounded-xl sm:rounded-2xl border border-border overflow-hidden shadow-card mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-4 sm:p-6 border-b border-border flex justify-between items-center gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">Recent Orders</h2>
        <button
          onClick={() => fetchOrders(true)}
          disabled={refreshing || loading}
          className="p-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
          aria-label="Refresh orders"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error && orders.length === 0 ? (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-600 dark:text-amber-400">{error}</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No orders yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o, i) => {
              const id = (o.order_id || o.id || `order-${i}`).toString();
              const customer = o.customer_name || o.customer || 'Customer';
              const amount = Number(o.total_amount ?? o.total ?? o.amount ?? 0);
              const date = o.created_at || o.date;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between p-3 sm:p-4 bg-secondary/50 rounded-lg sm:rounded-xl"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground text-sm sm:text-base truncate">
                      {customer}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">
                        {id.slice(0, 10)}
                      </span>
                      {date && (
                        <>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(date).toLocaleDateString()}
                          </span>
                        </>
                      )}
                      <span className="text-muted-foreground/40">•</span>
                      {getStatusBadge(o.status)}
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <div className="font-bold text-foreground text-sm sm:text-base">
                      {formatCurrency(amount)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
