import { useState, useEffect, useCallback } from 'react';
import { LandingPage } from '@/components/landing/LandingPage';
import { LoginPage } from '@/components/auth/LoginPage';
import { SignupPage } from '@/components/auth/SignupPage';
import { ForgotPasswordPage } from '@/components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/components/auth/ResetPasswordPage';
import { VerificationForm } from '@/components/auth/VerificationForm';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { VendorDashboard } from '@/components/dashboard/VendorDashboard';
import { AffiliateDashboard } from '@/components/dashboard/AffiliateDashboard';
import { SettingsPage } from '@/components/dashboard/SettingsPage';
import { VerificationManagePage } from '@/components/dashboard/VerificationManagePage';
import { HelpSupportPage } from '@/components/dashboard/HelpSupportPage';
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { ProductModal } from '@/components/marketplace/ProductModal';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CheckoutModal } from '@/components/cart/CheckoutModal';
import { Notification } from '@/components/Notification';
import { OnboardingCarousel } from '@/components/onboarding/OnboardingCarousel';
import { RoleSelection } from '@/components/onboarding/RoleSelection';
import { RegistrationFlow } from '@/components/onboarding/RegistrationFlow';
import { VendorProfileSetup } from '@/components/onboarding/VendorProfileSetup';
import { AffiliateProfileSetup } from '@/components/onboarding/AffiliateProfileSetup';
import { PhoneVerificationFlow } from '@/components/onboarding/PhoneVerificationFlow';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { InstallPrompt } from '@/components/mobile/InstallPrompt';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/integrations/supabase/client';
import { User, Product, VendorStats, AffiliateStats } from '@/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getProductSlug } from '@/utils/slug';

type View =
  | 'landing'
  | 'login'
  | 'signup'
  | 'forgot-password'
  | 'reset-password'
  | 'verification'
  | 'dashboard'
  | 'marketplace'
  | 'settings'
  | 'verification-manage'
  | 'help-support'
  | 'onboarding'
  | 'role-selection'
  | 'onboarding-register'
  | 'vendor-profile-setup'
  | 'affiliate-profile-setup'
  | 'phone-verification';

// Bug Fix C: Helper to read view from URL
const getViewFromUrl = (): { view: View | null; role: 'vendor' | 'affiliate' | null } => {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  const roleParam = params.get('role');
  const validViews: View[] = [
    'landing', 'login', 'signup', 'forgot-password', 'reset-password', 'verification',
    'dashboard', 'marketplace', 'settings', 'verification-manage', 'help-support',
    'onboarding', 'role-selection', 'onboarding-register', 'vendor-profile-setup',
    'affiliate-profile-setup', 'phone-verification'
  ];
  const view = validViews.includes(viewParam as View) ? (viewParam as View) : null;
  const role = roleParam === 'vendor' || roleParam === 'affiliate' ? roleParam : null;
  return { view, role };
};

// Bug Fix C: Helper to update URL without navigation
const updateUrlView = (view: View, role?: 'vendor' | 'affiliate' | null) => {
  const params = new URLSearchParams(window.location.search);
  params.set('view', view);
  if (role) {
    params.set('role', role);
  } else {
    params.delete('role');
  }
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
};

const IndexContent = () => {
  const { user, loading: authLoading, userRole, signOut, availableRoles, switchRole, addRole, refreshRoles } = useAuth();
  const { addToCart, setAffiliateCode } = useCart();
  // Bug Fix C: Initialize view from URL or default
  const [view, setViewState] = useState<View>(() => {
    const urlState = getViewFromUrl();
    return urlState.view || 'landing';
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [onboardingRole, setOnboardingRole] = useState<'vendor' | 'affiliate' | null>(() => {
    const urlState = getViewFromUrl();
    return urlState.role;
  });
  const [postGrabProductId, setPostGrabProductId] = useState<string | null>(null);

  // Bug Fix C: Wrapper to update view and URL together
  const setView = useCallback((newView: View, role?: 'vendor' | 'affiliate' | null) => {
    setViewState(newView);
    updateUrlView(newView, role);
  }, []);
  
  // Marketplace filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [commissionFilter, setCommissionFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  
  // Real data states
  const [products, setProducts] = useState<Product[]>([]); // Vendor's own products
  const [marketplaceProducts, setMarketplaceProducts] = useState<Product[]>([]); // Marketplace products (all approved)
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [profile, setProfile] = useState<{ full_name: string; wallet_balance: number; verification_photo_url: string | null; verification_status: string | null; phone_verified: boolean | null } | null>(null);
  const [roleAvatarUrl, setRoleAvatarUrl] = useState<string | null>(null);
  const [vendorStats, setVendorStats] = useState<VendorStats>({ revenue: 0, sales: 0, products: 0, pending: 0 });
  const [affiliateStats, setAffiliateStats] = useState<AffiliateStats>({ commission: 0, clicks: 0, conversions: 0, rate: 0 });
  const [affiliateLinks, setAffiliateLinks] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Mobile-optimized refresh handler
  const handleRefresh = useCallback(async () => {
    await fetchUserData();
  }, []);

  const handleMarketplaceRefresh = useCallback(async () => {
    await fetchMarketplaceProducts();
  }, []);

  const getMobileActiveTab = useCallback((): 'dashboard' | 'marketplace' | 'settings' | 'help' | 'profile' => {
    switch (view) {
      case 'marketplace': return 'marketplace';
      case 'settings': return 'settings';
      case 'help-support': return 'help';
      case 'verification-manage': return 'profile';
      default: return 'dashboard';
    }
  }, [view]);

  // Check for affiliate code and password reset in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    
    // Check if this is a password reset redirect
    if (window.location.pathname === '/reset-password') {
      setView('reset-password');
      return;
    }
    
    if (ref) {
      setAffiliateCode(ref);
      // Track click
      supabase
        .from('affiliate_links')
        .select('id, clicks')
        .eq('code', ref)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            supabase
              .from('affiliate_links')
              .update({ clicks: (data.clicks || 0) + 1 })
              .eq('id', data.id);
          }
        });
    }
  }, []);

  // Bug Fix C: Only set default view if URL doesn't specify one
  useEffect(() => {
    const urlState = getViewFromUrl();
    if (urlState.view) {
      // URL has view state, respect it
      return;
    }
    const hasSeenOnboarding = localStorage.getItem('afrilink_onboarding_seen');
    if (!user) {
      if (!hasSeenOnboarding) {
        setView('onboarding');
      } else {
        setView('role-selection');
      }
    }
  }, [user, setView]);

  // Redirect to dashboard if logged in
  useEffect(() => {
    if (user && userRole && view !== 'verification') {
      handlePostLogin();
    }
  }, [user, userRole]);

  // Fetch marketplace products for landing page and marketplace view
  useEffect(() => {
    if (view === 'landing' || view === 'marketplace') {
      fetchMarketplaceProducts();
    }
  }, [view]);

  const handlePostLogin = async () => {
    await fetchUserData();
  };

  const fetchUserData = async () => {
    if (!user) return;
    
    setDataLoading(true);
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, wallet_balance, verification_photo_url, verification_status, phone_verified')
        .eq('id', user.id)
        .single();
      
      if (profileData) {
        setProfile(profileData);
      }

      if (!profileData?.phone_verified) {
        setView('phone-verification');
        return;
      }

      if (userRole === 'vendor') {
        if (postGrabProductId) {
          setPostGrabProductId(null);
        }
        const { data: vendorProfile } = await (supabase
          .from('vendor_profiles' as any)
          .select('business_name, city, vendor_type, pickup_location, logo_url')
          .eq('user_id', user.id)
          .maybeSingle() as unknown as Promise<{ data: any; error: any }>);

        const vendorProfileComplete = Boolean(
          vendorProfile?.business_name &&
            vendorProfile?.city &&
            vendorProfile?.vendor_type &&
            vendorProfile?.pickup_location &&
            vendorProfile?.logo_url,
        );

        if (vendorProfile?.logo_url) {
          setRoleAvatarUrl(vendorProfile.logo_url);
        }

        if (!vendorProfileComplete) {
          setView('vendor-profile-setup');
          return;
        }

        const { data: vendorProducts } = await supabase
          .from('products')
          .select('*')
          .eq('vendor_id', user.id);

        if (vendorProducts) {
          setRawProducts(vendorProducts);
          const formattedProducts: Product[] = vendorProducts.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description || '',
            price: p.price,
            commission: p.commission,
            category: p.category,
            image: p.image_url || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80',
            images: p.image_urls || [],
            imageCount: p.image_urls?.length || (p.image_url ? 1 : 0),
            status: p.status as 'approved' | 'pending' | 'rejected' | 'pending_takedown' | 'taken_down',
            sales: p.sales,
            isAvailable: (p as any).is_available !== false,
          }));
          setProducts(formattedProducts);

          const totalSales = vendorProducts.reduce((sum, p) => sum + p.sales, 0);
          const totalRevenue = vendorProducts.reduce((sum, p) => sum + (p.sales * p.price), 0);
          const pendingCount = vendorProducts.filter(p => p.status === 'pending').length;
          
          setVendorStats({
            revenue: totalRevenue,
            sales: totalSales,
            products: vendorProducts.filter(p => p.status === 'approved').length,
            pending: pendingCount,
          });
        }
      } else {
        const { data: affiliateProfile } = await (supabase
          .from('affiliate_profiles' as any)
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle() as unknown as Promise<{ data: any; error: any }>);

        const affiliateProfileComplete = Boolean(affiliateProfile?.display_name && affiliateProfile?.avatar_url);

        if (affiliateProfile?.avatar_url) {
          setRoleAvatarUrl(affiliateProfile.avatar_url);
        }

        if (!affiliateProfileComplete) {
          setView('affiliate-profile-setup');
          return;
        }

        if (postGrabProductId) {
          const marketplaceProducts = await fetchMarketplaceProducts();
          await handleGenerateLink(postGrabProductId);
          const targetProduct = marketplaceProducts.find((product) => product.id === postGrabProductId);
          if (targetProduct) {
            setSelectedProduct(targetProduct);
          }
          setPostGrabProductId(null);
          setView('marketplace');
          return;
        }

        const { data: approvedProducts } = await supabase
          .from('products')
          .select('*')
          .eq('status', 'approved');

        if (approvedProducts) {
          const formattedProducts: Product[] = approvedProducts.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description || '',
            price: p.price,
            commission: p.commission,
            category: p.category,
            image: p.image_url || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80',
            images: p.image_urls || [],
            imageCount: p.image_urls?.length || (p.image_url ? 1 : 0),
            status: p.status as 'approved' | 'pending' | 'rejected' | 'pending_takedown' | 'taken_down',
            sales: p.sales,
            isAvailable: (p as any).is_available !== false,
          }));
          setMarketplaceProducts(formattedProducts);
        }

        // Fetch affiliate links and stats
        const { data: links } = await supabase
          .from('affiliate_links')
          .select('*')
          .eq('affiliate_id', user.id);

        if (links) {
          setAffiliateLinks(links);
          const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
          const totalConversions = links.reduce((sum, l) => sum + (l.conversions || 0), 0);
          const totalCommission = links.reduce((sum, l) => sum + (l.commission_earned || 0), 0);
          
          setAffiliateStats({
            commission: totalCommission,
            clicks: totalClicks,
            conversions: totalConversions,
            rate: totalClicks > 0 ? Math.round((totalConversions / totalClicks) * 100) : 0,
          });
        }
      }

      const blockAutoRedirect = ['marketplace', 'affiliate-profile-setup', 'vendor-profile-setup', 'phone-verification'].includes(view);
      if (!blockAutoRedirect) {
        setView('dashboard');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchMarketplaceProducts = async (): Promise<Product[]> => {
    try {
      const { data: approvedProducts } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'approved');

      if (approvedProducts) {
        const formattedProducts: Product[] = approvedProducts.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          price: p.price,
          commission: p.commission,
          category: p.category,
          image: p.image_url || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80',
          images: p.image_urls || [],
          imageCount: p.image_urls?.length || (p.image_url ? 1 : 0),
          status: p.status as 'approved' | 'pending' | 'rejected' | 'pending_takedown' | 'taken_down',
          sales: p.sales,
          isAvailable: (p as any).is_available !== false,
        }));
        setMarketplaceProducts(formattedProducts);
        return formattedProducts;
      }
    } catch (error) {
      console.error('Error fetching marketplace products:', error);
    }
    return [];
  };

  const showNotification = (message: string) => {
    setNotification(message);
  };

  const handleLogout = async () => {
    await signOut();
    setView('landing');
    setProfile(null);
    setProducts([]);
    setMarketplaceProducts([]);
    setRoleAvatarUrl(null);
    showNotification('Logged out successfully');
  };

  const handleSwitchRole = async (newRole: 'vendor' | 'affiliate') => {
    const success = await switchRole(newRole);
    if (success) {
      toast.success(`Switched to ${newRole} mode`);
      // Reload data for the new role
      await fetchUserData();
    } else {
      toast.error('Failed to switch role');
    }
  };

  const handleAddRole = async (newRole: 'vendor' | 'affiliate') => {
    const success = await addRole(newRole);
    if (success) {
      toast.success(`${newRole} role added! Complete your profile setup.`);
      // This will trigger profile setup for the new role
      await fetchUserData();
    } else {
      toast.error('Failed to add role');
    }
  };

  const handleGenerateLink = async (productId: string) => {
    if (!user) return;
    
    // Find the raw product by ID
    const rawProduct = rawProducts.find(p => p.id === productId);
    if (!rawProduct) {
      toast.error('Product not found');
      return;
    }

    // Check if link already exists
    const existingLink = affiliateLinks.find(l => l.product_id === rawProduct.id);
    if (existingLink) {
      const slug = getProductSlug(rawProduct.title, rawProduct.id);
      const link = `${window.location.origin}/p/${slug}?ref=${existingLink.code}`;
      navigator.clipboard.writeText(link);
      toast.success('Affiliate link copied to clipboard!');
      return;
    }

    // Generate unique code
    const code = `${user.id.substring(0, 6)}_${rawProduct.id.substring(0, 6)}_${Date.now().toString(36)}`;

    try {
      const { data, error } = await supabase
        .from('affiliate_links')
        .insert({
          affiliate_id: user.id,
          product_id: rawProduct.id,
          code: code,
        })
        .select()
        .single();

      if (error) throw error;

      setAffiliateLinks(prev => [...prev, data]);
      const slug = getProductSlug(rawProduct.title, rawProduct.id);
      const link = `${window.location.origin}/p/${slug}?ref=${code}`;
      navigator.clipboard.writeText(link);
      toast.success('Affiliate link generated and copied!');
    } catch (error: any) {
      console.error('Error generating link:', error);
      toast.error(error.message || 'Failed to generate link');
    }
  };

  const handleGrabLink = async (productId: string) => {
    if (!user) {
      setPostGrabProductId(productId);
      setView('login');
      return;
    }

    if (userRole !== 'affiliate') {
      toast.error('Grab Link is available for affiliate accounts only.');
      return;
    }

    await handleGenerateLink(productId);
  };

  const handleAddToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    const rawProduct = rawProducts.find(p => p.id === productId);
    
      if (product && rawProduct) {
        addToCart({
          id: rawProduct.id,
          title: product.title,
          price: product.price,
          image: product.image,
          commission: product.commission,
          vendorId: rawProduct.vendor_id,
          freeDelivery: Boolean(rawProduct.free_delivery),
        });
        toast.success('Added to cart!');
      }
    };

  const handleBuyProduct = () => {
    if (selectedProduct) {
      const rawProduct = rawProducts.find(p => p.id === selectedProduct.id);
      if (rawProduct) {
        addToCart({
          id: rawProduct.id,
          title: selectedProduct.title,
          price: selectedProduct.price,
          image: selectedProduct.image,
          commission: selectedProduct.commission,
          vendorId: rawProduct.vendor_id,
          freeDelivery: Boolean(rawProduct.free_delivery),
        });
      }
    }
    setSelectedProduct(null);
    setCartOpen(true);
  };

  const handleNavigate = (newView: string) => {
    if (newView === 'marketplace') {
      fetchMarketplaceProducts();
    }
    setView(newView as View);
  };

  const currentUser: User | null = user && profile ? {
    id: user.id,
    name: profile.full_name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    role: userRole || 'vendor',
    wallet: profile.wallet_balance || 0,
    verified: profile.verification_status === 'verified',
    avatarUrl: roleAvatarUrl || (profile.verification_status === 'verified' ? profile.verification_photo_url || undefined : undefined),
  } : null;

  // Get categories from products
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  // Filter marketplace products for display
  const filteredProducts = marketplaceProducts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    
    // Commission filter
    let matchesCommission = true;
    if (commissionFilter === '5+') matchesCommission = p.commission >= 5;
    else if (commissionFilter === '10+') matchesCommission = p.commission >= 10;
    else if (commissionFilter === '15+') matchesCommission = p.commission >= 15;
    else if (commissionFilter === '20+') matchesCommission = p.commission >= 20;
    
    // Price filter
    let matchesPrice = true;
    if (priceFilter === '0-50000') matchesPrice = p.price < 50000;
    else if (priceFilter === '50000-100000') matchesPrice = p.price >= 50000 && p.price <= 100000;
    else if (priceFilter === '100000-500000') matchesPrice = p.price > 100000 && p.price <= 500000;
    else if (priceFilter === '500000+') matchesPrice = p.price > 500000;
    
    return matchesSearch && matchesCategory && matchesCommission && matchesPrice;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (view === 'landing') {
    return (
      <>
        <LandingPage products={marketplaceProducts} onNavigate={handleNavigate} onLogin={() => handleNavigate('login')} />
        {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      </>
    );
  }

  if (view === 'onboarding') {
    return (
      <OnboardingCarousel
        onComplete={() => {
          localStorage.setItem('afrilink_onboarding_seen', 'true');
          setView('role-selection');
        }}
      />
    );
  }

  if (view === 'role-selection') {
    return (
      <RoleSelection
        onSelect={(role) => {
          if (role === 'browse') {
            handleNavigate('marketplace');
            return;
          }
          setOnboardingRole(role);
          setView('onboarding-register', role); // Bug Fix C: pass role to URL
        }}
        onLogin={() => setView('login')}
      />
    );
  }

  if (view === 'onboarding-register') {
    if (!onboardingRole) {
      setView('role-selection');
      return null;
    }

    return (
      <RegistrationFlow
        role={onboardingRole}
        onBack={() => setView('role-selection')}
        onComplete={async (_userId, role) => {
          await fetchUserData();

          if (role === 'vendor') {
            setView('vendor-profile-setup');
            return;
          }

          setView('affiliate-profile-setup');

          if (postGrabProductId) {
            await handleGenerateLink(postGrabProductId);
            const targetProduct = products.find((product) => product.id === postGrabProductId);
            if (targetProduct) {
              setSelectedProduct(targetProduct);
            }
            setPostGrabProductId(null);
          }
        }}
      />
    );
  }

  if (view === 'vendor-profile-setup') {
    if (!user) {
      setView('login');
      return null;
    }

    return (
      <VendorProfileSetup
        userId={user.id}
        onComplete={() => {
          showNotification('Vendor profile completed!');
          fetchUserData();
          setView('dashboard');
        }}
      />
    );
  }

  if (view === 'affiliate-profile-setup') {
    if (!user) {
      setView('login');
      return null;
    }

    return (
      <AffiliateProfileSetup
        userId={user.id}
        onComplete={() => {
          showNotification('Affiliate profile completed!');
          fetchUserData();
          setView('marketplace');
        }}
      />
    );
  }

  if (view === 'phone-verification') {
    if (!user) {
      setView('login');
      return null;
    }

    return (
      <PhoneVerificationFlow
        userId={user.id}
        onComplete={() => {
          showNotification('Phone verification complete!');
          fetchUserData();
        }}
      />
    );
  }

  if (view === 'login') {
    return (
      <>
        <LoginPage onNavigate={handleNavigate} />
        {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      </>
    );
  }

  if (view === 'signup') {
    return (
      <>
        <SignupPage
          onNavigate={handleNavigate}
          onSignupSuccess={(userId) => {
            setPendingUserId(userId);
            setView('verification');
          }}
        />
        {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      </>
    );
  }

  if (view === 'forgot-password') {
    return (
      <>
        <ForgotPasswordPage onNavigate={handleNavigate} />
        {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      </>
    );
  }

  if (view === 'reset-password') {
    return (
      <>
        <ResetPasswordPage onNavigate={handleNavigate} />
        {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      </>
    );
  }

  if (view === 'verification') {
    const userId = pendingUserId || user?.id;
    if (!userId) {
      setView('login');
      return null;
    }

    return (
      <>
        <VerificationForm
          userId={userId}
          onComplete={() => {
            if (user) {
              showNotification('Verification submitted! Awaiting admin approval.');
              setView('dashboard');
              fetchUserData();
            } else {
              showNotification('Verification submitted! Please log in. An admin will review your documents.');
              setView('login');
              setPendingUserId(null);
            }
          }}
        />
        {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      </>
    );
  }

  if (view === 'settings' && currentUser) {
    return (
      <SettingsPage 
        currentUser={currentUser} 
        onBack={() => setView('dashboard')}
        onRefresh={fetchUserData}
      />
    );
  }

  if (view === 'verification-manage' && currentUser) {
    return (
      <VerificationManagePage 
        currentUser={currentUser} 
        onBack={() => setView('dashboard')}
        onRefresh={fetchUserData}
      />
    );
  }

  if (view === 'help-support' && currentUser) {
    return (
      <HelpSupportPage 
        currentUser={currentUser} 
        onBack={() => setView('dashboard')}
      />
    );
  }


  if (view === 'dashboard' && currentUser) {
    return (
      <div className="min-h-screen bg-background pb-mobile-nav sm:pb-0">
        <DashboardNav 
          currentUser={currentUser} 
          onLogout={handleLogout}
          onNavigateToSettings={() => setView('settings')}
          onNavigateToVerification={() => setView('verification-manage')}
          onNavigateToMarketplace={() => handleNavigate('marketplace')}
          onNavigateToHelp={() => setView('help-support')}
          onWalletUpdate={fetchUserData}
          availableRoles={availableRoles}
          onSwitchRole={handleSwitchRole}
          onAddRole={handleAddRole}
        />
        <PullToRefresh onRefresh={handleRefresh} disabled={dataLoading}>
          <div className="p-4 sm:p-6 lg:p-8">
            {dataLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : userRole === 'vendor' ? (
              <VendorDashboard
                currentUser={currentUser}
                products={products}
                stats={vendorStats}
                onVerify={() => setView('verification')}
                onProductAdded={fetchUserData}
              />
            ) : (
              <AffiliateDashboard
                currentUser={currentUser}
                products={marketplaceProducts}
                stats={affiliateStats}
                onGenerateLink={handleGenerateLink}
                onVerify={() => setView('verification')}
              />
            )}
          </div>
        </PullToRefresh>
        <MobileBottomNav 
          activeTab={getMobileActiveTab()}
          onNavigate={handleNavigate}
          userRole={userRole || 'vendor'}
        />
        <InstallPrompt />
        {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      </div>
    );
  }

  if (view === 'marketplace') {
    return (
      <div className="min-h-screen bg-background pb-mobile-nav sm:pb-0">
        <MarketplaceNav
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          onCartClick={() => setCartOpen(true)}
          onLogin={() => handleNavigate('login')}
          commissionFilter={commissionFilter}
          setCommissionFilter={setCommissionFilter}
          priceFilter={priceFilter}
          setPriceFilter={setPriceFilter}
        />
        <PullToRefresh onRefresh={handleMarketplaceRefresh} disabled={dataLoading}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                {filteredProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    onGrabLink={handleGrabLink}
                    onClick={setSelectedProduct}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        </PullToRefresh>
        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onBuy={handleBuyProduct}
            onGrabLink={handleGrabLink}
          />
        )}
        <CartDrawer
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
        <CheckoutModal
          isOpen={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => {
            toast.success('Order placed successfully!');
          }}
        />
        {currentUser && (
          <MobileBottomNav 
            activeTab="marketplace"
            onNavigate={handleNavigate}
            userRole={userRole || 'vendor'}
          />
        )}
        <InstallPrompt />
        {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      </div>
    );
  }

  return null;
};

const Index = () => {
  return <IndexContent />;
};

export default Index;
