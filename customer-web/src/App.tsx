import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ToastProvider } from './context/ToastContext';

// Desktop / Responsive Shell Components
import { CustomerHeader } from './components/customer/CustomerHeader';
import { CustomerFooter } from './components/customer/CustomerFooter';
import { CartDrawer } from './components/customer/CartDrawer';

// Desktop / Responsive Pages
import { HomePage } from './pages/customer/HomePage';
import { ShopPage } from './pages/customer/ShopPage';
import { ProductDetailPage } from './pages/customer/ProductDetailPage';
import { CheckoutPage } from './pages/customer/CheckoutPage';
import { TrackOrderPage } from './pages/customer/TrackOrderPage';
import { AccountPage } from './pages/customer/AccountPage';
import { AboutUsPage, ContactUsPage, PolicyPage } from './pages/customer/StaticPages';

// Mobile Dedicated Navigation Shell
import { MobileTopBar } from './components/mobile/MobileTopBar';
import { MobileBottomNav } from './components/mobile/MobileBottomNav';
import { MobileSideDrawer } from './components/mobile/MobileSideDrawer';
import { MobileSearchModal } from './components/mobile/MobileSearchModal';
import { MobileFiltersModal } from './components/mobile/MobileFiltersModal';
import { MobileNotificationsModal } from './components/mobile/MobileNotificationsModal';

// Mobile Dedicated Screens (matching 16 Screens specification)
import { Screen1Home, Screen2Category } from './components/mobile/Screen1HomeAndCategory';
import { Screen3ProductDetail, Screen4Cart } from './components/mobile/Screen3ProductDetailAndCart';
import { Screen5Checkout, Screen6OrderPlaced, Screen7OrderTracking } from './components/mobile/Screen5CheckoutAndOrderFlow';
import {
  Screen8Account,
  Screen9AboutUs,
  Screen10ContactUs,
  Screen13Wishlist,
  Screen14CategoryMenu
} from './components/mobile/Screen8AccountAndStaticScreens';

function CustomerAppRoot() {
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [pageParams, setPageParams] = useState<any>({});

  // Mobile modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Responsive state detection
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navigate = (page: string, params: any = {}) => {
    setIsDrawerOpen(false);
    setIsSearchOpen(false);
    setIsFilterOpen(false);
    setIsNotificationsOpen(false);
    setCurrentPage(page);
    setPageParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getBottomNavTab = (): 'home' | 'categories' | 'orders' | 'account' => {
    if (currentPage === 'category' || currentPage === 'category-menu' || currentPage === 'shop') return 'categories';
    if (currentPage === 'orders' || currentPage === 'track-order') return 'orders';
    if (currentPage === 'account' || currentPage === 'wishlist') return 'account';
    return 'home';
  };

  const isMobileMainTabScreen = ['home', 'category', 'category-menu', 'orders', 'account', 'wishlist', 'shop'].includes(currentPage);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased">
      {/* ─────────────────────────────────────────────────────────────
          1. MOBILE VIEW (Screen width < 768px)
          Renders the 16 pixel-perfect mobile screens with native UI
          ───────────────────────────────────────────────────────────── */}
      {isMobile ? (
        <div className="flex-1 flex flex-col min-h-screen bg-[#fbfbfb] relative">
          {/* Mobile Sticky Top Header */}
          <MobileTopBar
            title={
              currentPage === 'category' ? 'Gift Boxes' :
              currentPage === 'product-detail' ? 'Product Detail' :
              currentPage === 'cart' ? 'My Cart' :
              currentPage === 'checkout' ? 'Checkout' :
              currentPage === 'track-order' ? 'Track Order' :
              currentPage === 'account' ? 'My Account' :
              currentPage === 'about' ? 'About Us' :
              currentPage === 'contact' ? 'Contact Us' :
              currentPage === 'wishlist' ? 'My Wishlist' :
              currentPage === 'category-menu' ? 'Categories' : undefined
            }
            showBack={!isMobileMainTabScreen}
            onBack={() => navigate('home')}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenWishlist={() => navigate('wishlist')}
            onOpenCart={() => navigate('cart')}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            currentPage={currentPage}
          />

          {/* Mobile Screen Content */}
          <main className="flex-1 pb-16">
            {currentPage === 'home' && (
              <Screen1Home
                onNavigate={navigate}
                onOpenSearch={() => setIsSearchOpen(true)}
              />
            )}

            {(currentPage === 'category' || currentPage === 'shop') && (
              <Screen2Category
                categorySlug={pageParams?.category || 'gift-boxes'}
                onNavigate={navigate}
                onOpenFilter={() => setIsFilterOpen(true)}
                onOpenSort={() => setIsFilterOpen(true)}
              />
            )}

            {currentPage === 'product-detail' && (
              <Screen3ProductDetail
                slug={pageParams?.slug || 'mega-celebration-box'}
                onNavigate={navigate}
                onBack={() => navigate('category')}
              />
            )}

            {currentPage === 'cart' && (
              <Screen4Cart onNavigate={navigate} />
            )}

            {currentPage === 'checkout' && (
              <Screen5Checkout
                onNavigate={navigate}
                onBack={() => navigate('cart')}
              />
            )}

            {currentPage === 'order-placed' && (
              <Screen6OrderPlaced onNavigate={navigate} />
            )}

            {currentPage === 'track-order' && (
              <Screen7OrderTracking onNavigate={navigate} />
            )}

            {currentPage === 'account' && (
              <Screen8Account
                onNavigate={navigate}
                onOpenNotifications={() => setIsNotificationsOpen(true)}
              />
            )}

            {currentPage === 'about' && (
              <Screen9AboutUs onBack={() => navigate('home')} />
            )}

            {currentPage === 'contact' && (
              <Screen10ContactUs onBack={() => navigate('home')} />
            )}

            {currentPage === 'wishlist' && (
              <Screen13Wishlist onNavigate={navigate} />
            )}

            {currentPage === 'category-menu' && (
              <Screen14CategoryMenu onNavigate={navigate} />
            )}

            {currentPage === 'orders' && (
              <Screen7OrderTracking onNavigate={navigate} />
            )}
          </main>

          {/* Persistent Mobile Bottom Navigation */}
          <MobileBottomNav
            currentTab={getBottomNavTab()}
            onSelectTab={(tab) => {
              if (tab === 'home') navigate('home');
              else if (tab === 'categories') navigate('category-menu');
              else if (tab === 'orders') navigate('track-order');
              else if (tab === 'account') navigate('account');
            }}
          />

          {/* Mobile Drawers & Overlays */}
          <MobileSideDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            onNavigate={navigate}
          />

          <MobileSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onSelectProduct={(slug) => navigate('product-detail', { slug })}
          />

          <MobileFiltersModal
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            onApplyFilters={() => navigate('category')}
          />

          <MobileNotificationsModal
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            onNavigate={navigate}
          />
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            2. DESKTOP / TABLET VIEW (Screen width >= 768px)
            Fluid, responsive e-commerce web platform
            ───────────────────────────────────────────────────────────── */
        <div className="flex-1 flex flex-col">
          <CustomerHeader onNavigate={navigate} currentPage={currentPage} />

          <main className="flex-1">
            {currentPage === 'home' && <HomePage onNavigate={navigate} />}

            {currentPage === 'shop' && (
              <ShopPage
                onNavigate={navigate}
                initialCategory={pageParams?.category}
                initialSearch={pageParams?.search}
                initialSortBy={pageParams?.sortBy}
              />
            )}

            {currentPage === 'category' && (
              <ShopPage
                onNavigate={navigate}
                initialCategory={pageParams?.category || 'gift-boxes'}
              />
            )}

            {currentPage === 'category-menu' && (
              <ShopPage onNavigate={navigate} />
            )}

            {currentPage === 'product-detail' && (
              <ProductDetailPage
                slug={pageParams?.slug || 'mega-celebration-box'}
                onNavigate={navigate}
              />
            )}

            {currentPage === 'cart' && (
              <ShopPage onNavigate={navigate} />
            )}

            {currentPage === 'checkout' && (
              <CheckoutPage onNavigate={navigate} />
            )}

            {currentPage === 'order-placed' && (
              <TrackOrderPage
                initialOrderNumber="AADHI123456"
                onNavigate={navigate}
              />
            )}

            {currentPage === 'track-order' && (
              <TrackOrderPage
                initialOrderNumber={pageParams?.orderNumber}
                onNavigate={navigate}
              />
            )}

            {(currentPage === 'account' || currentPage === 'orders' || currentPage === 'wishlist') && (
              <AccountPage onNavigate={navigate} />
            )}

            {currentPage === 'about' && <AboutUsPage onNavigate={navigate} />}
            {currentPage === 'contact' && <ContactUsPage />}
            {currentPage === 'safety' && <PolicyPage title="Fireworks Safety Precautions" type="safety" />}
            {currentPage === 'terms' && <PolicyPage title="Terms & Conditions" type="terms" />}
            {currentPage === 'privacy' && <PolicyPage title="Privacy Policy" type="privacy" />}
            {currentPage === 'shipping-policy' && <PolicyPage title="Shipping Policy" type="shipping" />}
            {currentPage === 'refund-policy' && <PolicyPage title="Return Policy" type="refund" />}
          </main>

          <CustomerFooter onNavigate={navigate} />
          <CartDrawer onNavigate={navigate} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <ToastProvider>
            <CustomerAppRoot />
          </ToastProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
