import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/currency';

interface PaymentResult {
  success: boolean;
  payment_id?: string;
  status?: string;
  error?: string;
  split?: {
    platform_fee: number;
    affiliate_fee: number;
    vendor_payouts: Array<{ amount: number; vendorId: string }>;
  };
}

export const CheckoutConfirmPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [order, setOrder] = useState<{ id: string; total_amount: number; customer_name: string } | null>(null);

  const paymentId = searchParams.get('payment_id');

  useEffect(() => {
    const confirmPayment = async () => {
      if (!paymentId) {
        setResult({ success: false, error: 'Missing payment ID' });
        setLoading(false);
        return;
      }

      try {
        // Confirm payment via edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments-api/confirm-payment`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ payment_id: paymentId }),
          }
        );

        const data = await response.json();
        setResult(data);

        // If successful, fetch order details
        if (data.success) {
          const { data: paymentData } = await supabase
            .from('payments')
            .select('order_id')
            .eq('id', paymentId)
            .single();

          if (paymentData) {
            const { data: orderData } = await supabase
              .from('orders')
              .select('id, total_amount, customer_name')
              .eq('id', paymentData.order_id)
              .single();

            if (orderData) {
              setOrder(orderData);
            }
          }

          // Clear affiliate code from localStorage after successful purchase
          localStorage.removeItem('affiliateCode');
        }
      } catch (error) {
        console.error('Payment confirmation error:', error);
        setResult({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to confirm payment',
        });
      } finally {
        setLoading(false);
      }
    };

    confirmPayment();
  }, [paymentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Confirming your payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl border border-border p-6 shadow-card animate-in fade-in zoom-in-95 duration-300">
        {result?.success ? (
          <>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Payment Successful!</h1>
              <p className="text-muted-foreground">
                Thank you for your purchase, {order?.customer_name || 'valued customer'}!
              </p>
            </div>

            {order && (
              <div className="mt-6 p-4 bg-secondary/50 rounded-xl border border-border space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Receipt className="w-4 h-4" />
                  Order Details
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order ID</span>
                    <span className="font-mono text-foreground">{order.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Paid</span>
                    <span className="font-bold text-primary">{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>You will receive an SMS/WhatsApp with delivery updates.</p>
            </div>

            <button
              onClick={() => navigate('/')}
              className="w-full mt-6 py-3 bg-gradient-primary text-white rounded-xl font-bold hover:shadow-glow transition-all duration-300 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Continue Shopping
            </button>
          </>
        ) : (
          <>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Payment Failed</h1>
              <p className="text-muted-foreground">
                {result?.error || 'Something went wrong with your payment.'}
              </p>
            </div>

            <div className="mt-6 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
              <p className="text-sm text-center">
                Don't worry - your order has not been charged. Please try again or contact support.
              </p>
            </div>

            <button
              onClick={() => navigate('/')}
              className="w-full mt-6 py-3 bg-gradient-primary text-white rounded-xl font-bold hover:shadow-glow transition-all duration-300 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Shop
            </button>
          </>
        )}
      </div>
    </div>
  );
};
