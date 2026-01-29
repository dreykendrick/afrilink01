import { ArrowLeft, Store, Users, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface RoleSelectionProps {
  onSelect: (role: 'vendor' | 'affiliate' | 'browse') => void;
  onBack?: () => void;
}

export const RoleSelection = ({ onSelect, onBack, onLogin }: RoleSelectionProps & { onLogin?: () => void }) => {
  const { t } = useTranslation();

  const roleCards = [
    {
      role: 'vendor' as const,
      title: t('roleSelection.vendor.title'),
      description: t('roleSelection.vendor.description'),
      icon: Store,
    },
    {
      role: 'affiliate' as const,
      title: t('roleSelection.affiliate.title'),
      description: t('roleSelection.affiliate.description'),
      icon: Users,
    },
    {
      role: 'browse' as const,
      title: t('roleSelection.browse.title'),
      description: t('roleSelection.browse.description'),
      icon: Compass,
    },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto space-y-10">
        {onBack && (
          <div className="animate-in fade-in duration-500">
            <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t('common.back')}
            </Button>
          </div>
        )}
        <div className="text-center space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="text-2xl sm:text-4xl font-bold text-foreground">{t('roleSelection.title')}</h2>
          <p className="text-sm sm:text-lg text-muted-foreground">
            {t('roleSelection.subtitle')}
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
        {/* Login option for existing accounts */}
        <div className="text-center pt-4 border-t border-border animate-in fade-in duration-700" style={{ animationDelay: '300ms' }}>
          <p className="text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <button
              type="button"
              onClick={onLogin}
              className="text-primary hover:underline font-semibold"
            >
              {t('auth.login')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
