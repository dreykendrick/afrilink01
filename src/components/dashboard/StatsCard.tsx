import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  gradient: string;
}

export const StatsCard = ({ icon: Icon, value, label, gradient }: StatsCardProps) => {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-card hover:scale-105 transition-transform duration-300 animate-in fade-in zoom-in-95 duration-500`}>
      <Icon className="w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-4" />
      <div className="text-xl sm:text-3xl font-bold mb-1">{value}</div>
      <div className="text-xs sm:text-sm opacity-90">{label}</div>
    </div>
  );
};