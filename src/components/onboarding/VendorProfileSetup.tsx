import { useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Tanzania cities
const TANZANIA_CITIES = [
  ...new Set([
    'Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Morogoro', 'Tanga', 'Kahama',
    'Tabora', 'Zanzibar City', 'Kigoma', 'Sumbawanga', 'Kasulu', 'Songea', 'Musoma',
    'Shinyanga', 'Iringa', 'Singida', 'Njombe', 'Bukoba', 'Moshi', 'Mpanda', 'Mtwara',
    'Lindi', 'Babati', 'Korogwe', 'Kibaha', 'Geita', 'Bariadi', 'Handeni', 'Kondoa',
    'Makambako', 'Chake Chake', 'Wete', 'Mbamba Bay', 'Kilosa', 'Ifakara', 'Nzega',
    'Igunga', 'Uvinza', 'Sengerema', 'Tarime', 'Masasi', 'Newala', 'Nachingwea',
    'Tunduma', 'Kyela', 'Rujewa', 'Makete', 'Same', 'Mwanga', 'Rombo', 'Hai', 'Siha',
    'Karatu', 'Monduli', 'Longido', 'Ngorongoro', 'Meatu', 'Maswa', 'Kwimba', 'Magu',
    'Misungwi', 'Ukerewe', 'Butiama', 'Bunda', 'Serengeti', 'Rorya', 'Nyang\'hwale',
    'Chato', 'Biharamulo', 'Muleba', 'Karagwe', 'Kyerwa', 'Misenyi', 'Ngara', 'Kakonko',
    'Kibondo', 'Buhigwe', 'Urambo', 'Kaliua', 'Sikonge', 'Uyui', 'Nkasi',
    'Kalambo', 'Mlele', 'Mpimbwe', 'Tanganyika', 'Nsimbo', 'Kilolo',
    'Mufindi', 'Wanging\'ombe', 'Ludewa', 'Songwe', 'Momba', 'Ileje',
    'Mbozi', 'Mbarali', 'Rungwe', 'Busokelo', 'Kilombero', 'Ulanga', 'Malinyi', 'Gairo',
    'Mvomero', 'Kilwa', 'Ruangwa', 'Liwale', 'Bagamoyo', 'Kisarawe', 'Mkuranga',
    'Rufiji', 'Mafia', 'Temeke', 'Ilala', 'Kinondoni', 'Ubungo', 'Kigamboni'
  ])
].sort();

interface VendorProfileSetupProps {
  userId: string;
  onComplete: () => void;
  onBack?: () => void;
}

export const VendorProfileSetup = ({ userId, onComplete, onBack }: VendorProfileSetupProps) => {
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState('');
  const [vendorType, setVendorType] = useState<'individual' | 'business'>('individual');
  const [city, setCity] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorLat, setVendorLat] = useState<number | null>(null);
  const [vendorLng, setVendorLng] = useState<number | null>(null);
  const [about, setAbout] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }
    
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!businessName || !city || !pickupLocation || !logoFile) {
      toast({
        title: 'Missing details',
        description: 'Business name, city, pickup location, and profile image are required.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      let logoUrl: string | null = null;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${userId}/logo.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('vendor-logos')
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('vendor-logos').getPublicUrl(fileName);
        logoUrl = data.publicUrl;
      }

      const { error } = await (supabase.from('vendor_profiles' as any).upsert({
        user_id: userId,
        business_name: businessName,
        vendor_type: vendorType,
        city,
        pickup_location: pickupLocation,
        vendor_address: vendorAddress || null,
        vendor_lat: vendorLat,
        vendor_lng: vendorLng,
        about,
        logo_url: logoUrl,
        verification_status: 'pending',
      }, { onConflict: 'user_id' }) as unknown as Promise<{ error: any }>);

      if (error) throw error;

      toast({
        title: 'Profile saved',
        description: 'Your vendor profile is now live.',
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
          <CardTitle className="text-xl sm:text-2xl">Complete your vendor profile</CardTitle>
          <CardDescription>
            This information appears publicly on your vendor and product pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business / Brand name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="AfriLink Originals"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendorType">Vendor type</Label>
                <Select value={vendorType} onValueChange={(value: 'individual' | 'business') => setVendorType(value)}>
                  <SelectTrigger id="vendorType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City (public)</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger id="city">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TANZANIA_CITIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickupLocation">Pickup / Dispatch address (private)</Label>
              <Input
                id="pickupLocation"
                value={pickupLocation}
                onChange={(event) => setPickupLocation(event.target.value)}
                placeholder="Your address for dispatch only"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendorAddress">Shop / Business address (public, for delivery origin)</Label>
              <Input
                id="vendorAddress"
                value={vendorAddress}
                onChange={(event) => setVendorAddress(event.target.value)}
                placeholder="e.g. Kariakoo Market, Dar es Salaam"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendorLat">Latitude (optional)</Label>
                <Input
                  id="vendorLat"
                  type="number"
                  step="any"
                  value={vendorLat ?? ''}
                  onChange={(event) => setVendorLat(event.target.value ? parseFloat(event.target.value) : null)}
                  placeholder="-6.8235"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorLng">Longitude (optional)</Label>
                <Input
                  id="vendorLng"
                  type="number"
                  step="any"
                  value={vendorLng ?? ''}
                  onChange={(event) => setVendorLng(event.target.value ? parseFloat(event.target.value) : null)}
                  placeholder="39.2695"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: Open Google Maps, right-click your shop location, and copy the coordinates.
            </p>
            <div className="space-y-2">
              <Label htmlFor="about">About Vendor</Label>
              <Textarea
                id="about"
                value={about}
                onChange={(event) => setAbout(event.target.value)}
                placeholder="Tell affiliates what makes your brand stand out."
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="logo">Profile image / logo <span className="text-destructive">*</span></Label>
              {logoPreview && (
                <div className="w-28 h-28 rounded-2xl border border-border overflow-hidden">
                  <img src={logoPreview} alt="Vendor logo preview" className="w-full h-full object-cover" />
                </div>
              )}
              <Input id="logo" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" onChange={handleLogoChange} required />
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
                  Save Vendor Profile
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
