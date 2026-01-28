import { useState } from 'react';
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
  Download
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
import { WithdrawModal } from './WithdrawModal';

interface DashboardNavProps {
  currentUser: User;
  onLogout: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToVerification?: () => void;
  onNavigateToMarketplace?: () => void;
  onNavigateToHelp?: () => void;
  onWalletUpdate?: () => void;
}

export const DashboardNav = ({ 
  currentUser, 
  onLogout,
  onNavigateToSettings,
  onNavigateToVerification,
  onNavigateToMarketplace,
  onNavigateToHelp,
  onWalletUpdate
}: DashboardNavProps) => {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { theme, setTheme } = useTheme();
  const isDarkMode = theme === 'dark';

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
      {/* Profile Header */}
      <div className="p-4 bg-gradient-to-br from-primary/10 via-transparent to-afrilink-purple/10">
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12 border-2 border-primary/30 shadow-lg">
            {currentUser.avatarUrl && (
              <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} className="object-cover" />
            )}
            <AvatarFallback className="bg-gradient-primary text-primary-foreground text-base font-semibold">
              {getInitials(currentUser.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{currentUser.name}</p>
            <div className="flex items-center gap-1 group cursor-pointer" onClick={copyUserId}>
              <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
              {copied ? (
                <Check className="w-3 h-3 text-afrilink-green flex-shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={`text-xs capitalize flex items-center gap-1 ${getRoleBadgeStyle(currentUser.role)}`}>
                {getRoleIcon(currentUser.role)}
                {currentUser.role}
              </Badge>
              {currentUser.verified ? (
                <Badge className="bg-afrilink-green/20 text-afrilink-green border border-afrilink-green/30 text-xs flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 bg-amber-500/10">
                  Pending
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Section */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-afrilink-green/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-afrilink-green" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wallet Balance</p>
              <p className="font-bold text-foreground">{formatCurrency(currentUser.wallet)}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsWithdrawOpen(true)}
            className="flex items-center gap-1 text-xs text-afrilink-green border border-afrilink-green/30 bg-afrilink-green/10 hover:bg-afrilink-green/20 transition-colors px-2 py-1 rounded-md font-medium"
          >
            <Download className="w-3 h-3" />
            Withdraw
          </button>
        </div>
      </div>

      {/* Menu Items */}
      <DropdownMenuGroup className="p-2">
        <DropdownMenuItem 
          onClick={onNavigateToVerification}
          className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-secondary/80"
        >
          <div className="w-8 h-8 rounded-lg bg-afrilink-blue/10 flex items-center justify-center mr-3">
            <ShieldCheck className="w-4 h-4 text-afrilink-blue" />
          </div>
          <div className="flex-1">
            <span className="font-medium text-sm">Verification Status</span>
            <p className="text-xs text-muted-foreground">
              {currentUser.verified ? 'Account verified' : 'Complete verification'}
            </p>
          </div>
          {!currentUser.verified && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={onNavigateToSettings}
          className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-secondary/80"
        >
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mr-3">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <span className="font-medium text-sm">Settings</span>
            <p className="text-xs text-muted-foreground">Manage your account</p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={onNavigateToMarketplace}
          className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-secondary/80"
        >
          <div className="w-8 h-8 rounded-lg bg-afrilink-purple/10 flex items-center justify-center mr-3">
            <Store className="w-4 h-4 text-afrilink-purple" />
          </div>
          <div className="flex-1">
            <span className="font-medium text-sm">Marketplace</span>
            <p className="text-xs text-muted-foreground">Browse products</p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator className="my-0" />

      {/* Theme Toggle */}
      <div className="p-2">
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

      <DropdownMenuSeparator className="my-0" />

      {/* Help & Support */}
      <DropdownMenuGroup className="p-2">
        <DropdownMenuItem 
          onClick={onNavigateToHelp}
          className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-secondary/80"
        >
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mr-3">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="font-medium text-sm">Help & Support</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator className="my-0" />

      {/* Logout */}
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

      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        balance={currentUser.wallet}
        onWithdrawSuccess={() => onWalletUpdate?.()}
      />
    </nav>
  );
};
