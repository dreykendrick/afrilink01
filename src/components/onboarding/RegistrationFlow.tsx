import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAppUrlAsync } from '@/utils/appUrl';

interface RegistrationFlowProps {
  role: 'vendor' | 'affiliate';
  onBack: () => void;
  onComplete: (userId: string, role: 'vendor' | 'affiliate', userEmail?: string) => void;
}

export const RegistrationFlow = ({ role, onBack, onComplete }: RegistrationFlowProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // OTP resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const roleLabel = role === 'vendor' ? 'Vendor' : 'Affiliate';

  const stepCopy = useMemo(
    () => [
      {
        title: `Join as ${roleLabel}`,
        description: 'Create your account to unlock Winger opportunities.',
      },
      {
        title: 'Verify your email',
        description: 'Enter the 8-digit verification code sent to your email.',
      },
    ],
    [roleLabel],
  );

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password || !fullName) {
      toast({ title: 'Missing details', description: 'Please complete all fields.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const appUrl = await getAppUrlAsync();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
          emailRedirectTo: `${appUrl}/`,
        },
      });

      if (error) {
        toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
        return;
      }

      if (data.user) {
        setUserId(data.user.id);
        setResendCooldown(60);
        toast({
          title: 'Verification email sent!',
          description: `We've sent an 8-digit verification code to ${email}. Please check your inbox.`,
        });
        setStep(2);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: 'Unable to create your account.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 8) {
      toast({ title: 'Enter the full code', description: 'Please enter all 8 digits.', variant: 'destructive' });
      return;
    }
    if (!userId) return;

    setLoading(true);
    try {
      // Verify email OTP token with Supabase
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup',
      });

      if (verifyError) {
        throw verifyError;
      }

      // Note: The Winger backend automatically maps the user role and creates the profile
      // via the database trigger (fn_sync_user_profile) during the initial signUp. 
      // There is no need to manually insert into vendor_profiles or affiliate_profiles here.

      toast({
        title: 'Email verified',
        description: 'Your account is now activated.',
      });
      
      onComplete(userId, role, email);
    } catch (error: any) {
      toast({ 
        title: 'Verification failed', 
        description: error.message || 'The code entered is incorrect or has expired.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) throw error;

      setResendCooldown(60);
      toast({
        title: 'Code resent',
        description: `We've sent a new 8-digit code to ${email}.`,
      });
    } catch (error: any) {
      console.error("Resend error:", error);
      toast({
        title: 'Failed to resend code',
        description: error.message || "An unknown error occurred",
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-500">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <span className="text-xs sm:text-sm text-muted-foreground">Step {step} of 2</span>
          </div>
          <CardTitle className="text-xl sm:text-2xl">{stepCopy[step - 1].title}</CardTitle>
          <CardDescription>{stepCopy[step - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Amina K."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@afrilink.africa"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create a secure password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Enter Verification Code</Label>
                <InputOTP maxLength={8} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[...Array(8)].map((_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4" />
                Email verification code required before account activation.
              </div>
              <Button onClick={handleVerifyOtp} className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Continue'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleResendCode}
                disabled={loading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
              </Button>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-afrilink-green" />
                Secure signup flow powered by Winger.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
