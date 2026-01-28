import { useState } from 'react';
import { Wallet, Download } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { WithdrawModal } from './WithdrawModal';

interface WalletCardProps {
  balance: number;
  onWithdrawSuccess?: () => void;
}

export const WalletCard = ({ balance, onWithdrawSuccess }: WalletCardProps) => {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  return (
    <>
      <div className="bg-gradient-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-glow animate-in fade-in slide-in-from-bottom-5 duration-500 delay-300">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">Available Balance</div>
            <div className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-4">{formatCurrency(balance)}</div>
            <button 
              onClick={() => setIsWithdrawOpen(true)}
              className="px-4 sm:px-6 py-2 bg-white/20 backdrop-blur-sm rounded-lg font-semibold hover:bg-white/30 transition-all duration-300 flex items-center space-x-2 text-sm sm:text-base"
            >
              <Download className="w-4 h-4" />
              <span>Withdraw</span>
            </button>
          </div>
          <Wallet className="w-12 h-12 sm:w-16 sm:h-16 opacity-30" />
        </div>
      </div>

      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        balance={balance}
        onWithdrawSuccess={() => onWithdrawSuccess?.()}
      />
    </>
  );
};
