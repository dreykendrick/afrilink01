import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { 
  ShoppingCart, 
  LogOut, 
  Settings, 
  ShieldCheck, 
  ChevronDown,
  Wallet,
  HelpCircle,
  Moon,
  Sun,
  Store,
  Users,
  ExternalLink,
  Copy,
  Check,
  Download,
  RefreshCw,
  Plus,
  History,
  Loader2
} from 'lucide-react';
import { User } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { NotificationDropdown } from './NotificationDropdown';
import { formatCurrency } from '@/utils/currency';
import { Switch } from '@/components/ui/switch';
import { NewWithdrawModal } from './NewWithdrawModal';
import { LedgerHistory } from './LedgerHistory';
import { supabase } from '@/integrations/supabase/client';

interface DashboardNavProps {
  currentUser: User;
  onLogout: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToVerification?: () => void;
  onNavigateToMarketplace?: () => void;
  onNavigateToHelp?: () => void;
  onWalletUpdate?: () => void;
  availableRoles?: ('vendor' | 'affiliate')[];
  onSwitchRole?: (role: 'vendor' | 'affiliate') => void;
  onAddRole?: (role: 'vendor' | 'affiliate') => void;
}

export const DashboardNav = ({ 
  currentUser, 
  onLogout,
  onNavigateToSettings,
  onNavigateToVerification,
  onNavigateToMarketplace,
  onNavigateToHelp,
  onWalletUpdate,
  availableRoles = [],
  onSwitchRole,
  onAddRole
}: DashboardNavProps) => {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [copied, setCopied] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletPending, setWalletPending] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const { theme, setTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  const walletType = currentUser.role === 'vendor' ? 'VENDOR' : 'AFFILIATE';

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
        setWalletBalance(result.wallet?.available_balance || 0);
        setWalletPending(result.wallet?.pending_balance || 0);
      }
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [walletType]);

  const canWithdraw = walletBalance >= 20000;

  const toggleTheme = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(currentUser.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'vendor':
        return 'bg-afrilink-purple/20 text-afrilink-purple border-afrilink-purple/30';
      case 'affiliate':
        return 'bg-afrilink-blue/20 text-afrilink-blue border-afrilink-blue/30';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'vendor':
        return <Store className="w-3 h-3" />;
      case 'affiliate':
        return <Users className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const ProfileDropdownContent = () => (
    <DropdownMenuContent 
      align="end" 
      className="w-72 p-0 bg-card border border-border shadow-xl rounded-xl overflow-hidden"
      sideOffset={8}
    >
      {/* Profile Header - Display only */}
      <div className="p-4 bg-gradient-to-br from-primary/10 via-transparent to-afrilink-purple/10 border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-primary/30">
            {currentUser.avatarUrl && (
              <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} className="object-cover" />
            )}
            <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-semibold">
              {getInitials(currentUser.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
          </div>
        </div>
      </div>

      {/* Wallet Balance with Withdraw + History */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-afrilink-green/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-afrilink-green" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available Balance</p>
              {walletLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <p className="font-bold text-foreground">{formatCurrency(walletBalance)}</p>
              )}
            </div>
          </div>
          {!walletLoading && canWithdraw ? (
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsWithdrawOpen(true); }}
              className="flex items-center gap-1 text-xs text-afrilink-green border border-afrilink-green/30 bg-afrilink-green/10 hover:bg-afrilink-green/20 transition-colors px-2 py-1 rounded-md font-medium"
            >
              <Download className="w-3 h-3" />
              Withdraw
            </button>
          ) : !walletLoading ? (
            <span className="text-xs text-muted-foreground">
              {walletBalance > 0 ? `Min: ${formatCurrency(20000)}` : 'No funds'}
            </span>
          ) : null}
        </div>
        {!walletLoading && walletPending > 0 && (
          <p className="text-xs text-muted-foreground ml-11">+ {formatCurrency(walletPending)} pending</p>
        )}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLedger(!showLedger); }}
          className="mt-2 ml-11 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <History className="w-3 h-3" />
          {showLedger ? 'Hide History' : 'Transaction History'}
        </button>
        {showLedger && (
          <div className="mt-2 max-h-48 overflow-y-auto">
            <LedgerHistory walletType={walletType} />
          </div>
        )}
      </div>

      {/* Theme Toggle */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              {isDarkMode ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </div>
            <span className="font-medium text-sm">Dark Mode</span>
          </div>
          <Switch 
            checked={isDarkMode} 
            onCheckedChange={toggleTheme}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>

      {/* Switch Role Section */}
      <div className="p-2 border-b border-border">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Switch Role</span>
          </div>
          <div className="space-y-1.5">
            {/* Current role */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
              {currentUser.role === 'vendor' ? (
                <Store className="w-4 h-4 text-primary" />
              ) : (
                <Users className="w-4 h-4 text-primary" />
              )}
              <span className="text-sm font-medium text-primary capitalize">{currentUser.role}</span>
              <span className="text-xs text-primary/70 ml-auto">Active</span>
            </div>
            
            {/* Other available role */}
            {availableRoles.length > 1 ? (
              availableRoles
                .filter(role => role !== currentUser.role)
                .map(role => (
                  <button
                    key={role}
                    onClick={() => onSwitchRole?.(role)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors text-left"
                  >
                    {role === 'vendor' ? (
                      <Store className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Users className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground capitalize">{role}</span>
                    <span className="text-xs text-muted-foreground ml-auto">Switch</span>
                  </button>
                ))
            ) : (
              // Option to add another role
              <button
                onClick={() => {
                  const newRole = currentUser.role === 'vendor' ? 'affiliate' : 'vendor';
                  onAddRole?.(newRole);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors text-left border border-dashed border-border"
              >
                <Plus className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Add {currentUser.role === 'vendor' ? 'Affiliate' : 'Vendor'} Role
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div className="p-2">
        <DropdownMenuItem 
          onClick={onLogout}
          className="cursor-pointer rounded-lg px-3 py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center mr-3">
            <LogOut className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm">Sign Out</span>
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  );

  return (
    <nav className="bg-sidebar border-b border-sidebar-border sticky top-0 z-40 backdrop-blur-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-sidebar-foreground">AfriLink</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center space-x-4">
            <NotificationDropdown />
            
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center space-x-3 px-3 py-2 bg-sidebar-accent/50 hover:bg-sidebar-accent rounded-xl transition-all duration-200 cursor-pointer group border border-transparent hover:border-border">
                <Avatar className="w-9 h-9 border-2 border-primary/20 ring-2 ring-transparent group-hover:ring-primary/10 transition-all">
                  {currentUser.avatarUrl && (
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} className="object-cover" />
                  )}
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-semibold">
                    {getInitials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <div className="text-sm font-semibold text-sidebar-foreground">{currentUser.name}</div>
                  <div className="text-xs text-sidebar-foreground/60 capitalize flex items-center gap-1">
                    {getRoleIcon(currentUser.role)}
                    {currentUser.role}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70 transition-colors" />
              </DropdownMenuTrigger>
              <ProfileDropdownContent />
            </DropdownMenu>
          </div>

          {/* Mobile Menu */}
          <div className="flex sm:hidden items-center space-x-3">
            <NotificationDropdown />
            <DropdownMenu>
              <DropdownMenuTrigger className="p-1.5 rounded-xl bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors">
                <Avatar className="w-8 h-8 border-2 border-primary/20">
                  {currentUser.avatarUrl && (
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} className="object-cover" />
                  )}
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-semibold">
                    {getInitials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <ProfileDropdownContent />
            </DropdownMenu>
          </div>
        </div>
      </div>

      <NewWithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        balance={walletBalance}
        walletType={walletType}
        onWithdrawSuccess={() => { fetchWallet(); onWalletUpdate?.(); }}
      />
    </nav>
  );
};
