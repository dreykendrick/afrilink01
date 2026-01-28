import { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertCircle, Camera, Phone, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface VerificationStatusCardProps {
  onVerify: () => void;
}

interface VerificationStatus {
  email_verified: boolean;
  phone_verified: boolean;
  photo_verified: boolean;
  verification_status: string;
}

export const VerificationStatusCard = ({ onVerify }: VerificationStatusCardProps) => {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  // Auto-hide fully verified card after 2 minutes
  useEffect(() => {
    const isFullyVerified = status?.email_verified && status?.phone_verified && status?.photo_verified;
    if (isFullyVerified) {
      const timer = setTimeout(() => setHidden(true), 2 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const fetchVerificationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('email_verified, phone_verified, photo_verified, verification_status')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setStatus(data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary via-card to-secondary p-6 animate-pulse">
        <div className="h-20 bg-muted/30 rounded-lg" />
      </div>
    );
  }

  const isFullyVerified = status?.email_verified && status?.phone_verified && status?.photo_verified;
  const completedSteps = [status?.email_verified, status?.phone_verified, status?.photo_verified].filter(Boolean).length;
  const progress = (completedSteps / 3) * 100;

  const verificationSteps = [
    { label: 'Email', verified: status?.email_verified, icon: Mail },
    { label: 'Phone', verified: status?.phone_verified, icon: Phone },
    { label: 'Photo ID', verified: status?.photo_verified, icon: Camera },
  ];

  // Hide completely if fully verified and timer expired
  if (isFullyVerified && hidden) {
    return null;
  }

  if (isFullyVerified) {
    return (
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-1 animate-in fade-in zoom-in-95 duration-500">
        {/* Animated glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-[shimmer_3s_infinite]" 
          style={{ animation: 'shimmer 3s infinite' }} />
        
        <div className="relative bg-gradient-to-br from-emerald-500/90 via-green-500/90 to-teal-600/90 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 text-yellow-300 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                Fully Verified
              </h3>
              <p className="text-white/80 text-sm sm:text-base">
                Your account is verified and ready to go!
              </p>
            </div>
          </div>

          {/* Verification badges */}
          <div className="flex gap-2 sm:gap-3 mt-4">
            {verificationSteps.map((step) => (
              <div
                key={step.label}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white/20 backdrop-blur-sm rounded-full"
              >
                <step.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                <span className="text-xs sm:text-sm font-medium text-white">{step.label}</span>
                <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl animate-in fade-in zoom-in-95 duration-500">
      {/* Gradient border effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl sm:rounded-3xl" />
      
      {/* Animated shimmer */}
      <div 
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
        style={{ 
          animation: 'shimmer 2s infinite',
          backgroundSize: '200% 100%'
        }} 
      />
      
      <div className="relative m-[2px] bg-gradient-to-br from-card via-background to-card rounded-[calc(1rem-2px)] sm:rounded-[calc(1.5rem-2px)] p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <AlertCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow-lg">
                {completedSteps}/3
              </div>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                Verification Required
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Complete all steps to unlock full access
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4 sm:mb-6">
          <div className="flex justify-between text-xs sm:text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold text-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 sm:h-3 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-full transition-all duration-700 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_infinite]" />
            </div>
          </div>
        </div>

        {/* Verification steps */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          {verificationSteps.map((step, index) => (
            <div
              key={step.label}
              className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 hover:scale-105 ${
                step.verified
                  ? 'bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/50'
                  : 'bg-gradient-to-br from-secondary/50 to-muted/30 border-border hover:border-amber-500/50'
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {step.verified && (
                <div className="absolute -top-1.5 -right-1.5">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                  </div>
                </div>
              )}
              <div className="flex flex-col items-center text-center gap-1.5 sm:gap-2">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center ${
                  step.verified 
                    ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30' 
                    : 'bg-gradient-to-br from-muted to-secondary'
                }`}>
                  <step.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${
                    step.verified ? 'text-white' : 'text-muted-foreground'
                  }`} />
                </div>
                <span className={`text-xs sm:text-sm font-medium ${
                  step.verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Button 
          onClick={onVerify} 
          className="w-full h-11 sm:h-12 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-300 hover:scale-[1.02] group"
          size="lg"
        >
          <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2 group-hover:animate-pulse" />
          <span className="text-sm sm:text-base">Complete Verification</span>
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 ml-2 opacity-70" />
        </Button>

        <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-3">
          Verification unlocks payments, withdrawals & full platform features
        </p>
      </div>
    </div>
  );
};