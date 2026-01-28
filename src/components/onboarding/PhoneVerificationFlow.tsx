import { useState } from 'react';
import { ArrowLeft, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateTZPhone } from '@/utils/phone';

interface PhoneVerificationFlowProps {
  userId: string;
  onComplete: () => void;
}

const maskPhone = (phone: string) => {
  if (phone.length < 4) return phone;
  return phone.replace(/\d(?=\d{4})/g, '*');
};

export const PhoneVerificationFlow = ({ userId, onComplete }: PhoneVerificationFlowProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    // Validate Tanzania phone
    const phoneValidation = validateTZPhone(phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error);
      toast({ title: 'Invalid phone', description: phoneValidation.error || 'Enter a valid phone number.', variant: 'destructive' });
      return;
    }
    setPhoneError(null);

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
      toast({
        title: 'OTP sent',
        description: `We sent a 6-digit code to ${maskPhone(phone)}.`,
      });
      setStep(2);
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

    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ phone_verified: true }).eq('id', userId);
      if (error) throw error;

      toast({
        title: 'Phone verified',
        description: 'Your account is now activated.',
      });
      onComplete();
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
            <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="px-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <span className="text-xs sm:text-sm text-muted-foreground">Step {step} of 2</span>
          </div>
          <CardTitle className="text-xl sm:text-2xl">
            {step === 1 ? 'Verify your phone number' : 'Confirm OTP'}
          </CardTitle>
          <CardDescription>
            {step === 1
              ? 'Add your phone number to activate your account.'
              : 'Enter the 6-digit code sent to your phone.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 && (
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

          {step === 2 && (
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
                disabled={loading}
              >
                Resend OTP
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
