import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Loader2, Receipt } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { supabase } from '@/integrations/supabase/client';

interface LedgerEntry {
  id: string;
  entry_type: 'CREDIT' | 'DEBIT';
  amount: number;
  reason: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface LedgerHistoryProps {
  walletType: 'VENDOR' | 'AFFILIATE';
}

const reasonLabels: Record<string, string> = {
  SALE_SPLIT: 'Sale Earnings',
  PAYOUT_HOLD: 'Payout Pending',
  PAYOUT_RELEASE: 'Payout Completed',
  REFUND: 'Order Refund',
  ADJUSTMENT: 'Balance Adjustment',
};

export const LedgerHistory = ({ walletType }: LedgerHistoryProps) => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = async () => {
      setLoading(true);
      try {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
          console.warn('[LedgerHistory] No active session');
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments-api/ledger?type=${walletType}`,
          {
            headers: {
              'Authorization': `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          setEntries(result.entries || []);
        } else {
          console.error('[LedgerHistory] Failed to fetch:', response.status);
        }
      } catch (error) {
        console.error('Failed to fetch ledger:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLedger();
  }, [walletType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                entry.entry_type === 'CREDIT'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-amber-500/10 text-amber-500'
              }`}
            >
              {entry.entry_type === 'CREDIT' ? (
                <ArrowDownLeft className="w-5 h-5" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">
                {reasonLabels[entry.reason] || entry.reason}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
          <div
            className={`font-bold text-sm ${
              entry.entry_type === 'CREDIT' ? 'text-emerald-500' : 'text-amber-500'
            }`}
          >
            {entry.entry_type === 'CREDIT' ? '+' : '-'}
            {formatCurrency(entry.amount)}
          </div>
        </div>
      ))}
    </div>
  );
};
