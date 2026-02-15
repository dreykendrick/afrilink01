import { useState } from 'react';
import { X, Download, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { Product } from '@/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ProductImagesModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Downloads an image using canvas to avoid CORS and Android WebView issues.
 * Falls back to opening in a new tab if canvas approach fails.
 */
const downloadImage = async (imageUrl: string, filename: string): Promise<void> => {
  try {
    // Method 1: Use an Image + Canvas to bypass CORS (works in Android WebView)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No canvas context');
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            
            // Cleanup after a delay
            setTimeout(() => {
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }, 100);
            resolve();
          }, 'image/jpeg', 0.95);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = imageUrl;
    });
  } catch {
    // Method 2: Try fetch with blob
    try {
      const response = await fetch(imageUrl, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
        return;
      }
    } catch {
      // Fall through
    }
    
    // Method 3: Open in new tab as last resort
    window.open(imageUrl, '_blank');
  }
};

export const ProductImagesModal = ({ product, isOpen, onClose }: ProductImagesModalProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [downloading, setDownloading] = useState<number | null>(null);

  const allImages = product.images && product.images.length > 0 
    ? product.images 
    : [product.image];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const handleDownload = async (imageUrl: string, index: number) => {
    setDownloading(index);
    try {
      const urlParts = imageUrl.split('/');
      const filename = urlParts[urlParts.length - 1].split('?')[0] || `${product.title}-image-${index + 1}.jpg`;
      await downloadImage(imageUrl, filename);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(imageUrl, '_blank');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < allImages.length; i++) {
      await handleDownload(allImages[i], i);
      if (i < allImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 bg-card border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Images className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-bold text-foreground">{product.title}</h2>
              <p className="text-sm text-muted-foreground">{allImages.length} image{allImages.length > 1 ? 's' : ''} available</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {allImages.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAll}
                className="hidden sm:flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download All
              </Button>
            )}
          </div>
        </div>

        {/* Main Image */}
        <div className="relative bg-secondary/50">
          <div className="aspect-video flex items-center justify-center p-4">
            <img
              src={allImages[currentIndex]}
              alt={`${product.title} - Image ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>

          {allImages.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors touch-manipulation"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors touch-manipulation"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {allImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full text-white text-sm">
              {currentIndex + 1} / {allImages.length}
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {allImages.length > 1 && (
          <div className="p-4 border-t border-border">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {allImages.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all touch-manipulation ${
                    index === currentIndex 
                      ? 'border-primary ring-2 ring-primary/30' 
                      : 'border-transparent hover:border-border'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => handleDownload(allImages[currentIndex], currentIndex)}
            disabled={downloading === currentIndex}
            className="flex-1 bg-gradient-primary hover:shadow-glow"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloading === currentIndex ? 'Downloading...' : 'Download Current Image'}
          </Button>
          {allImages.length > 1 && (
            <Button
              variant="outline"
              onClick={handleDownloadAll}
              className="flex-1 sm:hidden"
            >
              <Download className="w-4 h-4 mr-2" />
              Download All ({allImages.length})
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
