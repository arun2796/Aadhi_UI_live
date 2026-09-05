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
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { api } from '../../services/api';
import { Order, StockItem } from '../../types';

interface ErpLayoutProps {
  currentTab: string;
  onNavigateTab: (tab: string, params?: any) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

// Flat primary navigation — order matches the ERP design (01_dashboard.png)
const MAIN_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'orders?tab=confirm', label: 'Order Confirm', icon: ClipboardCheck, badge: 'NEW' },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'sub-categories', label: 'Sub Categories', icon: FolderTree },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'purchases', label: 'Purchase', icon: Truck },
  { id: 'finance', label: 'Sales', icon: TrendingUp },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'suppliers', label: 'Suppliers', icon: Store },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'coupons', label: 'Offers / Discounts', icon: Tag },
  { id: 'reports', label: 'Reports', icon: BarChart3 }
];

// Everything else stays reachable under a collapsible "More" section
const MORE_NAV: NavItem[] = [
  { id: 'quotes', label: 'Quotes (B2B)', icon: FileText },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'combos', label: 'Gift Boxes / Combos', icon: Gift },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'banners', label: 'Banners', icon: ImageIcon },
  { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
  { id: 'transfers', label: 'Stock Transfers', icon: ArrowLeftRight },
  { id: 'low-stock', label: 'Low Stock Alerts', icon: AlertTriangle },
  { id: 'grn', label: 'Goods Received', icon: PackageCheck },
  { id: 'bills', label: 'Supplier Bills', icon: DollarSign },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'receivables', label: 'Receivables', icon: Clock },
  { id: 'payables', label: 'Payables', icon: Banknote },
  { id: 'audit-logs', label: 'Audit Logs', icon: ShieldAlert },
  { id: 'sessions', label: 'Login History', icon: History },
  { id: 'rate-limit-logs', label: 'Rate Limits', icon: Activity },
  { id: 'users', label: 'Users & Roles', icon: UserCog },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'system-health', label: 'System Health', icon: ShieldCheck },
  { id: 'backup', label: 'Backup', icon: Database }
];

const STOREFRONT_URL: string = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173';

export const ErpLayout: React.FC<ErpLayoutProps> = ({
  currentTab,
  onNavigateTab,
  children
}) => {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(() => MORE_NAV.some((i) => i.id === currentTab));

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

  // Keep the "More" section expanded whenever the active route lives inside it
  useEffect(() => {
    if (MORE_NAV.some((i) => i.id === currentTab)) {
      setIsMoreOpen(true);
    }
  }, [currentTab]);

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

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => {
          onNavigateTab(item.id);
          setIsSidebarOpen(false);
        }}
        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
          isActive
            ? 'bg-[#23255b] border-[#34377c] text-white font-bold'
            : 'border-transparent text-slate-300 hover:bg-[#1a1b4b] hover:text-white'
        }`}
      >
        <div className="flex items-center space-x-2.5">
          <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-gold' : 'text-slate-400'}`} />
          <span className="truncate text-left">{item.label}</span>
        </div>
        {item.badge && (
          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-500 text-white tracking-wider flex-shrink-0">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-800 font-sans">
      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onNavigateTab={onNavigateTab}
      />

      {/* Dark Navy Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-[#111238] text-slate-300 flex flex-col justify-between border-r border-[#1d1e4e] transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Brand Logo Header — gold AADHI CRACKERS wordmark */}
          <div className="p-4 border-b border-[#1d1e4e] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple to-navy border border-[#2b2d6b] flex items-center justify-center shadow-glow flex-shrink-0">
                <Flame className="w-5 h-5 text-orange fill-current" />
              </div>
              <div className="leading-tight">
                <div className="font-black text-gold text-base tracking-wide">AADHI</div>
                <div className="text-[10px] text-gold font-bold tracking-[0.3em] uppercase -mt-0.5">
                  Crackers
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

          {/* Flat Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {MAIN_NAV.map(renderNavItem)}

            {/* Collapsible "More" section */}
            <div className="pt-3">
              <button
                onClick={() => setIsMoreOpen((v) => !v)}
                className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-[10px] font-extrabold text-slate-400 tracking-wider uppercase hover:text-white hover:bg-[#1a1b4b] transition-colors"
              >
                <span>More</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isMoreOpen && (
                <div className="mt-1 space-y-1">{MORE_NAV.map(renderNavItem)}</div>
              )}
            </div>
          </nav>

          {/* User Profile & Logout Bottom Card */}
          <div className="p-3 border-t border-[#1d1e4e] bg-[#0c0d29] flex items-center justify-between">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple/60 to-gold/40 border border-gold/40 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                {(user?.firstName || user?.fullName || 'A').charAt(0)}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-white truncate">
                  {user?.fullName || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold truncate">
                  {user?.role}
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search Button Trigger */}
            <div
              onClick={() => setIsGlobalSearchOpen(true)}
              className="w-48 sm:w-72 md:w-96 bg-slate-100 hover:bg-slate-200/70 cursor-pointer rounded-xl px-3 py-2 flex items-center justify-between text-xs text-slate-400 transition-colors border border-slate-200"
            >
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-slate-400" />
                <span className="truncate">Search products, orders, invoices...</span>
              </div>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-slate-600 border border-slate-300 shadow-2xs">
                Ctrl+K
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* View Live Customer Storefront */}
            <a
              href={STOREFRONT_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Store className="w-3.5 h-3.5 text-orange" />
              <span>Customer Storefront</span>
              <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
            </a>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={toggleNotifications}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 relative shadow-2xs"
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
