import { CheckCircle } from 'lucide-react';
import { useEffect } from 'react';

interface NotificationProps {
  message: string;
  onClose: () => void;
}

export const Notification = ({ message, onClose }: NotificationProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
      <div className="bg-card border border-border rounded-xl px-6 py-4 shadow-card backdrop-blur-sm flex items-center space-x-3">
        <CheckCircle className="w-5 h-5 text-afrilink-green" />
        <span className="text-foreground font-medium">{message}</span>
      </div>
    </div>
  );
};
