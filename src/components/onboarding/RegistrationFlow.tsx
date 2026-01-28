import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateTZPhone } from '@/utils/phone';

interface RegistrationFlowProps {
  role: 'vendor' | 'affiliate';
  onBack: () => void;
  onComplete: (userId: string, role: 'vendor' | 'affiliate') => void;
}

const maskPhone = (phone: string) => {
  if (phone.length < 4) return phone;
  return phone.replace(/\d(?=\d{4})/g, '*');
};

export const RegistrationFlow = ({ role, onBack, onComplete }: RegistrationFlowProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [phoneError, setPhoneError] = useState<string | null>(null);

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
        description: 'Create your account to unlock AfriLink opportunities.',
      },
      {
        title: 'Add your phone number',
        description: 'We will send a one-time code to verify your account.',
      },
      {
        title: 'Verify OTP',
        description: 'Enter the 6-digit code sent to your phone.',
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
        return;
      }

      if (data.user) {
        setUserId(data.user.id);

        const { error: roleError } = await supabase.from('user_roles').insert({ user_id: data.user.id, role });
        if (roleError) {
          console.error('Role creation error:', roleError);
        }

        const { error: appError } = await supabase.from('applications').insert({
          user_id: data.user.id,
          email,
          full_name: fullName,
          role,
          status: 'pending',
        });

        if (appError) {
          console.error('Application creation error:', appError);
        }

        toast({
          title: 'Account created!',
          description: 'Continue to verify your phone number.',
        });
        setStep(2);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: 'Unable to create your account.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    // Validate Tanzania phone
    const phoneValidation = validateTZPhone(phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error);
      toast({ title: 'Invalid phone', description: phoneValidation.error || 'Enter a valid phone number.', variant: 'destructive' });
      return;
    }
    setPhoneError(null);

    if (!userId) {
      toast({ title: 'Phone required', description: 'Enter a valid phone number.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const normalizedPhone = phoneValidation.normalized || phone;
    try {
      const { error } = await supabase.from('profiles').update({ phone: normalizedPhone, phone_verified: false }).eq('id', userId);
      if (error) throw error;

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const { data, error: otpError } = await supabase.functions.invoke('send-otp', {
        body: { phone: normalizedPhone, code: otpCode },
      });

      if (otpError || !data?.success) {
        throw otpError || new Error(data?.error || 'Unable to send OTP.');
      }

      setGeneratedOtp(otpCode);
      setOtp('');
      setResendCooldown(60); // 60 second cooldown
      toast({
        title: 'OTP sent',
        description: `We sent a 6-digit code to ${maskPhone(phone)}.`,
      });
      setStep(3);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send OTP.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      toast({ title: 'Enter the full code', description: 'Please enter all 6 digits.', variant: 'destructive' });
      return;
    }
    if (otp !== generatedOtp) {
      toast({ title: 'Invalid code', description: 'The OTP entered is incorrect.', variant: 'destructive' });
      return;
    }
    if (!userId) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ phone_verified: true }).eq('id', userId);
      if (error) throw error;

      if (role === 'vendor') {
        const { error: profileError } = await (supabase.from('vendor_profiles' as any).upsert(
          { user_id: userId, verification_status: 'pending' },
          { onConflict: 'user_id' },
        ) as unknown as Promise<{ error: any }>);
        if (profileError) throw profileError;
      } else {
        const { error: profileError } = await (supabase.from('affiliate_profiles' as any).upsert(
          { user_id: userId },
          { onConflict: 'user_id' },
        ) as unknown as Promise<{ error: any }>);
        if (profileError) throw profileError;
      }

      toast({
        title: 'Phone verified',
        description: 'Your account is now activated.',
      });
      onComplete(userId, role);
    } catch (error: any) {
      toast({ title: 'Verification failed', description: error.message, variant: 'destructive' });
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
            <span className="text-xs sm:text-sm text-muted-foreground">Step {step} of 3</span>
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
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setPhoneError(null);
                  }}
                  placeholder="+255XXXXXXXXX or 0XXXXXXXXX"
                  className={phoneError ? 'border-destructive' : ''}
                  required
                />
                {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
              </div>
              <Button onClick={handleSendOtp} className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  'Send OTP'
                )}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Enter OTP</Label>
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {/* Dev mode OTP display */}
              {import.meta.env.DEV && generatedOtp && (
                <div className="p-3 bg-accent border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground font-mono text-center">
                    <span className="font-semibold text-foreground">DEV MODE:</span> OTP is <span className="text-lg font-bold text-primary">{generatedOtp}</span>
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4" />
                OTP required before account activation.
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
                onClick={handleSendOtp}
                disabled={loading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
              </Button>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-afrilink-green" />
                Secure signup flow powered by AfriLink.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
