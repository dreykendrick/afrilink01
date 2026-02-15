import { ShoppingCart } from 'lucide-react';
import { Product } from '@/types';
import { formatCurrency } from '@/utils/currency';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => void;
  onGrabLink: (productId: string) => void;
  onClick: (product: Product) => void;
  index: number;
}

export const ProductCard = ({ product, onAddToCart, onGrabLink, onClick, index }: ProductCardProps) => {
  const earningEstimate = Math.round((product.price * product.commission) / 100);

  return (
    <div
      className="bg-card rounded-xl sm:rounded-2xl overflow-hidden border border-border hover:border-primary transition-all duration-300 cursor-pointer active:scale-[0.98] sm:hover:scale-105 shadow-card animate-in fade-in zoom-in-95 duration-500 touch-manipulation"
      onClick={() => onClick(product)}
      style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
    >
      {/* Mobile-optimized image with aspect ratio */}
      <div className="relative aspect-square sm:aspect-[4/3]">
        <img 
          src={product.image} 
          alt={product.title} 
          className="w-full h-full object-cover" 
          loading="lazy"
        />
        {/* Badge overlay for mobile */}
        <div className="absolute top-2 left-2 sm:hidden">
          <span className="text-[10px] bg-primary/90 text-primary-foreground px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
            {product.category}
          </span>
        </div>
        {/* Commission badge */}
        <div className="absolute bottom-2 right-2">
          <span className="text-[10px] sm:text-xs bg-afrilink-green/90 text-white px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
            {product.commission}%
          </span>
        </div>
      </div>

      {/* Content - more compact on mobile */}
      <div className="p-3 sm:p-6">
        {/* Category - hidden on mobile as it's shown as badge */}
        <div className="hidden sm:block text-xs text-primary font-semibold mb-2">
          {product.category}
        </div>
        
        {/* Title */}
        <h3 className="text-sm sm:text-lg font-bold text-foreground mb-1 sm:mb-2 line-clamp-2">
          {product.title}
        </h3>
        
        {/* Description - hidden on mobile for compact view */}
        <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
          {product.description}
        </p>

        {/* Price and sales */}
        <div className="flex justify-between items-center mb-1 sm:mb-2">
          <span className="text-sm sm:text-xl font-semibold text-muted-foreground">
            {formatCurrency(product.price)}
          </span>
          <span className="text-[10px] sm:text-sm text-muted-foreground">
            {product.sales} sold
          </span>
        </div>

        {/* Earnings estimate - compact on mobile */}
        <div className="flex items-center justify-between text-[10px] sm:text-sm text-muted-foreground mb-2 sm:mb-3">
          <span className="font-medium text-afrilink-green">
            Earn {formatCurrency(earningEstimate)}
          </span>
        </div>

        {/* Buttons - stacked on mobile, side by side icons for quick actions */}
        <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product.id);
            }}
            className="w-full py-2 sm:py-3 bg-gradient-primary text-white rounded-lg font-semibold hover:shadow-glow transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 text-xs sm:text-base touch-manipulation active:scale-95"
          >
            <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Add to Cart</span>
            <span className="sm:hidden">Cart</span>
          </button>
        </div>
      </div>
    </div>
  );
};
