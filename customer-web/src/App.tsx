import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ToastProvider } from './context/ToastContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';

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
import { ScreenPaymentSuccess, ScreenPaymentFailed, ScreenPaymentPending } from './components/mobile/ScreenPaymentResult';
import { ScreenWishlist } from './components/mobile/ScreenWishlist';
import { ScreenAddresses } from './components/mobile/ScreenAddresses';

// URL scheme + per-page <head> metadata / JSON-LD
import { buildPath, parsePath, compactParams, EPHEMERAL_PAGES, isCombosView } from './seo/routes.js';
import { SeoHead } from './seo/SeoHead';

const MOBILE_TITLES: Record<string, string | undefined> = {
  category: 'Products',
  shop: 'Combos',
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
  'payment-pending': 'Payment Status'
};

/** Mobile top-bar title. The `shop` screen is reached from the mobile UI only as
 *  the Combos view, so it keeps that title — but a deep link to `/shop` or
 *  `/shop/<category>` now lands there too and must read "Products". */
const mobileTitleFor = (page: string, params: any): string | undefined => {
  if (page === 'shop') return isCombosView(params) ? 'Combos' : 'Products';
  return MOBILE_TITLES[page];
};

/** Strips values that cannot survive `history.pushState` (callbacks, DOM nodes). */
const serialisableParams = (params: any): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (typeof value === 'function' || typeof value === 'symbol') continue;
    try {
      structuredClone(value);
      out[key] = value;
    } catch {
      /* not cloneable — leave it in React state only */
    }
  }
  return out;
};

/** The current URL as the app writes it (path + query, never the origin). */
const currentUrl = (): string => `${window.location.pathname}${window.location.search}`;

// Screens that need an authenticated customer — unauthenticated users see Login first.
//
// These are ACCOUNT screens only: each one renders data that belongs to a specific
// signed-in customer, so there is nothing to show without a session.
//
// Buying is deliberately NOT on this list. Browsing, cart, checkout, placing an
// order, submitting UPI payment proof and tracking all work with no account —
// `POST /orders`, `POST /orders/{id}/payment-proof` and `GET /orders/track/{no}`
// are all anonymous-capable. Checkout used to be gated here, which turned the
// Login screen into a wall in front of every guest purchase; it now offers an
// optional sign-in instead (see CheckoutPage / Screen5Checkout) and a guest's
// order number is surfaced as their handle on the confirmation screen.
const AUTH_REQUIRED_PAGES = new Set([
  'my-orders',
  'order-details',
  'addresses'
]);

/** Full-page notice shown to customers while the storefront is switched OFF. */
function MaintenanceNotice() {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6 text-center font-sans antialiased">
      <img
        src="/logo.png"
        alt="Aadhi Crackers"
        className="w-24 h-24 object-contain mb-6"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <h1 className="text-2xl sm:text-3xl font-black text-white">We'll be right back</h1>
      <p className="text-sm text-slate-300 mt-3 max-w-md leading-relaxed">
        The store is temporarily unavailable. Please check back soon.
      </p>
    </div>
  );
}

function CustomerAppRoot() {
  const { websiteStatus } = useSettings();
  const { user } = useAuth();

  /* ─────────────────────────────────────────────────────────────
      URL ↔ screen synchronisation.

      `navigate(page, params)` is unchanged as far as every caller is
      concerned — it still just switches the screen. Underneath it now also
      pushes the matching real URL (src/seo/routes.js owns the scheme), so
      deep links, Back/Forward and link sharing all work.

      Params travel in `history.state` as well as in React state, so Back
      into a screen whose content lives in its params (a placed order, a
      payment result) restores it instead of showing an empty screen.
      ───────────────────────────────────────────────────────────── */
  const initialRoute = React.useMemo(() => {
    const fromHistory = window.history.state as { page?: string; params?: any; matched?: boolean } | null;
    if (fromHistory && typeof fromHistory.page === 'string') {
      return { page: fromHistory.page, params: fromHistory.params || {}, matched: fromHistory.matched !== false };
    }
    const parsed = parsePath(window.location.pathname, window.location.search);
    // A cold load of a params-only screen has nothing to show — start at Home.
    if (EPHEMERAL_PAGES.has(parsed.page)) return { page: 'home', params: {}, matched: true };
    return parsed;
  }, []);

  const [currentPage, setCurrentPage] = useState<string>(initialRoute.page);
  const [pageParams, setPageParams] = useState<any>(initialRoute.params);
  const [urlMatched, setUrlMatched] = useState<boolean>(initialRoute.matched);

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

  const closeOverlays = useCallback(() => {
    setIsDrawerOpen(false);
    setIsSearchOpen(false);
    setIsFilterOpen(false);
    setIsNotificationsOpen(false);
  }, []);

  const navigate = useCallback((page: string, params: any = {}) => {
    closeOverlays();
    setCurrentPage(page);
    setPageParams(params);
    setUrlMatched(true);

    // Write the URL for this screen. Re-applying filters on the screen you are
    // already on keeps the same URL, so it replaces rather than stacking up
    // history entries the Back button would have to walk through.
    try {
      const url = buildPath(page, params);
      const state = { page, params: compactParams(serialisableParams(params)), matched: true };
      if (url === currentUrl()) window.history.replaceState(state, '', url);
      else window.history.pushState(state, '', url);
    } catch {
      /* history is unavailable (sandboxed iframe) — navigation still works */
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [closeOverlays]);

  // Normalise the entry URL once: a cold load of an ephemeral screen, an unknown
  // path, or an alias (e.g. /shop/gift-boxes → /combos) settles on its canonical
  // form, and the first history entry carries state so Back/Forward is symmetric.
  useEffect(() => {
    try {
      const canonical = urlMatched ? buildPath(initialRoute.page, initialRoute.params) : currentUrl();
      window.history.replaceState(
        {
          page: initialRoute.page,
          params: compactParams(serialisableParams(initialRoute.params)),
          matched: initialRoute.matched
        },
        '',
        canonical
      );
    } catch {
      /* ignore */
    }
    // Browser scroll restoration fights async SPA rendering; the app handles it.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back / Forward.
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      closeOverlays();
      const state = event.state as { page?: string; params?: any; matched?: boolean } | null;
      if (state && typeof state.page === 'string') {
        setCurrentPage(state.page);
        setPageParams(state.params || {});
        setUrlMatched(state.matched !== false);
      } else {
        const parsed = parsePath(window.location.pathname, window.location.search);
        setCurrentPage(parsed.page);
        setPageParams(parsed.params);
        setUrlMatched(parsed.matched);
      }
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [closeOverlays]);

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

  // MAINTENANCE MODE: storefront switched OFF → replace the whole customer UI
  // (both the mobile and desktop trees) with a full-page notice.
  if (websiteStatus === 'OFF') {
    return <MaintenanceNotice />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased">
      {/* Per-page <title>, meta description, canonical, Open Graph / Twitter
          cards and JSON-LD. Renders no markup. */}
      <SeoHead page={currentPage} params={pageParams} matched={urlMatched} />

      {/* ─────────────────────────────────────────────────────────────
          1. MOBILE VIEW (Screen width < 768px)
          Renders the 25 design screens with native-style UI
          ───────────────────────────────────────────────────────────── */}
      {isMobile ? (
        <div className="flex-1 flex flex-col min-h-screen bg-[#fbfbfb] relative">
          {/* Mobile Sticky Top Header */}
          <MobileTopBar
            title={mobileTitleFor(effectivePage, effectiveParams)}
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
                categorySlug={effectiveParams?.category}
                view={effectiveParams?.view}
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
                orderId={effectiveParams?.orderId}
                orderNumber={effectiveParams?.orderNumber}
                utrNumber={effectiveParams?.utrNumber}
                screenshotUrl={effectiveParams?.screenshotUrl}
                grandTotal={effectiveParams?.grandTotal}
                packingCharges={effectiveParams?.packingCharges}
                packingChargePercent={effectiveParams?.packingChargePercent}
                paymentMethod={effectiveParams?.paymentMethod}
                isGuest={effectiveParams?.isGuest}
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
            onApplyFilters={(filters) =>
              navigate(currentPage === 'shop' ? 'shop' : 'category', { ...pageParams, filters })
            }
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
                initialView={effectiveParams?.view}
                initialCategory={effectiveParams?.category}
                initialSearch={effectiveParams?.search}
                initialSortBy={effectiveParams?.sortBy}
              />
            )}

            {effectivePage === 'category' && (
              <ShopPage
                onNavigate={navigate}
                initialView={effectiveParams?.view}
                initialCategory={effectiveParams?.category}
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
                initialOrderId={effectiveParams?.orderId}
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

            {effectivePage === 'about' && <AboutUsPage onNavigate={navigate} />}
            {effectivePage === 'contact' && <ContactUsPage />}
            {effectivePage === 'safety' && <PolicyPage title="Fireworks Safety Precautions" type="safety" />}
            {effectivePage === 'terms' && <PolicyPage title="Terms & Conditions" type="terms" />}
            {effectivePage === 'privacy' && <PolicyPage title="Privacy Policy" type="privacy" />}
            {effectivePage === 'shipping-policy' && <PolicyPage title="Shipping Policy" type="shipping" />}
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
    <SettingsProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <ToastProvider>
              <CustomerAppRoot />
            </ToastProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
