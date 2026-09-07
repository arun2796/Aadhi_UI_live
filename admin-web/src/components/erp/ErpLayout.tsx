import React, { useState, useEffect } from 'react';
import {
  Flame,
  LayoutDashboard,
  ShoppingBag,
  ClipboardCheck,
  Layers,
  FolderTree,
  Package,
  Boxes,
  Truck,
  TrendingUp,
  Users,
  Store,
  RotateCcw,
  CreditCard,
  Tag,
  BarChart3,
  FileText,
  Receipt,
  Gift,
  Star,
  Image as ImageIcon,
  Warehouse,
  ArrowLeftRight,
  AlertTriangle,
  PackageCheck,
  DollarSign,
  Wallet,
  Clock,
  Banknote,
  ShieldAlert,
  History,
  Activity,
  UserCog,
  Settings,
  ShieldCheck,
  Database,
  Building2,
  UserCheck,
  Ticket,
  UserPlus,
  MessageSquare,
  MessageCircle,
  FileDown,
  ShoppingCart,
  Smartphone,
  Search,
  Bell,
  LogOut,
  ExternalLink,
  ChevronDown,
  Menu,
  X,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { api } from '../../services/api';
import { Order, StockItem } from '../../types';

interface ErpLayoutProps {
  currentTab: string;
  onNavigateTab: (tab: string, params?: any) => void;
  children: React.ReactNode;
}

interface NavLeaf {
  /** Unique React key — several items may navigate to the same target. */
  key: string;
  label: string;
  icon: React.ElementType;
  /** Tab id / path fragment handed to onNavigateTab (may carry a query string). */
  to: string;
  /**
   * Optional manual override. Explicit null means never rendered active
   * (used when another item already owns the highlight for that route).
   */
  match?: string | null;
  badge?: string;
  /** Renders as an indented second-level link (e.g. Sub Categories). */
  indent?: boolean;
}

interface NavGroup {
  label: string;
  items: NavLeaf[];
}

/**
 * Accurately determines if a navigation item is currently active,
 * distinguishing sub-tab query strings (?tab=codes vs ?tab=discounts, ?tab=confirm, ?section=company, ?pdf=1).
 */
const isItemActive = (
  item: NavLeaf,
  location: { pathname: string; search: string },
  currentTab: string
): boolean => {
  if (item.match === null) return false;

  const [toPathRaw, toQueryRaw] = item.to.split('?');
  const targetPath = toPathRaw.startsWith('/') ? toPathRaw : `/admin/${toPathRaw}`;
  const currentPath = location.pathname;
  const currentSearch = new URLSearchParams(location.search);

  // 1. Standalone Dashboard match
  if (targetPath === '/admin/dashboard') {
    return (
      currentPath === '/admin/dashboard' ||
      currentPath === '/admin' ||
      currentPath === '/admin/' ||
      currentPath === '/'
    );
  }

  // 2. Base path matching
  let isPathMatch = false;
  if (currentPath === targetPath) {
    isPathMatch = true;
  } else if (
    currentPath.startsWith(`${targetPath}/`) &&
    targetPath !== '/admin' &&
    targetPath !== '/admin/'
  ) {
    // Avoid false matches when a sibling route is more specific (e.g. enquiries/customers)
    if (targetPath === '/admin/enquiries') {
      const rest = currentPath.slice('/admin/enquiries/'.length);
      if (rest === 'customers' || rest === 'direct') {
        isPathMatch = false;
      } else {
        isPathMatch = true;
      }
    } else {
      isPathMatch = true;
    }
  }

  if (!isPathMatch) {
    if (item.match && item.match === currentTab) return true;
    return false;
  }

  // 3. Query parameter differentiation
  if (toQueryRaw) {
    const targetParams = new URLSearchParams(toQueryRaw);
    let allMatch = true;
    targetParams.forEach((val, key) => {
      const currentVal = currentSearch.get(key);
      if (key === 'tab' && val === 'discounts') {
        // 'discounts' is the default view in ErpMarketingModule when ?tab is missing or explicitly ?tab=discounts
        if (currentVal !== null && currentVal !== 'discounts') {
          allMatch = false;
        }
      } else if (currentVal !== val) {
        allMatch = false;
      }
    });
    return allMatch;
  }

  // 4. Default routes with no query parameters: ensure they don't stay active when a query-specific sibling is active
  if (targetPath === '/admin/marketing/coupons') {
    return currentSearch.get('tab') !== 'codes';
  }

  if (targetPath === '/admin/orders') {
    return currentSearch.get('tab') !== 'confirm';
  }

  if (targetPath === '/admin/settings') {
    return currentSearch.get('section') !== 'company';
  }

  if (targetPath === '/admin/enquiries') {
    return currentSearch.get('pdf') !== '1';
  }

  if (targetPath === '/admin/users') {
    return currentSearch.get('tab') !== 'staff';
  }

  return true;
};

// Standalone Dashboard link shown above the groups
const DASHBOARD_ITEM: NavLeaf = {
  key: 'dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
  to: 'dashboard'
};

// Client-facing grouped navigation
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Master',
    items: [
      { key: 'master-user', label: 'User', icon: UserCog, to: 'users' },
      { key: 'master-company', label: 'Company', icon: Building2, to: 'settings?section=company' },
      { key: 'master-staff', label: 'Staff', icon: UserCheck, to: 'users?tab=staff' },
      { key: 'master-settings', label: 'Settings', icon: Settings, to: 'settings' }
    ]
  },
  {
    label: 'Catalog',
    items: [
      { key: 'catalog-category', label: 'Category', icon: Layers, to: 'categories' },
      { key: 'catalog-sub-categories', label: 'Sub Categories', icon: FolderTree, to: 'sub-categories', indent: true },
      { key: 'catalog-product', label: 'Product', icon: Package, to: 'products' },
      { key: 'catalog-discount', label: 'Discount', icon: Tag, to: 'marketing/coupons?tab=discounts' },
      { key: 'catalog-promo-code', label: 'Promotion Code', icon: Ticket, to: 'marketing/coupons?tab=codes' }
    ]
  },
  {
    label: 'Customer & Enquiry',
    items: [
      { key: 'ce-customer', label: 'Customer', icon: Users, to: 'customers' },
      { key: 'ce-enquiry-customer', label: 'Enquiry Customer', icon: UserPlus, to: 'enquiries/customers' },
      { key: 'ce-direct-enquiry', label: 'Direct Enquiry', icon: MessageCircle, to: 'enquiries/direct' },
      { key: 'ce-enquiry', label: 'Enquiry', icon: MessageSquare, to: 'enquiries' },
      { key: 'ce-enquiry-pdf', label: 'Enquiry To PDF', icon: FileDown, to: 'enquiries?pdf=1' }
    ]
  },
  {
    label: 'Order Management',
    items: [
      { key: 'om-order', label: 'Order', icon: ShoppingBag, to: 'orders' },
      { key: 'om-order-confirm', label: 'Order Confirm', icon: ClipboardCheck, to: 'orders?tab=confirm', badge: 'NEW' }
    ]
  },
  /*
  {
    label: 'Inventory',
    items: [
      { key: 'inv-inventory', label: 'Inventory', icon: Boxes, to: 'inventory' },
      // Hidden per client menu — Low Stock is a tab inside the Inventory screen
      // { key: 'inv-low-stock', label: 'Low Stock', icon: AlertTriangle, to: 'low-stock' }
    ]
  },
  {
    label: 'Purchase',
    items: [
      { key: 'pur-purchase', label: 'Purchase', icon: Truck, to: 'purchases' },
      // Hidden per client menu — Suppliers is a tab inside the Purchase screen
      // { key: 'pur-suppliers', label: 'Suppliers', icon: Store, to: 'suppliers' }
    ]
  },
  */
  {
    label: 'Sales',
    items: [
      { key: 'sales-sales', label: 'Sales', icon: TrendingUp, to: 'finance' },
      { key: 'sales-orders', label: 'Sales Orders', icon: ShoppingCart, to: 'orders', match: null },
      { key: 'sales-invoices', label: 'Invoices', icon: Receipt, to: 'invoices' },
      { key: 'sales-payments', label: 'Payments', icon: CreditCard, to: 'payments' },
      { key: 'sales-history', label: 'Sales History', icon: BarChart3, to: 'reports' }
    ]
  },
  {
    label: 'Content',
    items: [
      { key: 'content-banners', label: 'Banners', icon: ImageIcon, to: 'banners' }
    ]
  }
];

// Remaining existing routes stay reachable under a collapsed "Developer" section.
// Hidden from the client-facing sidebar — flip to true to bring the menu back
// (the routes themselves remain reachable by direct URL either way).
const SHOW_DEVELOPER_NAV = false;

const DEVELOPER_NAV: NavLeaf[] = [
  { key: 'dev-quotes', label: 'Quotes (B2B)', icon: FileText, to: 'quotes' },
  { key: 'dev-combos', label: 'Gift Boxes / Combos', icon: Gift, to: 'combos' },
  { key: 'dev-reviews', label: 'Reviews', icon: Star, to: 'reviews' },
  { key: 'dev-warehouses', label: 'Warehouses', icon: Warehouse, to: 'warehouses' },
  { key: 'dev-transfers', label: 'Stock Transfers', icon: ArrowLeftRight, to: 'transfers' },
  { key: 'dev-grn', label: 'Goods Received', icon: PackageCheck, to: 'grn' },
  { key: 'dev-bills', label: 'Supplier Bills', icon: DollarSign, to: 'bills' },
  { key: 'dev-expenses', label: 'Expenses', icon: Wallet, to: 'expenses' },
  { key: 'dev-receivables', label: 'Receivables', icon: Clock, to: 'receivables' },
  { key: 'dev-payables', label: 'Payables', icon: Banknote, to: 'payables' },
  { key: 'dev-audit-logs', label: 'Audit Logs', icon: ShieldAlert, to: 'audit-logs' },
  { key: 'dev-sessions', label: 'Login History', icon: History, to: 'sessions' },
  { key: 'dev-rate-limits', label: 'Rate Limits', icon: Activity, to: 'rate-limit-logs' },
  { key: 'dev-system-health', label: 'System Health', icon: ShieldCheck, to: 'system-health' },
  { key: 'dev-backup', label: 'Backup', icon: Database, to: 'backup' }
];

const STOREFRONT_URL: string = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173';

export const ErpLayout: React.FC<ErpLayoutProps> = ({
  currentTab,
  onNavigateTab,
  children
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isDeveloperOpen, setIsDeveloperOpen] = useState(() =>
    DEVELOPER_NAV.some((i) => isItemActive(i, location, currentTab))
  );

  // Real notification data — fetched on demand when the bell drawer opens (no polling)
  const [notifLowStock, setNotifLowStock] = useState<StockItem[]>([]);
  const [notifPendingOrders, setNotifPendingOrders] = useState<Order[]>([]);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [hasNotifFetched, setHasNotifFetched] = useState(false);

  // Global Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keep the "Developer" section expanded whenever the active route lives inside it
  useEffect(() => {
    if (DEVELOPER_NAV.some((i) => isItemActive(i, location, currentTab))) {
      setIsDeveloperOpen(true);
    }
  }, [location, currentTab]);

  const toggleNotifications = () => {
    const opening = !isNotificationsOpen;
    setIsNotificationsOpen(opening);
    if (opening) {
      setIsNotifLoading(true);
      Promise.all([
        api.getLowStockAlerts(5).catch(() => [] as StockItem[]),
        api
          .getOrders({ status: 'Pending', pageSize: 5 })
          .then((res) => [...res] as Order[])
          .catch(() => [] as Order[])
      ])
        .then(([lows, pending]) => {
          setNotifLowStock(lows);
          setNotifPendingOrders(pending);
          setHasNotifFetched(true);
        })
        .finally(() => setIsNotifLoading(false));
    }
  };

  const notifCount = notifLowStock.length + notifPendingOrders.length;

  const renderNavItem = (item: NavLeaf, subtle = false) => {
    const Icon = item.icon;
    const isActive = isItemActive(item, location, currentTab);
    return (
      <button
        key={item.key}
        onClick={() => {
          onNavigateTab(item.to);
          setIsSidebarOpen(false);
        }}
        className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all duration-200 press-scale ${
          item.indent ? 'pl-7 pr-3' : 'px-3.5'
        } ${
          isActive
            ? 'bg-gradient-to-r from-purple/30 via-purple/15 to-transparent border-purple/40 text-white font-bold shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'
            : subtle
              ? 'border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-white'
              : 'border-transparent text-slate-300/90 hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        <div className="flex items-center space-x-2.5">
          {isActive && (
            <span className="w-1 h-3.5 rounded-full bg-gradient-to-b from-gold to-orange -ml-1 mr-0.5 animate-pulse" />
          )}
          <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-gold drop-shadow-[0_0_8px_rgba(255,176,0,0.5)]' : 'text-slate-400'}`} />
          <span className="truncate text-left tracking-wide">{item.label}</span>
        </div>
        {item.badge && (
          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white tracking-wider flex-shrink-0 shadow-xs">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans">
      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onNavigateTab={onNavigateTab}
      />

      {/* Obsidian Dark Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-[#080918] text-slate-300 flex flex-col justify-between border-r border-[#1a1b38] transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Brand Logo Header — gold AADHI CRACKERS wordmark + live status */}
          <div className="p-4 border-b border-[#181938] bg-[#070815] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple via-[#361e8c] to-orange/40 border border-purple/40 flex items-center justify-center shadow-glow flex-shrink-0">
                  <Flame className="w-5 h-5 text-orange fill-current" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#080918] rounded-full" />
              </div>
              <div className="leading-tight">
                <div className="font-black text-gold text-base tracking-wide flex items-center space-x-1.5">
                  <span>AADHI</span>
                  <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-md bg-gold/15 text-gold border border-gold/30 tracking-wider">ERP</span>
                </div>
                <div className="text-[9px] text-slate-400 font-bold tracking-[0.25em] uppercase">
                  Crackers Live
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grouped Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {renderNavItem(DASHBOARD_ITEM)}

            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="pt-3">
                <div className="px-3 pb-1 text-[10px] font-extrabold text-slate-400/80 tracking-widest uppercase">
                  {group.label}
                </div>
                <div className="space-y-0.5">{group.items.map((item) => renderNavItem(item))}</div>
              </div>
            ))}

            {/* Collapsed "Developer" section — hidden via SHOW_DEVELOPER_NAV */}
            {SHOW_DEVELOPER_NAV && (
            <div className="pt-4 mt-3 border-t border-[#181938]">
              <button
                onClick={() => setIsDeveloperOpen((v) => !v)}
                className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-[10px] font-extrabold text-slate-500 tracking-wider uppercase hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <span>Developer</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${isDeveloperOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isDeveloperOpen && (
                <div className="mt-1 space-y-0.5 opacity-90">
                  {DEVELOPER_NAV.map((item) => renderNavItem(item, true))}
                </div>
              )}
            </div>
            )}
          </nav>

          {/* User Profile & Logout Bottom Card */}
          <div className="p-3 border-t border-[#181938] bg-[#060714] flex items-center justify-between">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple to-gold/60 border border-gold/40 flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-2xs">
                  {(user?.firstName || user?.fullName || 'A').charAt(0)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 border border-[#080918] rounded-full" />
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-white truncate">
                  {user?.fullName || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold truncate flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-light" />
                  <span>{user?.role || 'Administrator'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-white/5 transition-all press-scale flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 glass-header px-5 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 press-scale"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search Button Trigger */}
            <div
              onClick={() => setIsGlobalSearchOpen(true)}
              className="w-48 sm:w-72 md:w-96 bg-slate-100/80 hover:bg-slate-100/95 cursor-pointer rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-slate-400 transition-all border border-slate-200/80 shadow-2xs press-scale"
            >
              <div className="flex items-center space-x-2.5">
                <Search className="w-4 h-4 text-slate-400" />
                <span className="truncate">Search products, orders, invoices...</span>
              </div>
              <span className="hidden sm:inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md bg-white text-[10px] font-bold text-slate-600 border border-slate-300 shadow-2xs">
                <span>Ctrl</span>
                <span>+</span>
                <span>K</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* View Live Customer Storefront */}
            <a
              href={STOREFRONT_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-2xs text-xs font-bold text-slate-700 press-scale"
            >
              <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
              <Store className="w-3.5 h-3.5 text-orange" />
              <span>Customer Storefront</span>
              <span className="w-5 h-5 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 ml-0.5">
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </a>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={toggleNotifications}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 relative shadow-2xs press-scale"
              >
                <Bell className="w-4 h-4" />
                {hasNotifFetched && notifCount > 0 && (
                  <>
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  </>
                )}
              </button>

              {/* Notification Drawer Popover */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-3 z-50 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="font-bold text-xs text-navy uppercase tracking-wider">
                      Business Alerts & Notifications
                    </div>
                    {!isNotifLoading && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          notifCount > 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {notifCount > 0 ? `${notifCount} Pending Action${notifCount > 1 ? 's' : ''}` : 'All Clear'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto text-xs">
                    {isNotifLoading ? (
                      <div className="py-8 flex flex-col items-center justify-center text-slate-400 space-y-2">
                        <Loader2 className="w-5 h-5 animate-spin text-purple" />
                        <span className="text-[11px] font-medium">Checking live alerts...</span>
                      </div>
                    ) : notifCount === 0 ? (
                      <div className="py-8 flex flex-col items-center justify-center text-slate-400 space-y-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        <span className="text-[11px] font-medium">
                          No pending orders or low-stock alerts right now.
                        </span>
                      </div>
                    ) : (
                      <>
                        {notifPendingOrders.map((ord) => (
                          <div
                            key={ord.id}
                            onClick={() => {
                              onNavigateTab(`orders/${ord.id}`);
                              setIsNotificationsOpen(false);
                            }}
                            className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 cursor-pointer hover:bg-amber-100/60 transition-colors"
                          >
                            <div className="flex items-center space-x-1 text-amber-800 font-bold text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Pending Order Awaiting Action</span>
                            </div>
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              <span className="font-mono font-bold">{ord.orderNumber}</span>
                              {ord.customerName ? ` — ${ord.customerName}` : ''} • ₹
                              {(ord.grandTotal || 0).toLocaleString('en-IN')}
                            </p>
                          </div>
                        ))}

                        {notifLowStock.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => {
                              onNavigateTab('inventory');
                              setIsNotificationsOpen(false);
                            }}
                            className="p-2.5 rounded-xl bg-red-50/80 border border-red-200 cursor-pointer hover:bg-red-100/60 transition-colors"
                          >
                            <div className="flex items-center space-x-1 text-red-800 font-bold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                              <span>Low Stock Alert</span>
                            </div>
                            <p className="text-[11px] text-red-700 mt-0.5">
                              <span className="font-bold">{item.productName}</span> down to{' '}
                              {item.quantityAvailable} units
                              {item.warehouseName ? ` in ${item.warehouseName}` : ''} (reorder at{' '}
                              {item.reorderLevel}).
                            </p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
