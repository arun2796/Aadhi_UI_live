import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Search,
  Heart,
  ShoppingBag,
  User,
  Truck,
  Phone,
  Flame,
  LayoutDashboard,
  Menu,
  X,
  Bell,
  ChevronDown,
  Gift,
  Package
} from 'lucide-react';
import { Category } from '../../types';
import { api, type AppNotification } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useSettings } from '../../context/SettingsContext';
import { NotificationRow, shipmentCardRowIds } from '../common/CommonComponents';

interface CustomerHeaderProps {
  onNavigate: (page: string, params?: any) => void;
  currentPage: string;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({ onNavigate, currentPage }) => {
  const { totalItems, setIsCartDrawerOpen } = useCart();
  const { wishlist } = useWishlist();
  const { user, isAdmin, toggleUserRole } = useAuth();
  const { storePhone, storeEmail, headerPromoText } = useSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [navCategories, setNavCategories] = useState<Category[]>([]);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const {
    items: notifications,
    unreadCount,
    isLoading: notificationsLoading,
    isLoadingMore: notificationsLoadingMore,
    hasMore: hasMoreNotifications,
    hasLoaded: notificationsLoaded,
    refresh: refreshNotifications,
    loadMore: loadMoreNotifications,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead
  } = useNotifications();

  // The carrier + LR is repeated across rows for the same shipment; state it once.
  const shipmentRows = useMemo(() => shipmentCardRowIds(notifications), [notifications]);

  useEffect(() => {
    let mounted = true;
    api.getCategories().then((cats) => {
      if (mounted) setNavCategories(cats);
    });
    return () => { mounted = false; };
  }, []);

  // Opening the panel is the moment the customer asks what happened to their
  // order — answer with the current feed, not whatever was last fetched.
  useEffect(() => {
    if (isNotificationsOpen) refreshNotifications();
  }, [isNotificationsOpen, refreshNotifications]);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) setIsNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isNotificationsOpen]);

  // Opening one notification marks it read and, when it belongs to an order,
  // goes to that order's tracking screen (which works for everyone).
  const handleOpenNotification = (notification: AppNotification) => {
    if (!notification.isRead) markNotificationRead(notification.id);
    if (notification.orderNumber) {
      setIsNotificationsOpen(false);
      onNavigate('track-order', { orderNumber: notification.orderNumber });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('shop', { search: searchQuery.trim() });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full shadow-lg">
      {/* Top Banner */}
      <div className="bg-navy-dark text-slate-300 text-xs py-1.5 px-4 border-b border-navy-border/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {headerPromoText && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange text-white">
                FESTIVAL SALE
              </span>
            )}
            <span className="hidden sm:inline text-slate-200">
              🚚 Dispatched by lorry — reaches your transport office in 1–2 weeks
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {storePhone && (
              <a
                href={`tel:${storePhone.replace(/[^+\d]/g, '')}`}
                className="flex items-center space-x-1 hover:text-white transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-gold" />
                <span>{storePhone}</span>
              </a>
            )}
            {storePhone && storeEmail && <span className="hidden md:inline text-slate-400">|</span>}
            {storeEmail && (
              <span className="hidden md:inline text-gold font-semibold">{storeEmail}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-navy text-white px-4 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <div
            onClick={() => onNavigate('home')}
            className="flex items-center space-x-2 cursor-pointer group flex-shrink-0"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-orange via-gold to-yellow-300 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
              <Flame className="w-6 h-6 text-navy fill-current" />
            </div>
            <div>
              <div className="font-black text-xl tracking-wider leading-none text-white flex items-center space-x-1">
                <span>AADHI</span>
                <span className="text-orange text-sm font-semibold tracking-normal">CRACKERS</span>
              </div>
              <div className="text-[10px] tracking-widest uppercase text-gold font-medium">
                Celebrate Every Moment
              </div>
            </div>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-xl relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for crackers, gift boxes, sparklers, aerial shots..."
              className="w-full pl-4 pr-12 py-2.5 rounded-xl bg-white text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange shadow-inner"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 bg-orange hover:bg-orange-hover text-white rounded-lg flex items-center justify-center transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Action Icons */}
          <div className="flex items-center space-x-4 sm:space-x-6">
            <button
              onClick={() => onNavigate('track-order')}
              className="hidden lg:flex flex-col items-center text-xs text-slate-200 hover:text-orange transition-colors"
            >
              <Truck className="w-5 h-5 mb-0.5 text-gold" />
              <span>Track Order</span>
            </button>

            <button
              onClick={() => onNavigate('wishlist')}
              className="flex flex-col items-center text-xs text-slate-200 hover:text-orange relative transition-colors"
            >
              <Heart className="w-5 h-5 mb-0.5 text-slate-200 hover:text-red-400" />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                  {wishlist.length}
                </span>
              )}
              <span className="hidden sm:inline">Wishlist</span>
            </button>

            {/* Order updates. Only for a signed-in customer: a guest has no
                account for this feed to answer about — they use Track Order. */}
            {user && (
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setIsNotificationsOpen(open => !open)}
                  className="flex flex-col items-center text-xs text-slate-200 hover:text-orange relative transition-colors"
                  aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
                >
                  <Bell
                    className={`w-5 h-5 mb-0.5 ${unreadCount > 0 ? 'text-gold' : 'text-slate-200'}`}
                  />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-4 h-4 px-1 bg-orange text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  <span className="hidden sm:inline">Updates</span>
                </button>

                {isNotificationsOpen && (
                  <div className="absolute top-full right-0 mt-2 w-[22rem] max-w-[92vw] bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-100 z-50 animate-slide-in overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <div className="font-bold text-navy text-sm">Notifications</div>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllNotificationsRead()}
                          className="text-[11px] font-bold text-purple hover:text-purple-dark transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-[26rem] overflow-y-auto p-3 space-y-2.5">
                      {notificationsLoading && notifications.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500">
                          Fetching your order updates...
                        </div>
                      ) : notifications.length === 0 ? (
                        notificationsLoaded ? (
                          <div className="py-6 text-center text-xs text-slate-500">
                            No notifications yet.
                          </div>
                        ) : null
                      ) : (
                        <>
                          {notifications.map(notification => (
                            <NotificationRow
                              key={notification.id}
                              notification={notification}
                              onOpen={handleOpenNotification}
                              showCarrierDetails={shipmentRows.has(notification.id)}
                            />
                          ))}
                          {hasMoreNotifications && (
                            <button
                              onClick={() => loadMoreNotifications()}
                              disabled={notificationsLoadingMore}
                              className="w-full py-2.5 rounded-xl border border-slate-200 text-[11px] font-bold text-purple hover:bg-slate-50 disabled:text-slate-400 transition-colors"
                            >
                              {notificationsLoadingMore ? 'Loading...' : 'Load more'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="flex flex-col items-center text-xs text-slate-200 hover:text-orange relative transition-colors"
            >
              <ShoppingBag className="w-5 h-5 mb-0.5 text-gold" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-orange text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
              <span className="hidden sm:inline">Cart</span>
            </button>

            <button
              onClick={() => onNavigate('account')}
              className="flex items-center space-x-2 pl-2 border-l border-navy-light text-slate-200 hover:text-white transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-navy-light flex items-center justify-center text-gold border border-gold/30">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden xl:block text-left text-xs">
                <div className="text-slate-400 text-[10px]">Hello,</div>
                <div className="font-semibold text-white leading-tight">
                  {user ? user.firstName : 'Sign In'}
                </div>
              </div>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-slate-200 hover:text-white p-1"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="mt-3 md:hidden">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for crackers, gift boxes..."
              className="w-full pl-3 pr-10 py-2 rounded-lg bg-white text-slate-800 text-xs focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-1 top-1 bottom-1 px-2.5 bg-orange text-white rounded flex items-center justify-center"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Categories & Links Bar */}
      <div className="bg-navy-light/95 border-t border-navy-border/40 text-slate-200 text-xs hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {/* Category Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 font-bold text-white bg-purple hover:bg-purple-light transition-colors"
              >
                <Sparkles className="w-4 h-4 text-gold" />
                <span>All Categories</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {isCategoryOpen && (
                <div className="absolute top-full left-0 w-56 bg-white text-slate-800 rounded-b-xl shadow-2xl py-2 z-50 border border-slate-100 animate-slide-in">
                  {navCategories.length === 0 ? (
                    <div className="px-4 py-2 text-xs text-slate-400 font-medium">
                      No categories available yet
                    </div>
                  ) : (
                    navCategories.map(c => (
                      <button
                        key={c.slug || c.id}
                        onClick={() => {
                          setIsCategoryOpen(false);
                          onNavigate('shop', { category: c.slug });
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-orange/10 hover:text-orange flex items-center justify-between transition-colors text-xs font-medium"
                      >
                        <span>{c.name}</span>
                        <span className="text-[10px] text-slate-400">→</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => onNavigate('shop', { view: 'combos' })}
              className="px-3 py-2.5 font-medium hover:text-gold transition-colors flex items-center space-x-1.5"
            >
              <Package className="w-3.5 h-3.5 text-gold" />
              <span>Combos</span>
            </button>
            <button
              onClick={() => onNavigate('shop', { view: 'giftboxes' })}
              className="px-3 py-2.5 font-medium hover:text-gold transition-colors flex items-center space-x-1.5"
            >
              <Gift className="w-3.5 h-3.5 text-gold" />
              <span>Gift Boxes</span>
            </button>
            <button
              onClick={() => onNavigate('shop', { sortBy: 'new' })}
              className="px-3 py-2.5 font-medium hover:text-gold transition-colors"
            >
              New Arrivals
            </button>
            <button
              onClick={() => onNavigate('shop')}
              className="px-3 py-2.5 font-medium hover:text-gold transition-colors"
            >
              All Products
            </button>
            <button
              onClick={() => onNavigate('about')}
              className="px-3 py-2.5 font-medium hover:text-gold transition-colors"
            >
              About Us
            </button>
            <button
              onClick={() => onNavigate('contact')}
              className="px-3 py-2.5 font-medium hover:text-gold transition-colors"
            >
              Contact Us
            </button>
          </div>

          {headerPromoText && (
            <div className="flex items-center space-x-3 text-gold font-medium text-xs">
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-orange animate-spin" />
                <span>{headerPromoText}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-navy-light text-white p-4 border-t border-navy-border">
          <div className="space-y-2">
            <button
              onClick={() => { setIsMobileMenuOpen(false); onNavigate('home'); }}
              className="block w-full text-left py-2 font-medium border-b border-navy-border/40"
            >
              Home
            </button>
            <button
              onClick={() => { setIsMobileMenuOpen(false); onNavigate('shop', { view: 'combos' }); }}
              className="w-full text-left py-2 font-medium border-b border-navy-border/40 flex items-center space-x-2"
            >
              <Package className="w-4 h-4 text-gold" />
              <span>Combos</span>
            </button>
            <button
              onClick={() => { setIsMobileMenuOpen(false); onNavigate('shop', { view: 'giftboxes' }); }}
              className="w-full text-left py-2 font-medium border-b border-navy-border/40 flex items-center space-x-2"
            >
              <Gift className="w-4 h-4 text-gold" />
              <span>Gift Boxes</span>
            </button>
            <button
              onClick={() => { setIsMobileMenuOpen(false); onNavigate('shop'); }}
              className="block w-full text-left py-2 font-medium border-b border-navy-border/40"
            >
              All Products
            </button>
            <button
              onClick={() => { setIsMobileMenuOpen(false); onNavigate('track-order'); }}
              className="block w-full text-left py-2 font-medium border-b border-navy-border/40"
            >
              Track Order
            </button>
            <button
              onClick={() => { setIsMobileMenuOpen(false); onNavigate('about'); }}
              className="block w-full text-left py-2 font-medium border-b border-navy-border/40"
            >
              About Us
            </button>
            <button
              onClick={() => { setIsMobileMenuOpen(false); onNavigate('contact'); }}
              className="block w-full text-left py-2 font-medium"
            >
              Contact Us
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
