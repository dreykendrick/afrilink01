import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { getUserFriendlyError } from '@/utils/errorMessages';

interface LoginPageProps {
  onNavigate: (view: string) => void;
}

export const LoginPage = ({ onNavigate }: LoginPageProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginSchema = z.object({
    email: z.string().email(t('errors.validation')),
    password: z.string().min(6, t('errors.validation')),
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        title: t('common.error'),
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: t('common.error'),
            description: t('errors.validation'),
            variant: 'destructive',
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast({
            title: t('auth.verifyEmail'),
            description: t('auth.checkInbox'),
            variant: 'destructive',
          });
        } else {
          toast({
            title: t('common.error'),
            description: getUserFriendlyError(error.message),
            variant: 'destructive',
          });
        }
        return;
      }

      if (data.user) {
        toast({
          title: t('common.success'),
          description: t('dashboard.welcome') + '!',
        });
        onNavigate('dashboard');
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4">
      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-card backdrop-blur-lg rounded-2xl p-8 border border-border shadow-card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-glow">
              <ShoppingCart className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">{t('dashboard.welcome')}</h2>
            <p className="text-muted-foreground mt-2">{t('auth.login')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
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

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('auth.login')
              )}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => onNavigate('landing')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {t('common.back')}
            </button>
            <button
              onClick={() => onNavigate('forgot-password')}
              className="text-sm text-primary hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>

          <div className="text-center text-sm mt-4 pt-4 border-t border-border">
            {t('auth.noAccount')}{' '}
            <button
              onClick={() => onNavigate('role-selection')}
              className="text-primary hover:underline font-semibold"
            >
              {t('auth.signup')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
