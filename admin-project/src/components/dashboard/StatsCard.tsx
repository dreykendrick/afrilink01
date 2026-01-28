import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description: string;
  variant?: 'default' | 'warning';
}

export const StatsCard = ({ title, value, icon: Icon, description, variant = 'default' }: StatsCardProps) => {
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${variant === 'warning' ? 'text-amber-500' : 'text-foreground'}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          variant === 'warning' ? 'bg-amber-500/10' : 'bg-primary/10'
        }`}>
          <Icon className={`w-6 h-6 ${variant === 'warning' ? 'text-amber-500' : 'text-primary'}`} />
        </div>
      </div>
    </div>
  );
};
