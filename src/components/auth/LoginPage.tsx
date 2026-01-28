import { useState } from 'react';
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

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const LoginPage = ({ onNavigate }: LoginPageProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    const validation = loginSchema.safeParse({ email, password });
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Login Failed',
            description: 'Invalid email or password. Please try again.',
            variant: 'destructive',
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast({
            title: 'Email Not Verified',
            description: 'Please check your email and verify your account.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Login Failed',
            description: getUserFriendlyError(error.message),
            variant: 'destructive',
          });
        }
        return;
      }

      if (data.user) {
        toast({
          title: 'Welcome back!',
          description: 'You have successfully logged in.',
        });
        onNavigate('dashboard');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
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
            <h2 className="text-3xl font-bold text-foreground">Welcome Back</h2>
            <p className="text-muted-foreground mt-2">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
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
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => onNavigate('landing')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Home
            </button>
            <button
              onClick={() => onNavigate('forgot-password')}
              className="text-sm text-primary hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          <div className="text-center text-sm mt-4 pt-4 border-t border-border">
            Don't have an account?{' '}
            <button
              onClick={() => onNavigate('role-selection')}
              className="text-primary hover:underline font-semibold"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
