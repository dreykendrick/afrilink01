import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, ImagePlus, Trash2, Plus, Package, DollarSign, Tag, FileText, Percent, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductAdded: () => void;
}

const categories = [
  'Electronics',
  'Fashion',
  'Home & Garden',
  'Beauty',
  'Sports',
  'Books',
  'Toys',
  'Food & Beverages',
  'Health',
  'Other'
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

const initialFormData: FormData = {
  title: '',
  description: '',
  price: '',
  commission: '10',
  category: '',
  image_urls: []
};

export const AddProductModal = ({ isOpen, onClose, onProductAdded }: AddProductModalProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  
  // Store image previews separately to persist across re-renders
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Small delay to allow animation to complete before resetting
      const timer = setTimeout(() => {
        setFormData(initialFormData);
        setImagePreviews([]);
        setIsLoading(false);
        setIsUploading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('=== IMAGE UPLOAD START ===', { filesCount: files?.length });
    
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }

    const currentImageCount = imagePreviews.length;
    const remainingSlots = MAX_IMAGES - currentImageCount;
    console.log('Remaining slots:', remainingSlots);
    
    if (remainingSlots <= 0) {
      toast({
        title: 'Maximum images reached',
        description: `You can only upload up to ${MAX_IMAGES} images`,
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get user session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Session check:', { hasSession: !!session, error: sessionError?.message });
      
      if (sessionError || !session?.user) {
        // Try to refresh session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session?.user) {
          toast({
            title: 'Not authenticated',
            description: 'Please log in to upload images',
            variant: 'destructive'
          });
          setIsUploading(false);
          return;
        }
      }

      const userId = session?.user?.id || (await supabase.auth.getSession()).data.session?.user?.id;
      
      if (!userId) {
        toast({
          title: 'Not authenticated',
          description: 'Please log in to upload images',
          variant: 'destructive'
        });
        setIsUploading(false);
        return;
      }

      // Filter and validate files
      const validFiles = Array.from(files).slice(0, remainingSlots).filter(file => {
        if (!file.type.startsWith('image/')) {
          toast({
            title: 'Invalid file',
            description: `${file.name} is not an image`,
            variant: 'destructive'
          });
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: 'File too large',
            description: `${file.name} is larger than 5MB`,
            variant: 'destructive'
          });
          return false;
        }
        return true;
      });

      console.log('Valid files to upload:', validFiles.length);

      if (validFiles.length === 0) {
        setIsUploading(false);
        return;
      }

      // Upload all images
      const uploadedUrls: string[] = [];
      
      for (const file of validFiles) {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        console.log('Uploading file:', fileName);

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({
            title: 'Upload failed',
            description: uploadError.message || 'Failed to upload image',
            variant: 'destructive'
          });
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        console.log('Uploaded successfully:', publicUrl);
        uploadedUrls.push(publicUrl);
      }

      if (uploadedUrls.length > 0) {
        // Update state with new images
        setFormData(prev => {
          const newUrls = [...prev.image_urls, ...uploadedUrls];
          console.log('Updated image_urls:', newUrls);
          return { ...prev, image_urls: newUrls };
        });
        
        setImagePreviews(prev => {
          const newPreviews = [...prev, ...uploadedUrls];
          console.log('Updated imagePreviews:', newPreviews);
          return newPreviews;
        });

        toast({
          title: 'Images uploaded!',
          description: `${uploadedUrls.length} image(s) ready`
        });
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload images',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      // Clear the input value so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [imagePreviews.length, toast]);

  const removeImage = useCallback((index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      image_urls: prev.image_urls.filter((_, i) => i !== index)
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading) {
      console.log('Already loading, preventing duplicate submission');
      return;
    }
    
    console.log('=== PRODUCT SUBMIT START ===');
    console.log('Form data:', formData);
    console.log('Image previews:', imagePreviews);
    
    // Validate required fields
    const missingFields: string[] = [];
    if (!formData.title?.trim()) missingFields.push('Title');
    if (!formData.price || parseFloat(formData.price) <= 0) missingFields.push('Price');
    if (!formData.category) missingFields.push('Category');
    
    if (missingFields.length > 0) {
      console.log('Validation failed - missing fields:', missingFields);
      toast({
        title: 'Missing fields',
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    console.log('Loading state set to true');

    try {
      // Get current session
      console.log('Getting session...');
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Initial session check:', { 
        hasSession: !!session, 
        userId: session?.user?.id, 
        error: sessionError?.message 
      });
      
      // If session error or no session, try to refresh
      if (sessionError || !session?.user) {
        console.log('Session issue, attempting refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session?.user) {
          console.error('Session refresh failed:', refreshError);
          toast({
            title: 'Session expired',
            description: 'Please log in again to add products',
            variant: 'destructive'
          });
          setIsLoading(false);
          return;
        }
        
        session = refreshData.session;
        console.log('Session refreshed successfully:', session.user.id);
      }

      const userId = session.user.id;
      console.log('Proceeding with user ID:', userId);

      // Prepare product data
      const priceValue = parseFloat(formData.price);
      const commissionValue = parseInt(formData.commission) || 10;
      
      // Use imagePreviews as fallback if formData.image_urls is empty
      const imageUrls = formData.image_urls.length > 0 ? formData.image_urls : imagePreviews;
      
      const productData = {
        vendor_id: userId,
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        price: Math.round(priceValue * 100),
        commission: commissionValue,
        category: formData.category,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        status: 'pending'
      };
      
      console.log('Inserting product with data:', JSON.stringify(productData));

      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      console.log('Insert response:', { success: !!data, error: error?.message });

      if (error) {
        console.error('Product insert failed:', error);
        throw new Error(error.message || 'Failed to create product');
      }

      console.log('=== PRODUCT CREATED SUCCESSFULLY ===', data.id);

      toast({
        title: 'Product added!',
        description: 'Your product is pending review'
      });

      // Close modal and notify parent
      onProductAdded();
      onClose();
    } catch (error: any) {
      console.error('=== PRODUCT SUBMIT ERROR ===', error);
      toast({
        title: 'Error adding product',
        description: error.message || 'Failed to add product. Please try again.',
        variant: 'destructive'
      });
    } finally {
      console.log('Setting loading to false');
      setIsLoading(false);
    }
  };

  const triggerFileInput = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Triggering file input');
    // Use setTimeout to ensure the event is properly handled on mobile
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-gradient-to-b from-card to-card/95">
        {/* Header with gradient accent */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="h-1 w-full bg-gradient-primary" />
          <div className="p-4 sm:p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Add New Product</h2>
              <p className="text-xs text-muted-foreground">Fill in the details to list your product</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
            capture={undefined}
          />

          {/* Image Upload Section */}
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
                <div 
                  key={`${preview}-${index}`} 
                  className="relative group aspect-square animate-in zoom-in-95 duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <img
                    src={preview}
                    alt={`Product preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-xl border-2 border-border group-hover:border-primary/50 transition-colors shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full shadow-lg opacity-0 group-hover:opacity-100 sm:opacity-100 transition-all duration-200 hover:scale-110 touch-manipulation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {index === 0 && (
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-gradient-primary text-primary-foreground text-xs font-medium rounded-full shadow-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Main
                    </span>
                  )}
                </div>
              ))}
              
              {imagePreviews.length < MAX_IMAGES && imagePreviews.length > 0 && (
                <button
                  type="button"
                  onClick={triggerFileInput}
                  disabled={isUploading}
                  className="aspect-square border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all duration-300 touch-manipulation active:scale-95 group"
                >
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-secondary/80 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">Add More</span>
                    </>
                  )}
                </button>
              )}
            </div>
            
            {imagePreviews.length === 0 && (
              <button
                type="button"
                onClick={triggerFileInput}
                disabled={isUploading}
                className="w-full h-36 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all duration-300 touch-manipulation active:scale-[0.98] group"
              >
                {isUploading ? (
                  <>
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 text-primary animate-spin" />
                    </div>
                    <span className="text-sm text-primary font-medium">Uploading...</span>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <ImagePlus className="w-7 h-7 text-primary" />
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        Tap to upload images
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB • Max {MAX_IMAGES} images</p>
                    </div>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground uppercase tracking-wider">Product Details</span>
            </div>
          </div>

          {/* Title Field */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              <Label htmlFor="title" className="text-sm font-semibold">Product Title</Label>
              <span className="text-destructive">*</span>
            </div>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Premium Wireless Headphones"
              className="bg-secondary/30 border-border focus:border-primary focus:ring-primary/20 h-11"
            />
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <Label htmlFor="description" className="text-sm font-semibold">Description</Label>
            </div>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your product features, benefits, and what makes it special..."
              className="bg-secondary/30 border-border focus:border-primary focus:ring-primary/20 min-h-[100px] resize-none"
            />
          </div>

          {/* Price & Commission Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-afrilink-green" />
                <Label htmlFor="price" className="text-sm font-semibold">Price</Label>
                <span className="text-destructive">*</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  id="price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  className="bg-secondary/30 border-border focus:border-afrilink-green focus:ring-afrilink-green/20 h-11 pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-afrilink-purple" />
                <Label htmlFor="commission" className="text-sm font-semibold">Commission</Label>
              </div>
              <div className="relative">
                <Input
                  id="commission"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="50"
                  value={formData.commission}
                  onChange={(e) => setFormData(prev => ({ ...prev, commission: e.target.value }))}
                  placeholder="10"
                  className="bg-secondary/30 border-border focus:border-afrilink-purple focus:ring-afrilink-purple/20 h-11 pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
              </div>
            </div>
          </div>

          {/* Category Field */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <Label htmlFor="category" className="text-sm font-semibold">Category</Label>
              <span className="text-destructive">*</span>
            </div>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger className="bg-secondary/30 border-border focus:border-primary focus:ring-primary/20 h-11">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat} className="focus:bg-primary/10 focus:text-foreground">
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex gap-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11 border-border hover:bg-secondary/50"
              disabled={isLoading || isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11 bg-gradient-primary hover:opacity-90 shadow-lg hover:shadow-glow transition-all duration-300 touch-manipulation"
              disabled={isLoading || isUploading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Add Product
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
