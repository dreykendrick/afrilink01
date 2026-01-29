import { Home, Store, User, HelpCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  activeTab: 'dashboard' | 'marketplace' | 'settings' | 'help' | 'profile';
  onNavigate: (tab: 'dashboard' | 'marketplace' | 'settings' | 'help-support' | 'verification-manage') => void;
  userRole: 'vendor' | 'affiliate';
}

export const MobileBottomNav = ({ activeTab, onNavigate, userRole }: MobileBottomNavProps) => {
  const navItems = [
    { id: 'dashboard' as const, icon: Home, label: 'Home', action: 'dashboard' as const },
    { id: 'marketplace' as const, icon: Store, label: 'Market', action: 'marketplace' as const },
    { id: 'settings' as const, icon: Settings, label: 'Settings', action: 'settings' as const },
    { id: 'help' as const, icon: HelpCircle, label: 'Help', action: 'help-support' as const },
    { id: 'profile' as const, icon: User, label: 'Verification', action: 'verification-manage' as const },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border sm:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.action)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full px-2 py-1 transition-all duration-200 touch-manipulation",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground active:text-primary"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all duration-200",
                isActive && "bg-primary/10"
              )}>
                <item.icon className={cn(
                  "w-5 h-5 transition-transform",
                  isActive && "scale-110"
                )} />
              </div>
              <span className={cn(
                "text-[10px] mt-0.5 font-medium transition-all",
                isActive ? "opacity-100" : "opacity-70"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
