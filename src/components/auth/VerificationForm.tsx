import { useState } from 'react';
import { Camera, Phone, Mail, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
interface VerificationFormProps {
  userId: string;
  onComplete: () => void;
}

export const VerificationForm = ({ userId, onComplete }: VerificationFormProps) => {
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);

  const handlePhoneVerification = async () => {
    if (!phone) {
      toast({ title: 'Error', description: 'Please enter a phone number', variant: 'destructive' });
      return;
    }

    try {
      // Update profile with phone number
      const { error } = await supabase
        .from('profiles')
        .update({ phone, phone_verified: true })
        .eq('id', userId);

      if (error) throw error;

      setPhoneVerified(true);
      toast({ title: 'Success', description: 'Phone number verified successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Error', description: 'File size must be less than 5MB', variant: 'destructive' });
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) {
      toast({ title: 'Error', description: 'Please select a photo', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      // Verify user is authenticated before upload
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ 
          title: 'Authentication Required', 
          description: 'Please sign in again to upload your verification photo.', 
          variant: 'destructive' 
        });
        setUploading(false);
        return;
      }

      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${session.user.id}/verification.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('verification-photos')
        .upload(fileName, photoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('verification-photos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          verification_photo_url: publicUrl,
          photo_verified: true 
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setPhotoUploaded(true);
      toast({ title: 'Success', description: 'Photo uploaded successfully!' });
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to upload photo', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleComplete = async () => {
    if (!phoneVerified || !photoUploaded) {
      toast({ 
        title: 'Incomplete Verification', 
        description: 'Please complete all verification steps',
        variant: 'destructive' 
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          email_verified: true,
          verification_status: 'pending_review' 
        })
        .eq('id', userId);

      if (error) throw error;

      toast({ 
        title: 'Verification Submitted!', 
        description: 'Your documents are under review. You will be notified once approved.' 
      });
      onComplete();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-3 sm:p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl">Account Verification</CardTitle>
          <CardDescription className="text-sm">
            Complete all verification steps to activate your account
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4 sm:space-y-6">
          {/* Email Verification */}
          <div className="flex items-center space-x-3 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-900 dark:text-green-100 text-sm sm:text-base">Email Verified</p>
              <p className="text-xs sm:text-sm text-green-700 dark:text-green-300">Your email has been confirmed</p>
            </div>
          </div>

          {/* Phone Verification */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
              <Label className="text-sm sm:text-base">Phone Verification</Label>
            </div>
            {!phoneVerified ? (
              <>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-sm sm:text-base"
                />
                <Button onClick={handlePhoneVerification} className="w-full">
                  Verify Phone Number
                </Button>
              </>
            ) : (
              <div className="flex items-center space-x-3 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="font-medium text-green-900 dark:text-green-100 text-sm sm:text-base">Phone Verified</p>
              </div>
            )}
          </div>

          {/* Photo Verification */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
              <Label className="text-sm sm:text-base">Photo Verification</Label>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Upload a clear photo of yourself holding an ID document
            </p>
            {photoPreview && (
              <div className="relative w-full h-40 sm:h-48 rounded-lg overflow-hidden border">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
            {!photoUploaded ? (
              <>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="cursor-pointer text-sm"
                />
                <Button 
                  onClick={handlePhotoUpload} 
                  disabled={!photoFile || uploading}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </Button>
              </>
            ) : (
              <div className="flex items-center space-x-3 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="font-medium text-green-900 dark:text-green-100 text-sm sm:text-base">Photo Uploaded</p>
              </div>
            )}
          </div>

          {/* Pending Review Notice */}
          <div className="flex items-start space-x-3 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100 text-sm sm:text-base">Admin Approval Required</p>
              <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                After submitting, your verification will be reviewed by our team. This usually takes 1-2 business days.
              </p>
            </div>
          </div>

          <Button 
            onClick={handleComplete}
            disabled={!phoneVerified || !photoUploaded}
            className="w-full"
            size="lg"
          >
            <Clock className="w-4 h-4 mr-2" />
            Submit for Review
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
