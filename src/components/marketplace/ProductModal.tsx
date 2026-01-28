import { Product } from '@/types';
import { formatCurrency } from '@/utils/currency';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  onBuy: () => void;
  onGrabLink: (productId: string) => void;
}

export const ProductModal = ({ product, onClose, onBuy, onGrabLink }: ProductModalProps) => {
  const earningEstimate = Math.round((product.price * product.commission) / 100);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-t-2xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-8 border border-border shadow-card animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={product.image} alt={product.title} className="w-full h-48 sm:h-64 object-cover rounded-lg sm:rounded-xl mb-4 sm:mb-6" />
        <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-4">{product.title}</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">{product.description}</p>
        <div className="space-y-2 mb-4 sm:mb-6">
          <div className="text-2xl sm:text-4xl font-bold text-foreground">{formatCurrency(product.price)}</div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-medium text-afrilink-green">{product.commission}% commission</span>
            <span>Earn {formatCurrency(earningEstimate)} per sale</span>
          </div>
        </div>
        <button
          onClick={() => onGrabLink(product.id)}
          className="w-full py-3 sm:py-4 bg-foreground text-background rounded-lg sm:rounded-xl font-bold text-base sm:text-lg hover:bg-foreground/90 transition-all duration-300 mb-2 sm:mb-3"
        >
          Grab Link
        </button>
        <button
          onClick={onBuy}
          className="w-full py-3 sm:py-4 bg-gradient-primary text-white rounded-lg sm:rounded-xl font-bold text-base sm:text-lg hover:shadow-glow transition-all duration-300 mb-2 sm:mb-3"
        >
          Buy Now
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 sm:py-3 bg-secondary text-secondary-foreground rounded-lg sm:rounded-xl font-semibold hover:bg-secondary/80 transition-all duration-300"
        >
          Close
        </button>
      </div>
    </div>
  );
};
