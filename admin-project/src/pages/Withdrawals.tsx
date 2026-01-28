import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, X } from 'lucide-react';

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  payment_details: string;
  status: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

const Withdrawals = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchWithdrawals();
    }
  }, [user, filter]);

  const fetchWithdrawals = async () => {
    let query = supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
    
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching withdrawals:', error);
    } else {
      setWithdrawals(data || []);
      
      // Fetch profiles for all user_ids
      const userIds = [...new Set(data?.map(w => w.user_id) || [])];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        const profilesMap: Record<string, Profile> = {};
        profilesData?.forEach(p => {
          profilesMap[p.id] = p;
        });
        setProfiles(profilesMap);
      }
    }
  };

  const handleWithdrawal = async (withdrawal: Withdrawal, approved: boolean) => {
    const status = approved ? 'approved' : 'rejected';

    const { error } = await supabase
      .from('withdrawals')
      .update({ status })
      .eq('id', withdrawal.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update withdrawal',
        variant: 'destructive',
      });
      return;
    }

    // If rejected, refund the wallet balance
    if (!approved) {
      const { error: refundError } = await supabase.rpc('refund_withdrawal', {
        p_user_id: withdrawal.user_id,
        p_amount: withdrawal.amount,
      });

      if (refundError) {
        console.error('Refund error:', refundError);
      }
    }

    toast({
      title: 'Success',
      description: `Withdrawal ${status}`,
    });
    fetchWithdrawals();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Withdrawals</h1>
            <p className="text-muted-foreground">Process withdrawal requests</p>
          </div>

          <div className="flex gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium text-muted-foreground">User</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Payment Method</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {profiles[withdrawal.user_id]?.full_name || 'Unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {profiles[withdrawal.user_id]?.email || ''}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 text-foreground font-medium">
                      {formatCurrency(withdrawal.amount)}
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-foreground capitalize">{withdrawal.payment_method}</p>
                        <p className="text-sm text-muted-foreground">{withdrawal.payment_details}</p>
                      </div>
                    </td>
                    <td className="p-4">{getStatusBadge(withdrawal.status)}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(withdrawal.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      {withdrawal.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => handleWithdrawal(withdrawal, true)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleWithdrawal(withdrawal, false)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No withdrawals found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Withdrawals;
