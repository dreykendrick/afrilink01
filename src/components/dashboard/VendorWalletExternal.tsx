import { useEffect, useState } from 'react';
import { Wallet, Download, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/currency';
import { ExternalWithdrawModal } from './ExternalWithdrawModal';

const MIN_WITHDRAWAL_TZS = 20000;

interface ExternalWallet {
  balance?: number;
  available_balance?: number;
  pending_balance?: number;
  currency?: string;
}

export const VendorWalletExternal = () => {
  const [wallet, setWallet] = useState<ExternalWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = async (isRefresh = false) => {
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/order-guardian/wallet`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const result = await res.json();
      if (!res.ok) {
        setError(result?.error || 'Failed to load wallet');
        return;
      }
      const w: ExternalWallet = result?.wallet ?? result?.data ?? result ?? {};
      setWallet(w);
      if (result?.error) setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load wallet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const balance = Number(wallet?.available_balance ?? wallet?.balance ?? 0);
  const pending = Number(wallet?.pending_balance ?? 0);
  const canWithdraw = balance >= MIN_WITHDRAWAL_TZS;

  if (loading) {
    return (
      <div className="bg-gradient-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-glow animate-pulse mb-6">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-6">
      <div className="bg-gradient-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-glow animate-in fade-in slide-in-from-bottom-5 duration-500">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <span className="text-xs sm:text-sm opacity-90">Available Balance</span>
              <button
                onClick={() => fetchWallet(true)}
                disabled={refreshing}
                className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
                aria-label="Refresh wallet"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="text-2xl sm:text-4xl font-bold mb-1">{formatCurrency(balance)}</div>
            {pending > 0 && (
              <div className="text-xs sm:text-sm opacity-75 mb-3">
                + {formatCurrency(pending)} pending
              </div>
            )}
            <button
              onClick={() => canWithdraw && setIsWithdrawOpen(true)}
              disabled={!canWithdraw}
              className={`mt-3 px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center space-x-2 text-sm ${
                canWithdraw
                  ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 cursor-pointer'
                  : 'bg-white/10 opacity-60 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Withdraw</span>
            </button>
            {!canWithdraw && balance > 0 && (
              <p className="text-xs opacity-75 mt-2">
                Min. withdrawal: {formatCurrency(MIN_WITHDRAWAL_TZS)}
              </p>
            )}
          </div>
          <Wallet className="w-12 h-12 sm:w-16 sm:h-16 opacity-30 flex-shrink-0 ml-2" />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-600 dark:text-amber-400">{error}</div>
        </div>
      )}

      <ExternalWithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        balance={balance}
        onWithdrawSuccess={() => fetchWallet(true)}
      />
    </div>
  );
};
