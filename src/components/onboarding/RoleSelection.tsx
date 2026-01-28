import { Store, Users, Compass } from 'lucide-react';

interface RoleSelectionProps {
  onSelect: (role: 'vendor' | 'affiliate' | 'browse') => void;
  onBack?: () => void;
}

const roleCards = [
  {
    role: 'vendor' as const,
    title: 'Join as Vendor',
    description: 'List products, manage sales, and grow your brand across Africa.',
    icon: Store,
  },
  {
    role: 'affiliate' as const,
    title: 'Join as Affiliate',
    description: 'Promote products and earn commissions with every conversion.',
    icon: Users,
  },
  {
    role: 'browse' as const,
    title: 'Browse Marketplace',
    description: 'Explore products, commissions, and trends without signing in.',
    icon: Compass,
  },
];

export const RoleSelection = ({ onSelect }: RoleSelectionProps) => {
  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="text-2xl sm:text-4xl font-bold text-foreground">Choose your AfriLink path</h2>
          <p className="text-sm sm:text-lg text-muted-foreground">
            Every journey is equal. Pick what matches your goals today.
          </p>
        </div>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {roleCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <button
                key={card.role}
                type="button"
                onClick={() => onSelect(card.role)}
                className="text-left group rounded-2xl border border-border bg-card p-6 sm:p-8 hover:border-primary transition-all duration-300 hover:shadow-card animate-in fade-in zoom-in-95"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">{card.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground">{card.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
