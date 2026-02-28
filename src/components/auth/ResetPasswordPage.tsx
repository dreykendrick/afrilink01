import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Lock, Loader2, Eye, EyeOff, CheckCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { getResetDeepLink } from '@/utils/resetUrl';

interface ResetPasswordPageProps {
  onNavigate: (view: string) => void;
}

const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const ResetPasswordPage = ({ onNavigate }: ResetPasswordPageProps) => {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Extract token from URL for deep-link button (Phase 2)
  const resetToken = useMemo(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    return params.get('access_token') || new URLSearchParams(window.location.search).get('token') || '';
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true);
        console.log('[ResetPassword] Valid session found from reset link');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasSession(true);
        console.log('[ResetPassword] PASSWORD_RECOVERY event received');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast({
        title: 'Validation Error',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error('[ResetPassword] Update failed:', error.message);
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      console.log('[ResetPassword] Password updated successfully');
      setResetComplete(true);
      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully reset.',
      });

      // Sign out all sessions and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut({ scope: 'global' });
        onNavigate('login');
      }, 3000);
    } catch (error: any) {
      console.error('[ResetPassword] Unexpected error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInApp = () => {
    if (!resetToken) return;
    const deepLink = getResetDeepLink(resetToken);
    window.location.href = deepLink;
    // If the app isn't installed, nothing will happen – user stays on page
  };

  // ── Invalid / expired link state ──
  if (!hasSession && !resetComplete) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4">
        <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-card backdrop-blur-lg rounded-2xl p-8 border border-border shadow-card text-center">
            <div className="w-16 h-16 bg-destructive/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Invalid or Expired Link</h2>
            <p className="text-muted-foreground mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button
              onClick={() => onNavigate('forgot-password')}
              className="w-full bg-gradient-primary hover:opacity-90"
            >
              Request New Link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ──
  if (resetComplete) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4">
        <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-card backdrop-blur-lg rounded-2xl p-8 border border-border shadow-card text-center">
            <div className="w-16 h-16 bg-afrilink-green/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-afrilink-green" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Password Reset Complete</h2>
            <p className="text-muted-foreground mb-6">
              Your password has been successfully updated. You'll be redirected to the login page shortly.
            </p>
            <Button
              onClick={() => onNavigate('login')}
              className="w-full bg-gradient-primary hover:opacity-90"
            >
              Go to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset form ──
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4">
      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-card backdrop-blur-lg rounded-2xl p-8 border border-border shadow-card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-glow">
              <ShoppingCart className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">New Password</h2>
            <p className="text-muted-foreground mt-2">Enter your new password below</p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>

          {/* Phase 2: Deep link button for mobile app */}
          {resetToken && (
            <div className="mt-4 pt-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenInApp}
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Open in AfriLink App
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Don't have the app? Install AfriLink to reset inside the app.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
