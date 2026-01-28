import { useState } from 'react';
import { X, Loader2, Banknote, CreditCard, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/currency';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onWithdrawSuccess: () => void;
}

const paymentMethods = [
  { id: 'bank', name: 'Bank Transfer', icon: Banknote, placeholder: 'Account number' },
  { id: 'mobile', name: 'Mobile Money', icon: Smartphone, placeholder: 'Phone number' },
  { id: 'card', name: 'Debit Card', icon: CreditCard, placeholder: 'Card number' },
];

export const WithdrawModal = ({ isOpen, onClose, balance, onWithdrawSuccess }: WithdrawModalProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');

  const selectedMethodData = paymentMethods.find(m => m.id === selectedMethod);
  const amountInCents = Math.round(parseFloat(amount || '0') * 100);
  const isValidAmount = amountInCents > 0 && amountInCents <= balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMethod || !amount || !paymentDetails) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }

    if (!isValidAmount) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount within your balance',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Not authenticated',
          description: 'Please log in to withdraw',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase.from('withdrawals').insert({
        user_id: user.id,
        amount: amountInCents,
        payment_method: selectedMethod,
        payment_details: paymentDetails
      });

      if (error) throw error;

      toast({
        title: 'Withdrawal requested!',
        description: 'Your withdrawal is being processed'
      });

      setAmount('');
      setPaymentDetails('');
      setSelectedMethod('');
      onWithdrawSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to request withdrawal',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in duration-300">
        <div className="sticky top-0 bg-card border-b border-border p-4 sm:p-6 flex items-center justify-between z-10">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Withdraw Funds</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          {/* Balance Display */}
          <div className="bg-gradient-primary rounded-xl p-4 text-white">
            <div className="text-sm opacity-90">Available Balance</div>
            <div className="text-2xl font-bold">{formatCurrency(balance)}</div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedMethod(method.id)}
                    className={`p-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                      selectedMethod === method.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${selectedMethod === method.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-medium ${selectedMethod === method.id ? 'text-primary' : 'text-muted-foreground'}`}>
                      {method.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={balance / 100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-secondary/50 text-lg"
            />
            {amount && !isValidAmount && (
              <p className="text-xs text-destructive">
                {amountInCents > balance ? 'Amount exceeds your balance' : 'Please enter a valid amount'}
              </p>
            )}
          </div>

          {/* Payment Details */}
          {selectedMethod && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label htmlFor="paymentDetails">{selectedMethodData?.placeholder}</Label>
              <Input
                id="paymentDetails"
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                placeholder={`Enter your ${selectedMethodData?.placeholder.toLowerCase()}`}
                className="bg-secondary/50"
              />
            </div>
          )}

          {/* Summary */}
          {amount && isValidAmount && (
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2 animate-in fade-in duration-200">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Withdrawal Amount</span>
                <span className="font-medium text-foreground">{formatCurrency(amountInCents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing Fee</span>
                <span className="font-medium text-foreground">Free</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-medium text-foreground">You'll receive</span>
                <span className="font-bold text-primary">{formatCurrency(amountInCents)}</span>
              </div>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-primary hover:opacity-90"
              disabled={isLoading || !isValidAmount || !selectedMethod || !paymentDetails}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Withdraw'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
