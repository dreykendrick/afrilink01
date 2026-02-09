import { useState } from 'react';
import { DollarSign, ShoppingCart, Package, Eye, Plus, MoreVertical, ArrowDownCircle, AlertCircle, CheckCircle, Clock, XCircle, Circle } from 'lucide-react';
import { User, Product, VendorStats } from '@/types';
import { formatCurrency } from '@/utils/currency';
import { StatsCard } from './StatsCard';
import { AddProductModal } from './AddProductModal';
import { WalletSection } from './WalletSection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface VendorDashboardProps {
  currentUser: User;
  products: Product[];
  stats: VendorStats;
  onVerify: () => void;
  onProductAdded?: () => void;
}

export const VendorDashboard = ({ currentUser, products, stats, onVerify, onProductAdded }: VendorDashboardProps) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [takedownProductId, setTakedownProductId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleProductAdded = () => {
    onProductAdded?.();
  };

  const handleTakedownRequest = async () => {
    if (!takedownProductId) return;

    const { error } = await supabase
      .from('products')
      .update({ status: 'pending_takedown' })
      .eq('id', takedownProductId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit takedown request',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Takedown Requested',
        description: 'Your takedown request has been submitted for admin approval.',
      });
      onProductAdded?.(); // Refresh the list
    }
    setTakedownProductId(null);
  };

  const handleAvailabilityToggle = async (productId: string, currentAvailability: boolean) => {
    const newAvailability = !currentAvailability;
    
    const { error } = await supabase
      .from('products')
      .update({ is_available: newAvailability } as any)
      .eq('id', productId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update availability',
        variant: 'destructive',
      });
    } else {
      toast({
        title: newAvailability ? 'Now Available' : 'Marked as Sold Out',
        description: newAvailability 
          ? 'Your product is now visible to buyers.' 
          : 'Your product is marked as sold out.',
      });
      onProductAdded?.();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[11px] font-medium px-2 py-0.5 gap-1">
            <Circle className="w-1.5 h-1.5 fill-current" />
            Live
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 text-[11px] font-medium px-2 py-0.5 gap-1">
            <Circle className="w-1.5 h-1.5 fill-current animate-pulse" />
            In Review
          </Badge>
        );
      case 'pending_takedown':
        return (
          <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0 text-[11px] font-medium px-2 py-0.5 gap-1">
            <ArrowDownCircle className="w-3 h-3" />
            Takedown Pending
          </Badge>
        );
      case 'taken_down':
        return (
          <Badge className="bg-muted text-muted-foreground border-0 text-[11px] font-medium px-2 py-0.5 gap-1">
            <XCircle className="w-3 h-3" />
            Taken Down
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0 text-[11px] font-medium px-2 py-0.5 gap-1">
            <XCircle className="w-3 h-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[11px] font-medium px-2 py-0.5">
            {status}
          </Badge>
        );
    }
  };

  const getAvailabilityBadge = (isAvailable: boolean) => {
    if (isAvailable) {
      return (
        <Badge className="bg-primary/10 text-primary border-0 text-[11px] font-medium px-2 py-0.5">
          In Stock
        </Badge>
      );
    }
    return (
      <Badge className="bg-muted text-muted-foreground border-0 text-[11px] font-medium px-2 py-0.5">
        Sold Out
      </Badge>
    );
  };

  return (
    <>
      <div className="mb-6 sm:mb-8 animate-in fade-in slide-in-from-top-3 duration-500">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome back, {currentUser.name}!</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Here's your vendor dashboard overview</p>
        {products.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">Start by adding a product to get approved and go live.</p>
        )}
      </div>


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <StatsCard icon={DollarSign} value={formatCurrency(stats.revenue)} label="Total Revenue" gradient="from-afrilink-green to-emerald-600" subtext="All-time" />
        <StatsCard icon={ShoppingCart} value={stats.sales} label="Total Sales" gradient="from-afrilink-blue to-cyan-600" subtext="All-time" />
        <StatsCard icon={Package} value={stats.products} label="Active Products" gradient="from-afrilink-purple to-afrilink-pink" />
        <StatsCard icon={Eye} value={stats.pending} label="Products Under Review" gradient="from-afrilink-amber to-afrilink-orange" subtext="Usually takes up to 24 hours" />
      </div>

      {/* Wallet Section */}
      <div className="mb-6 sm:mb-8">
        <WalletSection walletType="VENDOR" onBalanceChange={onProductAdded} />
      </div>

      <div className="bg-card rounded-xl sm:rounded-2xl border border-border overflow-hidden shadow-card mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Your Products</h2>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-gradient-primary text-white rounded-lg font-semibold flex items-center justify-center space-x-2 hover:shadow-glow transition-all duration-300"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          {products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No products yet. Add your first product!</p>
            </div>
          ) : (
            products.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 sm:p-4 bg-secondary/50 rounded-lg sm:rounded-xl hover:bg-secondary transition-all duration-200 animate-in fade-in slide-in-from-left-3 duration-500"
                style={{ animationDelay: `${300 + index * 50}ms` }}
              >
                <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                  <img src={product.image} alt={product.title} className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground text-sm sm:text-base truncate">{product.title}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{product.category}</span>
                      <span className="text-muted-foreground/40">•</span>
                      {getStatusBadge(product.status)}
                      {product.status === 'approved' && (
                        <>
                          <span className="text-muted-foreground/40">•</span>
                          {getAvailabilityBadge(product.isAvailable !== false)}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-foreground text-sm sm:text-base">{formatCurrency(product.price)}</div>
                    <div className="text-xs text-muted-foreground">{product.sales} sales</div>
                  </div>
                  {product.status === 'approved' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-2 hover:bg-secondary rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg">
                        <DropdownMenuItem 
                          onClick={() => handleAvailabilityToggle(product.id, product.isAvailable !== false)}
                          className="focus:bg-secondary"
                        >
                          <Switch
                            checked={product.isAvailable !== false}
                            className="scale-75 mr-2 pointer-events-none"
                          />
                          {product.isAvailable !== false ? 'Mark as Sold Out' : 'Mark as Available'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setTakedownProductId(product.id)}
                          className="text-orange-500 focus:text-orange-500"
                        >
                          <ArrowDownCircle className="w-4 h-4 mr-2" />
                          Request Takedown
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onProductAdded={handleProductAdded}
      />

      <AlertDialog open={!!takedownProductId} onOpenChange={() => setTakedownProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Request Product Takedown
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will submit a takedown request to the admin for approval. Your product will remain visible until the request is approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleTakedownRequest}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Submit Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};