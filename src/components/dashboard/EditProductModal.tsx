import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, ImagePlus, Trash2, Plus, Package, Tag, FileText, Percent, Sparkles, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/utils/errorMessages';
import { Product } from '@/types';

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onProductUpdated: () => void;
}

const categories = [
  'Electronics', 'Fashion', 'Home & Garden', 'Beauty', 'Sports',
  'Books', 'Toys', 'Food & Beverages', 'Health', 'Other',
];

const MAX_IMAGES = 5;

interface FormData {
  title: string;
  description: string;
  price: string;
  commission: string;
  category: string;
  image_urls: string[];
}

export const EditProductModal = ({ isOpen, onClose, product, onProductUpdated }: EditProductModalProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: '', description: '', price: '', commission: '10', category: '', image_urls: [],
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Hydrate form when product changes / modal opens
  useEffect(() => {
    if (isOpen && product) {
      const images = product.images && product.images.length > 0
        ? product.images
        : (product.image ? [product.image] : []);
      setFormData({
        title: product.title || '',
        description: product.description || '',
        price: String(product.price ?? ''),
        commission: String(product.commission ?? 10),
        category: product.category || '',
        image_urls: images,
      });
      setIsLoading(false);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen, product]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_IMAGES - formData.image_urls.length;
    if (remainingSlots <= 0) {
      toast({ title: 'Maximum images reached', description: `Up to ${MAX_IMAGES} images`, variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        toast({ title: 'Not authenticated', description: 'Please log in', variant: 'destructive' });
        setIsUploading(false);
        return;
      }

      const validFiles = Array.from(files).slice(0, remainingSlots).filter(file => {
        if (!file.type.startsWith('image/')) {
          toast({ title: 'Invalid file', description: `${file.name} is not an image`, variant: 'destructive' });
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast({ title: 'File too large', description: `${file.name} > 5MB`, variant: 'destructive' });
          return false;
        }
        return true;
      });

      const uploadedUrls: string[] = [];
      for (const file of validFiles) {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${userId}/${product?.id || 'edit'}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
        if (uploadError) {
          toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
          continue;
        }
        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      if (uploadedUrls.length > 0 && isMountedRef.current) {
        setFormData(prev => ({ ...prev, image_urls: [...prev.image_urls, ...uploadedUrls] }));
        toast({ title: 'Images uploaded!', description: `${uploadedUrls.length} image(s) added` });
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        toast({ title: 'Upload failed', description: getUserFriendlyError(error), variant: 'destructive' });
      }
    } finally {
      if (isMountedRef.current) setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [formData.image_urls.length, product?.id, toast]);

  const removeImage = useCallback((index: number) => {
    setFormData(prev => ({ ...prev, image_urls: prev.image_urls.filter((_, i) => i !== index) }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading || !product) return;

    const missing: string[] = [];
    if (!formData.title?.trim()) missing.push('Title');
    if (!formData.price || parseFloat(formData.price) <= 0) missing.push('Price');
    if (!formData.category) missing.push('Category');
    if (missing.length > 0) {
      toast({ title: 'Missing fields', description: `Please fill in: ${missing.join(', ')}`, variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const priceValue = parseFloat(formData.price);
      const commissionRaw = parseInt(formData.commission);
      const commissionValue = isNaN(commissionRaw) || commissionRaw < 1 ? 10 : Math.min(commissionRaw, 50);
      const imageUrls = formData.image_urls;

      // Edits to approved/rejected products go back to pending review
      const nextStatus = (product.status === 'approved' || product.status === 'rejected')
        ? 'pending'
        : product.status;

      const updateData: any = {
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        price: Math.round(priceValue),
        commission: commissionValue,
        category: formData.category,
        image_url: imageUrls.length > 0 ? imageUrls[0] : null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        status: nextStatus,
      };

      const { error } = await supabase.from('products').update(updateData).eq('id', product.id);
      if (error) throw new Error(error.message);

      toast({
        title: 'Product updated',
        description: nextStatus === 'pending' && product.status !== 'pending'
          ? 'Your changes were saved and will be reviewed again.'
          : 'Your product changes have been saved.',
      });

      onProductUpdated();
      onClose();
    } catch (error: any) {
      if (isMountedRef.current) {
        toast({ title: 'Error updating product', description: getUserFriendlyError(error), variant: 'destructive' });
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  const triggerFileInput = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => fileInputRef.current?.click(), 100);
  }, []);

  const imagePreviews = formData.image_urls;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-gradient-to-b from-card to-card/95">
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="h-1 w-full bg-gradient-primary" />
          <div className="p-4 sm:p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Edit Product</h2>
              <p className="text-xs text-muted-foreground">Update your product details</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">Product Images</Label>
              <span className="ml-auto text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                {imagePreviews.length}/{MAX_IMAGES}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {imagePreviews.map((preview, index) => (
                <div key={`${preview}-${index}`} className="relative group aspect-square">
                  <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-xl border-2 border-border shadow-md" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full shadow-lg sm:opacity-100 hover:scale-110 transition-all touch-manipulation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {index === 0 && (
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-gradient-primary text-primary-foreground text-xs font-medium rounded-full shadow-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />Main
                    </span>
                  )}
                </div>
              ))}
              {imagePreviews.length < MAX_IMAGES && imagePreviews.length > 0 && (
                <button type="button" onClick={triggerFileInput} disabled={isUploading}
                  className="aspect-square border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all touch-manipulation active:scale-95 group">
                  {isUploading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-secondary/80 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <span className="text-xs text-muted-foreground group-hover:text-primary">Add More</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {imagePreviews.length === 0 && (
              <button type="button" onClick={triggerFileInput} disabled={isUploading}
                className="w-full h-36 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all touch-manipulation active:scale-[0.98] group">
                {isUploading ? (
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <ImagePlus className="w-7 h-7 text-primary" />
                    </div>
                    <span className="text-sm font-semibold">Tap to upload images</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              <Label htmlFor="edit-title" className="text-sm font-semibold">Product Title</Label>
              <span className="text-destructive">*</span>
            </div>
            <Input id="edit-title" value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="bg-secondary/30 border-border focus:border-primary focus:ring-primary/20 h-11" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <Label htmlFor="edit-description" className="text-sm font-semibold">Description</Label>
            </div>
            <Textarea id="edit-description" value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="bg-secondary/30 border-border focus:border-primary focus:ring-primary/20 min-h-[100px] resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 text-afrilink-green text-xs font-bold">Tsh</span>
                <Label htmlFor="edit-price" className="text-sm font-semibold">Price</Label>
                <span className="text-destructive">*</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">Tsh</span>
                <Input id="edit-price" type="number" inputMode="decimal" step="0.01" min="0"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  className="bg-secondary/30 border-border focus:border-afrilink-green focus:ring-afrilink-green/20 h-11 pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-afrilink-purple" />
                <Label htmlFor="edit-commission" className="text-sm font-semibold">Commission</Label>
              </div>
              <div className="relative">
                <Input id="edit-commission" type="number" inputMode="numeric" min="1" max="50"
                  value={formData.commission}
                  onChange={(e) => setFormData(prev => ({ ...prev, commission: e.target.value }))}
                  className="bg-secondary/30 border-border focus:border-afrilink-purple focus:ring-afrilink-purple/20 h-11 pr-7" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <Label htmlFor="edit-category" className="text-sm font-semibold">Category</Label>
              <span className="text-destructive">*</span>
            </div>
            <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
              <SelectTrigger className="bg-secondary/30 border-border focus:border-primary focus:ring-primary/20 h-11">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat} className="focus:bg-primary/10 focus:text-foreground">{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {product && (product.status === 'approved' || product.status === 'rejected') && (
            <p className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg border border-border">
              Note: Editing this product will resubmit it for admin review.
            </p>
          )}

          <div className="pt-4 flex gap-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}
              className="flex-1 h-11 border-border hover:bg-secondary/50"
              disabled={isLoading || isUploading}>Cancel</Button>
            <Button type="submit"
              className="flex-1 h-11 bg-gradient-primary hover:opacity-90 shadow-lg hover:shadow-glow transition-all touch-manipulation"
              disabled={isLoading || isUploading}>
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Save Changes</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
