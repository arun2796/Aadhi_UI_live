import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  OtpVerificationPage,
  ResetPasswordPage
} from './pages/customer/AuthPages';
import { CartPage } from './pages/customer/CartPage';
import { MyOrdersPage, OrderDetailsPage } from './pages/customer/OrdersPages';
import { WishlistPage, AddressesPage } from './pages/customer/WishlistAddressesPages';
import { ReturnsPage } from './pages/customer/ReturnsPage';

// Mobile Dedicated Navigation Shell
import { MobileTopBar } from './components/mobile/MobileTopBar';
import { MobileBottomNav } from './components/mobile/MobileBottomNav';
import { MobileSideDrawer } from './components/mobile/MobileSideDrawer';
import { MobileSearchModal } from './components/mobile/MobileSearchModal';
import { MobileFiltersModal } from './components/mobile/MobileFiltersModal';
import { MobileNotificationsModal } from './components/mobile/MobileNotificationsModal';

// Mobile Dedicated Screens (25-screen design: Aadhi_Crackers_HD_Clear_Export/02_Customer_HD_Clear)
import { Screen1Home, Screen2Category } from './components/mobile/Screen1HomeAndCategory';
import { Screen3ProductDetail, Screen4Cart } from './components/mobile/Screen3ProductDetailAndCart';
import { Screen5Checkout, Screen6OrderPlaced, Screen7OrderTracking } from './components/mobile/Screen5CheckoutAndOrderFlow';
import {
  Screen8Account,
  Screen9AboutUs,
  Screen10ContactUs,
  Screen14CategoryMenu
} from './components/mobile/Screen8AccountAndStaticScreens';
import {
  ScreenAuth,
  ScreenForgotPassword,
  ScreenOtpVerification,
  ScreenResetPassword
} from './components/mobile/ScreenAuth';
import { ScreenMyOrders, ScreenOrderDetails } from './components/mobile/ScreenOrdersAndDetails';
import { ScreenReturnRequest, ScreenReturnStatus, ScreenRefundStatus } from './components/mobile/ScreenReturns';
import { ScreenPaymentSuccess, ScreenPaymentFailed, ScreenPaymentPending } from './components/mobile/ScreenPaymentResult';
import { ScreenWishlist } from './components/mobile/ScreenWishlist';
import { ScreenAddresses } from './components/mobile/ScreenAddresses';

const MOBILE_TITLES: Record<string, string | undefined> = {
  category: 'Gift Boxes',
  'product-detail': 'Product Detail',
  cart: 'My Cart',
  checkout: 'Checkout',
  'track-order': 'Track Order',
  account: 'My Account',
  about: 'About Us',
  contact: 'Contact Us',
  wishlist: 'My Wishlist',
  'category-menu': 'Categories',
  auth: 'Login / Register',
  'forgot-password': 'Forgot Password',
  'otp-verification': 'Verify OTP',
  'reset-password': 'Reset Password',
  'my-orders': 'My Orders',
  'order-details': 'Order Details',
  addresses: 'My Addresses',
  'payment-success': 'Payment Status',
  'payment-failed': 'Payment Status',
  'payment-pending': 'Payment Status',
  'return-request': 'Return Request',
  'return-status': 'Return Status',
  'refund-status': 'Refund Status'
};

// Screens that need an authenticated customer — unauthenticated users see Login first.
const AUTH_REQUIRED_PAGES = new Set([
  'my-orders',
  'order-details',
  'addresses',
  'return-request',
  'return-status',
  'refund-status'
]);

function CustomerAppRoot() {
  const { user } = useAuth();
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

  const getBottomNavTab = (): 'home' | 'categories' | 'wishlist' | 'orders' | 'account' => {
    if (currentPage === 'category' || currentPage === 'category-menu' || currentPage === 'shop') return 'categories';
    if (currentPage === 'wishlist') return 'wishlist';
    if (currentPage === 'orders' || currentPage === 'my-orders' || currentPage === 'track-order' || currentPage === 'order-details') return 'orders';
    if (currentPage === 'account' || currentPage === 'addresses' || currentPage === 'auth') return 'account';
    return 'home';
  };

  const isMobileMainTabScreen = ['home', 'category', 'category-menu', 'wishlist', 'my-orders', 'orders', 'account', 'shop'].includes(currentPage);

  // Auth gate: protected pages render the Login/Register screen until signed in.
  const requiresAuth = AUTH_REQUIRED_PAGES.has(currentPage) && !user;
  const effectivePage = requiresAuth ? 'auth' : currentPage;
  const effectiveParams = requiresAuth
    ? { initialTab: 'login', redirectTo: currentPage, redirectParams: pageParams }
    : pageParams;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased">
      {/* ─────────────────────────────────────────────────────────────
          1. MOBILE VIEW (Screen width < 768px)
          Renders the 25 design screens with native-style UI
          ───────────────────────────────────────────────────────────── */}
      {isMobile ? (
        <div className="flex-1 flex flex-col min-h-screen bg-[#fbfbfb] relative">
          {/* Mobile Sticky Top Header */}
          <MobileTopBar
            title={MOBILE_TITLES[effectivePage]}
            showBack={!isMobileMainTabScreen}
            onBack={() => navigate('home')}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenWishlist={() => navigate('wishlist')}
            onOpenCart={() => navigate('cart')}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            currentPage={effectivePage}
          />

          {/* Mobile Screen Content */}
          <main className="flex-1 pb-16">
            {effectivePage === 'home' && (
              <Screen1Home
                onNavigate={navigate}
                onOpenSearch={() => setIsSearchOpen(true)}
              />
            )}

            {(effectivePage === 'category' || effectivePage === 'shop') && (
              <Screen2Category
                categorySlug={effectiveParams?.category || 'gift-boxes'}
                filters={effectiveParams?.filters}
                onNavigate={navigate}
                onOpenFilter={() => setIsFilterOpen(true)}
                onOpenSort={() => setIsFilterOpen(true)}
              />
            )}

            {effectivePage === 'product-detail' && (
              <Screen3ProductDetail
                slug={effectiveParams?.slug || 'mega-celebration-box'}
                onNavigate={navigate}
                onBack={() => navigate('category')}
              />
            )}

            {effectivePage === 'cart' && (
              <Screen4Cart onNavigate={navigate} />
            )}

            {effectivePage === 'checkout' && (
              <Screen5Checkout
                onNavigate={navigate}
                onBack={() => navigate('cart')}
              />
            )}

            {effectivePage === 'order-placed' && (
              <Screen6OrderPlaced
                onNavigate={navigate}
                orderNumber={effectiveParams?.orderNumber}
                utrNumber={effectiveParams?.utrNumber}
                screenshotUrl={effectiveParams?.screenshotUrl}
                grandTotal={effectiveParams?.grandTotal}
                paymentMethod={effectiveParams?.paymentMethod}
              />
            )}

            {effectivePage === 'track-order' && (
              <Screen7OrderTracking
                onNavigate={navigate}
                orderNumber={effectiveParams?.orderNumber}
              />
            )}

            {effectivePage === 'account' && (
              <Screen8Account
                onNavigate={navigate}
                onOpenNotifications={() => setIsNotificationsOpen(true)}
              />
            )}

            {effectivePage === 'about' && (
              <Screen9AboutUs onBack={() => navigate('home')} />
            )}

            {effectivePage === 'contact' && (
              <Screen10ContactUs onBack={() => navigate('home')} />
            )}

            {effectivePage === 'wishlist' && (
              <ScreenWishlist onNavigate={navigate} />
            )}

            {effectivePage === 'category-menu' && (
              <Screen14CategoryMenu onNavigate={navigate} />
            )}

            {/* ── Auth cluster (designs 16-19) ── */}
            {effectivePage === 'auth' && (
              <ScreenAuth
                onNavigate={navigate}
                initialTab={effectiveParams?.initialTab}
                redirectTo={effectiveParams?.redirectTo}
                redirectParams={effectiveParams?.redirectParams}
              />
            )}

            {effectivePage === 'forgot-password' && (
              <ScreenForgotPassword onNavigate={navigate} />
            )}

            {effectivePage === 'otp-verification' && (
              <ScreenOtpVerification
                onNavigate={navigate}
                identifier={effectiveParams?.identifier}
                devOtp={effectiveParams?.devOtp}
              />
            )}

            {effectivePage === 'reset-password' && (
              <ScreenResetPassword
                onNavigate={navigate}
                resetToken={effectiveParams?.resetToken}
              />
            )}

            {/* ── Orders cluster (designs 11-12) ── */}
            {(effectivePage === 'my-orders' || effectivePage === 'orders') && (
              <ScreenMyOrders onNavigate={navigate} />
            )}

            {effectivePage === 'order-details' && (
              <ScreenOrderDetails
                onNavigate={navigate}
                orderId={effectiveParams?.orderId}
                orderNumber={effectiveParams?.orderNumber}
              />
            )}

            {/* ── Addresses (design 14) ── */}
            {effectivePage === 'addresses' && (
              <ScreenAddresses
                onNavigate={navigate}
                selectMode={effectiveParams?.selectMode}
                onSelect={effectiveParams?.onSelect}
              />
            )}

            {/* ── Payment result cluster (designs 20-22) ── */}
            {effectivePage === 'payment-success' && (
              <ScreenPaymentSuccess
                onNavigate={navigate}
                orderNumber={effectiveParams?.orderNumber}
                orderId={effectiveParams?.orderId}
                amount={effectiveParams?.amount}
              />
            )}

            {effectivePage === 'payment-failed' && (
              <ScreenPaymentFailed
                onNavigate={navigate}
                orderNumber={effectiveParams?.orderNumber}
                orderId={effectiveParams?.orderId}
                amount={effectiveParams?.amount}
              />
            )}

            {effectivePage === 'payment-pending' && (
              <ScreenPaymentPending
                onNavigate={navigate}
                orderNumber={effectiveParams?.orderNumber}
                orderId={effectiveParams?.orderId}
                amount={effectiveParams?.amount}
              />
            )}

            {/* ── Returns cluster (designs 23-25) ── */}
            {effectivePage === 'return-request' && (
              <ScreenReturnRequest
                onNavigate={navigate}
                orderId={effectiveParams?.orderId}
                orderNumber={effectiveParams?.orderNumber}
              />
            )}

            {effectivePage === 'return-status' && (
              <ScreenReturnStatus
                onNavigate={navigate}
                returnId={effectiveParams?.returnId}
              />
            )}

            {effectivePage === 'refund-status' && (
              <ScreenRefundStatus
                onNavigate={navigate}
                returnId={effectiveParams?.returnId}
                refundId={effectiveParams?.refundId}
              />
            )}
          </main>

          {/* Persistent Mobile Bottom Navigation (design: Home / Categories / Wishlist / Orders / Account) */}
          <MobileBottomNav
            currentTab={getBottomNavTab()}
            onSelectTab={(tab) => {
              if (tab === 'home') navigate('home');
              else if (tab === 'categories') navigate('category-menu');
              else if (tab === 'wishlist') navigate('wishlist');
              else if (tab === 'orders') navigate('my-orders');
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
            onApplyFilters={(filters) => navigate('category', { ...pageParams, filters })}
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
          <CustomerHeader onNavigate={navigate} currentPage={effectivePage} />

          <main className="flex-1">
            {effectivePage === 'home' && <HomePage onNavigate={navigate} />}

            {effectivePage === 'shop' && (
              <ShopPage
                onNavigate={navigate}
                initialCategory={effectiveParams?.category}
                initialSearch={effectiveParams?.search}
                initialSortBy={effectiveParams?.sortBy}
              />
            )}

            {effectivePage === 'category' && (
              <ShopPage
                onNavigate={navigate}
                initialCategory={effectiveParams?.category || 'gift-boxes'}
              />
            )}

            {effectivePage === 'category-menu' && (
              <ShopPage onNavigate={navigate} />
            )}

            {effectivePage === 'product-detail' && (
              <ProductDetailPage
                slug={effectiveParams?.slug || 'mega-celebration-box'}
                onNavigate={navigate}
              />
            )}

            {effectivePage === 'cart' && (
              <CartPage onNavigate={navigate} />
            )}

            {effectivePage === 'checkout' && (
              <CheckoutPage onNavigate={navigate} />
            )}

            {(effectivePage === 'order-placed' ||
              effectivePage === 'track-order' ||
              effectivePage === 'payment-success' ||
              effectivePage === 'payment-failed' ||
              effectivePage === 'payment-pending') && (
              <TrackOrderPage
                initialOrderNumber={effectiveParams?.orderNumber}
                onNavigate={navigate}
              />
            )}

            {/* ── Auth cluster (desktop designs 11-12 + centered forgot/OTP/reset) ── */}
            {effectivePage === 'auth' && (
              effectiveParams?.initialTab === 'register' ? (
                <RegisterPage
                  onNavigate={navigate}
                  redirectTo={effectiveParams?.redirectTo}
                  redirectParams={effectiveParams?.redirectParams}
                />
              ) : (
                <LoginPage
                  onNavigate={navigate}
                  redirectTo={effectiveParams?.redirectTo}
                  redirectParams={effectiveParams?.redirectParams}
                />
              )
            )}

            {effectivePage === 'forgot-password' && <ForgotPasswordPage onNavigate={navigate} />}

            {effectivePage === 'otp-verification' && (
              <OtpVerificationPage
                onNavigate={navigate}
                identifier={effectiveParams?.identifier}
                devOtp={effectiveParams?.devOtp}
              />
            )}

            {effectivePage === 'reset-password' && (
              <ResetPasswordPage onNavigate={navigate} resetToken={effectiveParams?.resetToken} />
            )}

            {/* ── Account cluster (desktop designs 13-17) ── */}
            {effectivePage === 'account' && <AccountPage onNavigate={navigate} />}

            {(effectivePage === 'orders' || effectivePage === 'my-orders') && (
              <MyOrdersPage onNavigate={navigate} />
            )}

            {effectivePage === 'order-details' && (
              <OrderDetailsPage
                onNavigate={navigate}
                orderId={effectiveParams?.orderId}
                orderNumber={effectiveParams?.orderNumber}
              />
            )}

            {effectivePage === 'wishlist' && <WishlistPage onNavigate={navigate} />}

            {effectivePage === 'addresses' && <AddressesPage onNavigate={navigate} />}

            {/* ── Return & Refund (desktop design 18) ── */}
            {(effectivePage === 'return-request' ||
              effectivePage === 'return-status' ||
              effectivePage === 'refund-status') && (
              <ReturnsPage
                onNavigate={navigate}
                mode={
                  effectivePage === 'return-request' ? 'request' :
                  effectivePage === 'return-status' ? 'status' : 'refunds'
                }
                orderId={effectiveParams?.orderId}
                orderNumber={effectiveParams?.orderNumber}
                returnId={effectiveParams?.returnId}
                refundId={effectiveParams?.refundId}
              />
            )}

            {effectivePage === 'about' && <AboutUsPage onNavigate={navigate} />}
            {effectivePage === 'contact' && <ContactUsPage />}
            {effectivePage === 'safety' && <PolicyPage title="Fireworks Safety Precautions" type="safety" />}
            {effectivePage === 'terms' && <PolicyPage title="Terms & Conditions" type="terms" />}
            {effectivePage === 'privacy' && <PolicyPage title="Privacy Policy" type="privacy" />}
            {effectivePage === 'shipping-policy' && <PolicyPage title="Shipping Policy" type="shipping" />}
            {effectivePage === 'refund-policy' && <PolicyPage title="Return Policy" type="refund" />}
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
