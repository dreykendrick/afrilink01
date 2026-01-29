import { useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AffiliateProfileSetupProps {
  userId: string;
  onComplete: () => void;
  onBack?: () => void;
}

export const AffiliateProfileSetup = ({ userId, onComplete, onBack }: AffiliateProfileSetupProps) => {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file size
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Upload an image smaller than 5MB.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    
    // Check for supported image formats (reject HEIC which browsers can't display)
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isHeic = fileExtension === 'heic' || fileExtension === 'heif' || file.type === 'image/heic' || file.type === 'image/heif';
    
    if (isHeic) {
      toast({
        title: 'Unsupported format',
        description: 'HEIC images are not supported. Please convert to JPG or PNG first.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    
    if (!supportedTypes.includes(file.type) && !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExtension || '')) {
      toast({
        title: 'Unsupported format',
        description: 'Please upload a JPG, PNG, WebP, or GIF image.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    
    // Clean up previous preview URL to prevent memory leaks
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayName || !avatarFile) {
      toast({
        title: 'Missing details',
        description: 'Display name and profile image are required.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      let avatarUrl: string | null = null;
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('affiliate-avatars')
        .upload(fileName, avatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('affiliate-avatars').getPublicUrl(fileName);
      avatarUrl = data.publicUrl;

      const { error } = await (supabase.from('affiliate_profiles' as any).upsert({
        user_id: userId,
        display_name: displayName,
        bio: bio || null,
        avatar_url: avatarUrl,
      }) as unknown as Promise<{ error: any }>);

      if (error) throw error;

      toast({
        title: 'Profile saved',
        description: 'Your affiliate profile is ready to share.',
      });
      onComplete();
    } catch (error: any) {
      toast({
        title: 'Unable to save profile',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-500">
        <CardHeader className="space-y-2">
          {onBack && (
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </div>
          )}
          <CardTitle className="text-xl sm:text-2xl">Set up your affiliate profile</CardTitle>
          <CardDescription>
            Your profile helps vendors trust and collaborate with you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Amina the Growth Marketer"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Short bio (optional)</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Share your niche, audience, or marketing focus."
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="avatar">Profile image</Label>
              {avatarPreview && (
                <div className="w-28 h-28 rounded-2xl border border-border overflow-hidden">
                  <img src={avatarPreview} alt="Affiliate avatar preview" className="w-full h-full object-cover" />
                </div>
              )}
              <Input id="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" onChange={handleAvatarChange} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Affiliate Profile
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
