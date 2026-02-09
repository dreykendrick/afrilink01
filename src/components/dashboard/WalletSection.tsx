import { useState, useEffect } from 'react';
import { Wallet, Download, History, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { supabase } from '@/integrations/supabase/client';
import { LedgerHistory } from './LedgerHistory';
import { NewWithdrawModal } from './NewWithdrawModal';

interface WalletSectionProps {
  walletType: 'VENDOR' | 'AFFILIATE';
  onBalanceChange?: () => void;
}

interface WalletData {
  available_balance: number;
  pending_balance: number;
  currency: string;
}

export const WalletSection = ({ walletType, onBalanceChange }: WalletSectionProps) => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  const fetchWallet = async () => {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments-api/wallet?type=${walletType}`,
        {
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setWallet(result.wallet);
      }
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [walletType]);

  const handleWithdrawSuccess = () => {
    fetchWallet();
    onBalanceChange?.();
  };

  const availableBalance = wallet?.available_balance || 0;
  const pendingBalance = wallet?.pending_balance || 0;
  const canWithdraw = availableBalance >= 20000; // MIN_WITHDRAWAL_TZS

  if (loading) {
    return (
      <div className="bg-gradient-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-glow animate-pulse">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Wallet Card */}
      <div className="bg-gradient-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-glow animate-in fade-in slide-in-from-bottom-5 duration-500">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">Available Balance</div>
            <div className="text-2xl sm:text-4xl font-bold mb-1">{formatCurrency(availableBalance)}</div>
            {pendingBalance > 0 && (
              <div className="text-xs sm:text-sm opacity-75 mb-3">
                + {formatCurrency(pendingBalance)} pending
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => canWithdraw && setIsWithdrawOpen(true)}
                disabled={!canWithdraw}
                className={`px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center space-x-2 text-sm ${
                  canWithdraw
                    ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 cursor-pointer'
                    : 'bg-white/10 opacity-60 cursor-not-allowed'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Withdraw</span>
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg font-semibold transition-all duration-300 flex items-center space-x-2 text-sm"
              >
                <History className="w-4 h-4" />
                <span>History</span>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            {!canWithdraw && availableBalance > 0 && (
              <p className="text-xs opacity-75 mt-2">
                Min. withdrawal: {formatCurrency(20000)}
              </p>
            )}
          </div>
          <Wallet className="w-12 h-12 sm:w-16 sm:h-16 opacity-30" />
        </div>
      </div>

      {/* Transaction History */}
      {showHistory && (
        <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-card animate-in fade-in slide-in-from-top-3 duration-300">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Transaction History
          </h3>
          <LedgerHistory walletType={walletType} />
        </div>
      )}

      {/* Withdraw Modal */}
      <NewWithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        balance={availableBalance}
        walletType={walletType}
        onWithdrawSuccess={handleWithdrawSuccess}
      />
    </div>
  );
};
