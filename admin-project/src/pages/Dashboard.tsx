import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Package, Users, ShoppingCart, Wallet, Clock, CheckCircle } from 'lucide-react';

interface DashboardStats {
  totalProducts: number;
  pendingProducts: number;
  totalUsers: number;
  totalOrders: number;
  pendingWithdrawals: number;
  pendingApplications: number;
}

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    pendingProducts: 0,
    totalUsers: 0,
    totalOrders: 0,
    pendingWithdrawals: 0,
    pendingApplications: 0,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const [products, pendingProducts, profiles, orders, withdrawals, applications] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setStats({
        totalProducts: products.count || 0,
        pendingProducts: pendingProducts.count || 0,
        totalUsers: profiles.count || 0,
        totalOrders: orders.count || 0,
        pendingWithdrawals: withdrawals.count || 0,
        pendingApplications: applications.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCard
            title="Total Products"
            value={stats.totalProducts}
            icon={Package}
            description="All products in the system"
          />
          <StatsCard
            title="Pending Products"
            value={stats.pendingProducts}
            icon={Clock}
            description="Awaiting approval"
            variant="warning"
          />
          <StatsCard
            title="Total Users"
            value={stats.totalUsers}
            icon={Users}
            description="Registered users"
          />
          <StatsCard
            title="Total Orders"
            value={stats.totalOrders}
            icon={ShoppingCart}
            description="All orders placed"
          />
          <StatsCard
            title="Pending Withdrawals"
            value={stats.pendingWithdrawals}
            icon={Wallet}
            description="Awaiting processing"
            variant="warning"
          />
          <StatsCard
            title="Pending Applications"
            value={stats.pendingApplications}
            icon={CheckCircle}
            description="Role applications"
            variant="warning"
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
