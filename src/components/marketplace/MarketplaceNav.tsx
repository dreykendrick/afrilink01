import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Search, Filter, ChevronDown, ArrowLeft } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MarketplaceNavProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  categories: string[];
  onCartClick: () => void;
  onLogin: () => void;
  onBack?: () => void;
  commissionFilter: string;
  setCommissionFilter: (value: string) => void;
  priceFilter: string;
  setPriceFilter: (value: string) => void;
}

export const MarketplaceNav = ({ 
  searchTerm, 
  setSearchTerm, 
  selectedCategory, 
  setSelectedCategory, 
  categories,
  onCartClick,
  onLogin,
  onBack,
  commissionFilter,
  setCommissionFilter,
  priceFilter,
  setPriceFilter
}: MarketplaceNavProps) => {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { totalItems } = useCart();

  const hasActiveFilters = commissionFilter !== 'all' || priceFilter !== 'all';

  return (
    <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                aria-label={t('common.back')}
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
            )}
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent whitespace-nowrap">
              {t('common.appName')}
            </h1>
          </div>
          
          <div className="hidden md:flex flex-1 max-w-xl relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder={t('marketplace.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`relative p-2 sm:p-3 rounded-xl transition-colors ${
                hasActiveFilters 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <Filter className="w-5 h-5" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-afrilink-green rounded-full" />
              )}
            </button>
            <button
              onClick={onCartClick}
              className="relative p-2 sm:p-3 bg-secondary hover:bg-secondary/80 rounded-xl transition-colors"
            >
              <ShoppingCart className="w-5 h-5 text-foreground" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="md:hidden mt-4 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <input
            type="text"
            placeholder={t('marketplace.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Filters Panel */}
        {filtersOpen && (
          <div className="mt-4 p-4 bg-card rounded-xl border border-border animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('product.commission')}</label>
                <Select value={commissionFilter} onValueChange={setCommissionFilter}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={t('marketplace.allCategories')} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">{t('marketplace.allCategories')}</SelectItem>
                    <SelectItem value="5+">5%+</SelectItem>
                    <SelectItem value="10+">10%+</SelectItem>
                    <SelectItem value="15+">15%+</SelectItem>
                    <SelectItem value="20+">20%+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('marketplace.filters.priceRange')}</label>
                <Select value={priceFilter} onValueChange={setPriceFilter}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={t('marketplace.allCategories')} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">{t('marketplace.allCategories')}</SelectItem>
                    <SelectItem value="0-50000">Under 50,000 Tsh</SelectItem>
                    <SelectItem value="50000-100000">50,000 - 100,000 Tsh</SelectItem>
                    <SelectItem value="100000-500000">100,000 - 500,000 Tsh</SelectItem>
                    <SelectItem value="500000+">500,000+ Tsh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setCommissionFilter('all');
                  setPriceFilter('all');
                }}
                className="mt-3 text-xs text-primary hover:underline"
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
        )}

        {/* Categories */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? 'bg-gradient-primary text-white shadow-glow'
                  : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};
