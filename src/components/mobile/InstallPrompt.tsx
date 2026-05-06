import { useState, useEffect } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';
import { cn } from '@/lib/utils';

interface InstallPromptProps {
  className?: string;
}

export const InstallPrompt = ({ className }: InstallPromptProps) => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem('afrilink_install_dismissed');
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('afrilink_install_dismissed', Date.now().toString());
  };

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
    } else {
      await promptInstall();
    }
  };

  // Don't show if already installed, dismissed, or not installable (except iOS)
  if (isInstalled || dismissed || (!isInstallable && !isIOS)) {
    return null;
  }

  if (showIOSGuide) {
    return (
      <div className={cn(
        "fixed inset-0 z-[100] bg-background/95 backdrop-blur-lg flex flex-col items-center justify-center p-6",
        className
      )}>
        <button
          onClick={() => setShowIOSGuide(false)}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Download className="w-10 h-10 text-primary-foreground" />
          </div>
          
          <h2 className="text-2xl font-bold mb-4">Install AfriLink</h2>
          <p className="text-muted-foreground mb-8">
            Add AfriLink to your home screen for the best experience
          </p>

          <div className="space-y-4 text-left">
            <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Share className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">1. Tap the Share button</p>
                <p className="text-sm text-muted-foreground">At the bottom of Safari</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">2. Add to Home Screen</p>
                <p className="text-sm text-muted-foreground">Scroll down and tap this option</p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setShowIOSGuide(false)}
            className="w-full mt-8"
            size="lg"
          >
            Got it!
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed bottom-20 left-4 right-4 sm:bottom-4 z-50 animate-in slide-in-from-bottom-4 duration-300",
      className
    )}>
      <div className="bg-card border border-border rounded-2xl shadow-xl p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-primary-foreground" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install AfriLink</p>
          <p className="text-xs text-muted-foreground truncate">
            Add to home screen for quick access
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleInstall}
            className="h-8"
          >
            Install
          </Button>
        </div>
      </div>
    </div>
  );
};
