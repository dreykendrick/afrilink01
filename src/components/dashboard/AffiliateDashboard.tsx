import { useState } from 'react';
import { DollarSign, Eye, CheckCircle, TrendingUp, Link2, Images } from 'lucide-react';
import { User, Product, AffiliateStats } from '@/types';
import { formatCurrency } from '@/utils/currency';
import { StatsCard } from './StatsCard';
import { ProductImagesModal } from './ProductImagesModal';

interface AffiliateDashboardProps {
  currentUser: User;
  products: Product[];
  stats: AffiliateStats;
  onGenerateLink: (productId: string) => void;
  onVerify: () => void;
}

export const AffiliateDashboard = ({ currentUser, products, stats, onGenerateLink, onVerify }: AffiliateDashboardProps) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  return (
    <>
      <div className="mb-6 sm:mb-8 animate-in fade-in slide-in-from-top-3 duration-500">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome back, {currentUser.name}!</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Here's your affiliate dashboard overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <StatsCard icon={DollarSign} value={formatCurrency(stats.commission)} label="Total Commission" gradient="from-afrilink-green to-emerald-600" />
        <StatsCard icon={Eye} value={stats.clicks} label="Total Clicks" gradient="from-afrilink-blue to-cyan-600" />
        <StatsCard icon={CheckCircle} value={stats.conversions} label="Conversions" gradient="from-afrilink-purple to-afrilink-pink" />
        <StatsCard icon={TrendingUp} value={`${stats.rate}%`} label="Conversion Rate" gradient="from-afrilink-amber to-afrilink-orange" />
      </div>

      <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-card mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6">Products to Promote</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="bg-secondary/50 rounded-lg sm:rounded-xl overflow-hidden border border-border hover:border-primary transition-all duration-300 hover:scale-105 animate-in fade-in zoom-in-95 duration-500"
              style={{ animationDelay: `${300 + index * 100}ms` }}
            >
              <div 
                className="relative cursor-pointer group"
                onClick={() => setSelectedProduct(product)}
              >
                <img src={product.image} alt={product.title} className="w-full h-28 sm:h-32 object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium flex items-center gap-1">
                    <Images className="w-4 h-4" />
                    View Images
                  </div>
                </div>
                {product.imageCount && product.imageCount > 1 && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full">
                    <Images className="w-3 h-3 text-white" />
                    <span className="text-xs text-white font-medium">{product.imageCount}</span>
                  </div>
                )}
              </div>
              <div className="p-3 sm:p-4">
                <h3 className="font-bold text-foreground mb-2 text-sm sm:text-base">{product.title}</h3>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-base sm:text-lg font-bold text-foreground">{formatCurrency(product.price)}</span>
                  <span className="text-xs sm:text-sm text-afrilink-green font-semibold">
                    Earn {formatCurrency((product.price * product.commission) / 100)}
                  </span>
                </div>
                <button
                  onClick={() => onGenerateLink(product.id)}
                  className="w-full py-2 bg-gradient-primary text-white rounded-lg font-semibold flex items-center justify-center space-x-2 hover:shadow-glow transition-all duration-300 text-sm sm:text-base"
                >
                  <Link2 className="w-4 h-4" />
                  <span>Generate Link</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Images Modal */}
      {selectedProduct && (
        <ProductImagesModal
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
};
