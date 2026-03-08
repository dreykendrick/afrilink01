import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  User, 
  Bell, 
  Shield, 
  Moon, 
  Sun,
  Globe,
  Lock,
  Mail,
  Phone,
  Save,
  Loader2,
  MapPin
} from 'lucide-react';
import { VendorLocationPicker, type VendorLocation } from '@/components/dashboard/VendorLocationPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User as UserType } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserFriendlyError } from '@/utils/errorMessages';
import { languages, type LanguageCode } from '@/i18n/config';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface SettingsPageProps {
  currentUser: UserType;
  onBack: () => void;
  onRefresh: () => void;
}

export const SettingsPage = ({ currentUser, onBack, onRefresh }: SettingsPageProps) => {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { userRole } = useAuth();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(currentUser.name);
  const [phone, setPhone] = useState('');
  const currentLanguage = (i18n.language?.substring(0, 2) || 'en') as LanguageCode;

  // Vendor location
  const [vendorLocation, setVendorLocation] = useState<VendorLocation | null>(null);
  const [vendorLocationLoaded, setVendorLocationLoaded] = useState(false);

  // Load vendor profile data on mount
  useEffect(() => {
    if (userRole === 'vendor') {
      supabase
        .from('vendor_profiles')
        .select('vendor_address, vendor_lat, vendor_lng')
        .eq('user_id', currentUser.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data && data.vendor_lat != null && data.vendor_lng != null) {
            setVendorLocation({
              lat: data.vendor_lat,
              lng: data.vendor_lng,
              address: data.vendor_address || '',
            });
          }
          setVendorLocationLoaded(true);
        });
    }
  }, [userRole, currentUser.id]);

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    toast.success(t('settings.profile.saved'));
  };
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotionalAlerts, setPromotionalAlerts] = useState(false);

  // Push notifications
  const { permission, isSubscribed, isLoading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe, isSupported: pushSupported } = usePushNotifications();

  const handlePushToggle = useCallback(async (checked: boolean) => {
    if (checked) {
      const ok = await pushSubscribe();
      if (!ok && permission === 'denied') {
        toast.error('Push notifications are blocked. Please enable them in your browser settings.');
      } else if (ok) {
        toast.success('Push notifications enabled!');
      }
    } else {
      const ok = await pushUnsubscribe();
      if (ok) toast.success('Push notifications disabled');
    }
  }, [pushSubscribe, pushUnsubscribe, permission]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName,
          phone: phone || null
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      // Save vendor location if vendor
      if (userRole === 'vendor' && vendorLocation) {
        const upsertData = {
          user_id: currentUser.id,
          vendor_address: vendorLocation.address || null,
          vendor_lat: vendorLocation.lat,
          vendor_lng: vendorLocation.lng,
        };
        const { error: vpError } = await (supabase
          .from('vendor_profiles' as any)
          .upsert(upsertData, { onConflict: 'user_id' }) as any);

        if (import.meta.env.DEV) {
          console.log('[VendorLocation] Save payload:', upsertData);
          console.log('[VendorLocation] Save error:', vpError);
        }

        if (vpError) throw vpError;
      }
      
      toast.success('Profile updated successfully!');
      onRefresh();
    } catch (error: any) {
      toast.error(getUserFriendlyError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="rounded-xl hover:bg-secondary min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account preferences</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4 sm:space-y-6">
          <div className="border-b border-border">
            <TabsList className="bg-transparent p-0 h-auto w-full flex justify-start gap-0 overflow-x-auto">
              <TabsTrigger 
                value="profile" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent min-h-[48px] px-4 sm:px-6 flex-shrink-0 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <User className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Profile</span>
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent min-h-[48px] px-4 sm:px-6 flex-shrink-0 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Bell className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Notifications</span>
              </TabsTrigger>
              <TabsTrigger 
                value="appearance" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent min-h-[48px] px-4 sm:px-6 flex-shrink-0 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Moon className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Appearance</span>
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent min-h-[48px] px-4 sm:px-6 flex-shrink-0 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Shield className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Security</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="border-border bg-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <User className="w-5 h-5 text-primary" />
                  Profile Information
                </CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 sm:space-y-6 px-4 sm:px-6">
                <div className="space-y-5 sm:space-y-0 sm:grid sm:gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="bg-secondary/50 h-12 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Input
                        id="email"
                        value={currentUser.email}
                        disabled
                        className="bg-secondary/30 text-muted-foreground h-12 sm:h-10 pr-10"
                      />
                      <Mail className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="bg-secondary/50 h-12 sm:h-10 pr-10"
                    />
                    <Phone className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                {userRole === 'vendor' && vendorLocationLoaded && (
                  <Card className="border-border bg-secondary/20 mt-2">
                    <CardHeader className="px-4 py-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        Shop / Business Location
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Used as delivery origin for your orders. Tap the map or search to set your location.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <VendorLocationPicker
                        initialLocation={vendorLocation}
                        onLocationChange={setVendorLocation}
                        compact
                      />
                    </CardContent>
                  </Card>
                )}
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={saving}
                  className="bg-gradient-primary hover:opacity-90 w-full sm:w-auto min-h-[44px]"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card className="border-border bg-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Bell className="w-5 h-5 text-primary" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Choose what notifications you receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-secondary/30 gap-3">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <Label className="text-sm sm:text-base">Email Notifications</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} className="flex-shrink-0" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-secondary/30 gap-3">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <Label className="text-sm sm:text-base">Push Notifications</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">Receive push notifications in browser</p>
                    </div>
                    <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} className="flex-shrink-0" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-secondary/30 gap-3">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <Label className="text-sm sm:text-base">Order Updates</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">Get notified about order status changes</p>
                    </div>
                    <Switch checked={orderUpdates} onCheckedChange={setOrderUpdates} className="flex-shrink-0" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-secondary/30 gap-3">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <Label className="text-sm sm:text-base">Marketing Emails</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">Receive marketing and promotional emails</p>
                    </div>
                    <Switch checked={marketingEmails} onCheckedChange={setMarketingEmails} className="flex-shrink-0" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-secondary/30 gap-3">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <Label className="text-sm sm:text-base">Promotional Alerts</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">Get alerts for deals and promotions</p>
                    </div>
                    <Switch checked={promotionalAlerts} onCheckedChange={setPromotionalAlerts} className="flex-shrink-0" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <Card className="border-border bg-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  {theme === 'dark' ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
                  Appearance
                </CardTitle>
                <CardDescription>Customize how AfriLink looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 sm:space-y-6 px-4 sm:px-6">
                <div className="space-y-3 sm:space-y-4">
                  <Label className="text-sm sm:text-base">Theme</Label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <button
                      onClick={() => setTheme('light')}
                      className={`p-3 sm:p-4 rounded-xl border-2 transition-all min-h-[80px] sm:min-h-[100px] ${
                        theme === 'light' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                        <Sun className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500" />
                        <span className="text-xs sm:text-sm font-medium">Light</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`p-3 sm:p-4 rounded-xl border-2 transition-all min-h-[80px] sm:min-h-[100px] ${
                        theme === 'dark' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                        <Moon className="w-6 h-6 sm:w-8 sm:h-8 text-afrilink-blue" />
                        <span className="text-xs sm:text-sm font-medium">Dark</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`p-3 sm:p-4 rounded-xl border-2 transition-all min-h-[80px] sm:min-h-[100px] ${
                        theme === 'system' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                        <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-afrilink-purple" />
                        <span className="text-xs sm:text-sm font-medium">System</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <Label className="text-sm sm:text-base">{t('settings.appearance.language')}</Label>
                  <Select value={currentLanguage} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-full bg-secondary/50 h-12 sm:h-10">
                      <SelectValue placeholder={t('settings.appearance.language')} />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.nativeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card className="border-border bg-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Shield className="w-5 h-5 text-primary" />
                  Security
                </CardTitle>
                <CardDescription>Manage your security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 rounded-xl bg-secondary/30">
                    <div className="mb-3 sm:mb-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm sm:text-base flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          Change Password
                        </Label>
                        <p className="text-xs sm:text-sm text-muted-foreground">Update your password regularly for security</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">
                      Change Password
                    </Button>
                  </div>

                  <div className="p-3 sm:p-4 rounded-xl bg-secondary/30">
                    <div className="mb-3 sm:mb-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm sm:text-base flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Two-Factor Authentication
                        </Label>
                        <p className="text-xs sm:text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">
                      Enable 2FA
                    </Button>
                  </div>

                  <div className="p-3 sm:p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                    <div className="space-y-0.5 mb-3 sm:mb-4">
                      <Label className="text-sm sm:text-base text-destructive">Danger Zone</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">Permanently delete your account and all data</p>
                    </div>
                    <Button variant="destructive" className="w-full sm:w-auto min-h-[44px]">
                      Delete Account
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
