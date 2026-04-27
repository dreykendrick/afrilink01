import { useState } from 'react';
import { X, Loader2, Banknote, Smartphone, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/currency';

const MIN_WITHDRAWAL_TZS = 20000;
const WITHDRAWAL_FEE_TZS = 2000;

interface ExternalWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onWithdrawSuccess: () => void;
}

const paymentMethods = [
  { id: 'MOBILE_MONEY', name: 'Mobile Money', icon: Smartphone, fields: ['phone'] },
  { id: 'BANK', name: 'Bank Transfer', icon: Banknote, fields: ['bank_name', 'account_number', 'account_name'] },
];

export const ExternalWithdrawModal = ({
  isOpen,
  onClose,
  balance,
  onWithdrawSuccess,
}: ExternalWithdrawModalProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [formFields, setFormFields] = useState<Record<string, string>>({});

  const selectedMethodData = paymentMethods.find((m) => m.id === selectedMethod);
  const amountNum = parseInt(amount || '0');
  const isValidAmount =
    amountNum >= MIN_WITHDRAWAL_TZS &&
    amountNum <= balance &&
    amountNum > WITHDRAWAL_FEE_TZS;
  const netAmount = Math.max(0, amountNum - WITHDRAWAL_FEE_TZS);

  const resetForm = () => {
    setSelectedMethod('');
    setAmount('');
    setFormFields({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod || !amount) {
      toast({ title: 'Missing fields', description: 'Select method and amount', variant: 'destructive' });
      return;
    }
    if (!isValidAmount) {
      toast({
        title: 'Invalid amount',
        description: `Min ${formatCurrency(MIN_WITHDRAWAL_TZS)}, max ${formatCurrency(balance)}`,
        variant: 'destructive',
      });
      return;
    }
    const required = selectedMethodData?.fields || [];
    const missing = required.filter((f) => !formFields[f]);
    if (missing.length) {
      toast({ title: 'Missing fields', description: `Fill: ${missing.join(', ')}`, variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({ title: 'Not authenticated', description: 'Please log in', variant: 'destructive' });
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/order-guardian/withdrawals`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountNum,
            destination_type: selectedMethod,
            destination_details: formFields,
          }),
        },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Failed to request withdrawal');

      toast({
        title: 'Withdrawal requested',
        description: `You will receive ${formatCurrency(netAmount)} after the ${formatCurrency(WITHDRAWAL_FEE_TZS)} fee. Awaiting approval.`,
      });
      resetForm();
      onWithdrawSuccess();
      onClose();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to request withdrawal',
        variant: 'destructive',
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
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          <div className="bg-gradient-primary rounded-xl p-4 text-white">
            <div className="text-sm opacity-90">Available Balance</div>
            <div className="text-2xl font-bold">{formatCurrency(balance)}</div>
          </div>

          {balance < MIN_WITHDRAWAL_TZS && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-600 dark:text-amber-400">
                Minimum withdrawal is {formatCurrency(MIN_WITHDRAWAL_TZS)}.
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="flex flex-col gap-2">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const active = selectedMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setSelectedMethod(method.id);
                      setFormFields({});
                    }}
                    className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                      {method.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (TZS)</Label>
            <Input
              id="amount"
              type="number"
              min={MIN_WITHDRAWAL_TZS}
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min: ${MIN_WITHDRAWAL_TZS.toLocaleString()}`}
              className="bg-secondary/50 text-lg"
            />
          </div>

          {selectedMethod === 'MOBILE_MONEY' && (
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Money Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formFields.phone || ''}
                onChange={(e) => setFormFields({ ...formFields, phone: e.target.value })}
                placeholder="+255 XXX XXX XXX"
                className="bg-secondary/50"
              />
            </div>
          )}

          {selectedMethod === 'BANK' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={formFields.bank_name || ''}
                  onChange={(e) => setFormFields({ ...formFields, bank_name: e.target.value })}
                  placeholder="e.g., CRDB Bank"
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  value={formFields.account_number || ''}
                  onChange={(e) => setFormFields({ ...formFields, account_number: e.target.value })}
                  placeholder="Enter account number"
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_name">Account Name</Label>
                <Input
                  id="account_name"
                  value={formFields.account_name || ''}
                  onChange={(e) => setFormFields({ ...formFields, account_name: e.target.value })}
                  placeholder="Name on account"
                  className="bg-secondary/50"
                />
              </div>
            </div>
          )}

          {amount && isValidAmount && (
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Withdrawal Amount</span>
                <span className="font-medium text-foreground">{formatCurrency(amountNum)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing Fee</span>
                <span className="font-medium text-foreground">- {formatCurrency(WITHDRAWAL_FEE_TZS)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-medium text-foreground">You'll receive</span>
                <span className="font-bold text-primary">{formatCurrency(netAmount)}</span>
              </div>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-primary hover:opacity-90"
              disabled={isLoading || !isValidAmount || !selectedMethod || balance < MIN_WITHDRAWAL_TZS}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                </>
              ) : (
                'Request Withdrawal'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
