import React, { useState, useEffect } from 'react';
import {
  Flame,
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Truck,
  DollarSign,
  BarChart3,
  ShieldAlert,
  Settings,
  Search,
  Bell,
  LogOut,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Receipt,
  Users,
  Store,
  Sparkles,
  AlertTriangle,
  Gift,
  Tag,
  Star,
  Image as ImageIcon,
  ArrowLeftRight,
  RotateCcw,
  FileText,
  Activity,
  Key,
  Clock,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GlobalSearchModal } from '../common/GlobalSearchModal';

interface ErpLayoutProps {
  currentTab: string;
  onNavigateTab: (tab: string, params?: any) => void;
  children: React.ReactNode;
}

export const ErpLayout: React.FC<ErpLayoutProps> = ({
  currentTab,
  onNavigateTab,
  children
}) => {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

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

  const navGroups = [
    {
      title: 'CORE',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'SALES & ORDERS',
      items: [
        { id: 'orders', label: 'Orders Management', icon: ShoppingBag, badge: 'Live' },
        { id: 'customers', label: 'Customers CRM', icon: Users },
        { id: 'quotes', label: 'Wholesale Quotes (B2B)', icon: FileText },
        { id: 'invoices', label: 'Tax Invoices', icon: Receipt },
        { id: 'payments', label: 'Payments & UPI', icon: CreditCard },
        { id: 'returns', label: 'Returns & Refunds', icon: RotateCcw }
      ]
    },
    {
      title: 'CATALOG',
      items: [
        { id: 'products', label: 'Products & Gift Boxes', icon: Package },
        { id: 'categories', label: 'Categories & Hierarchy', icon: Layers },
        { id: 'combos', label: 'Combo Offers', icon: Sparkles },
        { id: 'reviews', label: 'Product Reviews', icon: Star },
        { id: 'banners', label: 'Homepage Banners', icon: ImageIcon }
      ]
    },
    {
      title: 'INVENTORY & DEPOTS',
      items: [
        { id: 'inventory', label: 'Stock Overview', icon: Layers, badge: 'Ledger' },
        { id: 'transfers', label: 'Warehouse Transfers', icon: ArrowLeftRight },
        { id: 'low-stock', label: 'Low Stock Alerts', icon: AlertTriangle, badge: '3' }
      ]
    },
    {
      title: 'PURCHASE & SUPPLIERS',
      items: [
        { id: 'purchases', label: 'Purchase Orders & GRN', icon: Truck },
        { id: 'suppliers', label: 'Suppliers Directory', icon: Store },
        { id: 'bills', label: 'Supplier Bills', icon: DollarSign }
      ]
    },
    {
      title: 'FINANCE & ACCOUNTS',
      items: [
        { id: 'finance', label: 'Expenses & P&L', icon: DollarSign },
        { id: 'receivables', label: 'Receivables & Payables', icon: Clock }
      ]
    },
    {
      title: 'MARKETING',
      items: [
        { id: 'coupons', label: 'Coupons & Discounts', icon: Tag }
      ]
    },
    {
      title: 'REPORTS & EXPORTS',
      items: [
        { id: 'reports', label: 'Analytics & CSV Reports', icon: BarChart3 }
      ]
    },
    {
      title: 'SECURITY & AUDIT',
      items: [
        { id: 'audit-logs', label: 'Audit Logs (JSON Diff)', icon: ShieldAlert },
        { id: 'users', label: 'Users & Permissions', icon: Key },
        { id: 'rate-limit-logs', label: 'Rate Limit & Sessions', icon: Activity }
      ]
    },
    {
      title: 'SYSTEM & SETTINGS',
      items: [
        { id: 'settings', label: 'Store & API Settings', icon: Settings },
        { id: 'system-health', label: 'System Health & Backups', icon: ShieldCheck }
      ]
    }
  ];

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
          {/* Brand Logo Header */}
          <div className="p-4 border-b border-[#1d1e4e] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange to-gold flex items-center justify-center shadow-glow">
                <Flame className="w-5 h-5 text-navy fill-current" />
              </div>
              <div>
                <div className="font-black text-white text-sm tracking-wide flex items-center space-x-1">
                  <span>AADHI</span>
                  <span className="text-orange text-[10px] font-bold bg-orange/20 px-1 py-0.2 rounded">ERP</span>
                </div>
                <div className="text-[9px] text-gold font-bold tracking-widest uppercase">
                  Enterprise Suite
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

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {navGroups.map((grp, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <div className="px-3 text-[9px] font-extrabold text-slate-400 tracking-wider uppercase">
                  {grp.title}
                </div>
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigateTab(item.id);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-orange to-orange/80 text-white font-bold shadow-md shadow-orange/20'
                          : 'text-slate-300 hover:bg-[#1a1b4b] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-white text-orange'
                              : 'bg-[#252763] text-gold'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* User Profile & Logout Bottom Bar */}
          <div className="p-3 border-t border-[#1d1e4e] bg-[#0c0d29] flex items-center justify-between">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-purple/30 border border-purple/50 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {(user?.firstName || user?.fullName || 'A').charAt(0)}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-white truncate">
                  {user?.fullName || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email}
                </div>
                <div className="text-[9px] text-emerald-400 font-semibold flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{user?.role}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors"
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
              href="http://localhost:5173"
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
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 relative shadow-2xs"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* Notification Drawer Popover */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-3 z-50 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="font-bold text-xs text-navy uppercase tracking-wider">
                      Business Alerts & Notifications
                    </div>
                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                      3 Pending Actions
                    </span>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto text-xs">
                    <div
                      onClick={() => {
                        onNavigateTab('orders');
                        setIsNotificationsOpen(false);
                      }}
                      className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 cursor-pointer hover:bg-amber-100/60 transition-colors"
                    >
                      <div className="flex items-center space-x-1 text-amber-800 font-bold text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>UPI Payment Verification Required</span>
                      </div>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Order <span className="font-mono font-bold">ORD-2026-001248</span> submitted ₹2,499 with screenshot.
                      </p>
                    </div>

                    <div
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
                        <span className="font-bold">Sparkler Pack Deluxe</span> has fallen below 10 boxes in Sivakasi Central Depot.
                      </p>
                    </div>

                    <div
                      onClick={() => {
                        onNavigateTab('purchases');
                        setIsNotificationsOpen(false);
                      }}
                      className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 cursor-pointer hover:bg-blue-100/60 transition-colors"
                    >
                      <div className="flex items-center space-x-1 text-blue-800 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Purchase Order Approved</span>
                      </div>
                      <p className="text-[11px] text-blue-700 mt-0.5">
                        <span className="font-bold">PO-2026-000088</span> approved for Standard Fireworks raw materials.
                      </p>
                    </div>
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
