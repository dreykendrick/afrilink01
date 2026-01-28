import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Mail, 
  Phone, 
  Camera,
  CheckCircle2,
  Clock,
  XCircle,
  Upload,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VerificationManagePageProps {
  currentUser: User;
  onBack: () => void;
  onRefresh: () => void;
}

interface VerificationData {
  email_verified: boolean;
  phone_verified: boolean;
  photo_verified: boolean;
  verification_status: string | null;
  verification_photo_url: string | null;
  phone: string | null;
}

export const VerificationManagePage = ({ currentUser, onBack, onRefresh }: VerificationManagePageProps) => {
  const [loading, setLoading] = useState(true);
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phone, setPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email_verified, phone_verified, photo_verified, verification_status, verification_photo_url, phone')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;
      setVerificationData(data);
      setPhone(data.phone || '');
    } catch (error: any) {
      toast.error('Failed to load verification status');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneUpdate = async () => {
    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone, phone_verified: false })
        .eq('id', currentUser.id);

      if (error) throw error;
      toast.success('Phone number updated! Verification pending.');
      fetchVerificationStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update phone');
    } finally {
      setSavingPhone(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
      const filePath = `verification-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('verification-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('verification-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          verification_photo_url: publicUrl,
          photo_verified: false,
          verification_status: 'pending_review'
        })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      toast.success('Photo uploaded! Awaiting admin review.');
      fetchVerificationStatus();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const requestNewVerification = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          verification_status: 'pending',
          photo_verified: false
        })
        .eq('id', currentUser.id);

      if (error) throw error;
      toast.success('Verification request submitted!');
      fetchVerificationStatus();
      onRefresh();
    } catch (error: any) {
      toast.error('Failed to request verification');
    }
  };

  const getStatusBadge = (verified: boolean | null, status?: string | null) => {
    if (status === 'rejected') {
      return (
        <Badge className="bg-destructive/20 text-destructive border-destructive/30">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    }
    if (status === 'pending_review' || status === 'pending') {
      return (
        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
          <Clock className="w-3 h-3 mr-1" />
          Pending Review
        </Badge>
      );
    }
    if (verified) {
      return (
        <Badge className="bg-afrilink-green/20 text-afrilink-green border-afrilink-green/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Verified
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <AlertCircle className="w-3 h-3 mr-1" />
        Not Verified
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="rounded-xl hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Verification Status</h1>
            <p className="text-sm text-muted-foreground">Manage your account verification</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchVerificationStatus}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Overall Status Card */}
        <Card className="border-border bg-card mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Account Status
              </CardTitle>
              {getStatusBadge(
                verificationData?.verification_status === 'verified',
                verificationData?.verification_status
              )}
            </div>
          </CardHeader>
          <CardContent>
            {verificationData?.verification_status === 'rejected' && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Verification Rejected</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your verification was not approved. Please update your information and try again.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {verificationData?.verification_status === 'verified' && (
              <div className="p-4 rounded-xl bg-afrilink-green/10 border border-afrilink-green/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-afrilink-green mt-0.5" />
                  <div>
                    <p className="font-medium text-afrilink-green">Fully Verified</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your account is verified. You have full access to all features.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification Steps */}
        <div className="space-y-4">
          {/* Email Verification */}
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    verificationData?.email_verified 
                      ? 'bg-afrilink-green/10' 
                      : 'bg-secondary'
                  }`}>
                    <Mail className={`w-6 h-6 ${
                      verificationData?.email_verified 
                        ? 'text-afrilink-green' 
                        : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Email Verification</h3>
                    <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                  </div>
                </div>
                {getStatusBadge(verificationData?.email_verified)}
              </div>
            </CardContent>
          </Card>

          {/* Phone Verification */}
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    verificationData?.phone_verified 
                      ? 'bg-afrilink-green/10' 
                      : 'bg-secondary'
                  }`}>
                    <Phone className={`w-6 h-6 ${
                      verificationData?.phone_verified 
                        ? 'text-afrilink-green' 
                        : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Phone Verification</h3>
                    <p className="text-sm text-muted-foreground">
                      {verificationData?.phone || 'No phone number added'}
                    </p>
                  </div>
                </div>
                {getStatusBadge(verificationData?.phone_verified)}
              </div>
              <div className="flex gap-2 mt-4">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="bg-secondary/50"
                />
                <Button 
                  onClick={handlePhoneUpdate}
                  disabled={savingPhone || !phone}
                  variant="outline"
                >
                  {savingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Photo ID Verification */}
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    verificationData?.photo_verified 
                      ? 'bg-afrilink-green/10' 
                      : 'bg-secondary'
                  }`}>
                    <Camera className={`w-6 h-6 ${
                      verificationData?.photo_verified 
                        ? 'text-afrilink-green' 
                        : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Photo ID Verification</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload a clear photo of your government-issued ID
                    </p>
                  </div>
                </div>
                {getStatusBadge(verificationData?.photo_verified, verificationData?.verification_status)}
              </div>
              
              {verificationData?.verification_photo_url && (
                <div className="mb-4">
                  <img 
                    src={verificationData.verification_photo_url} 
                    alt="Verification" 
                    className="w-32 h-32 object-cover rounded-xl border border-border"
                  />
                </div>
              )}
              
              <div className="flex gap-2">
                <Label 
                  htmlFor="photo-upload" 
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? 'Uploading...' : 'Upload New Photo'}
                </Label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Request New Verification */}
        {(verificationData?.verification_status === 'rejected' || 
          verificationData?.verification_status === 'verified') && (
          <div className="mt-6">
            <Button 
              onClick={requestNewVerification}
              className="w-full bg-gradient-primary hover:opacity-90"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Request New Verification
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
