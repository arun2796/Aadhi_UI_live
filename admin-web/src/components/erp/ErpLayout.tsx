import React, { useState } from 'react';
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
  FileSpreadsheet,
  Users,
  Store,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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

  const navGroups = [
    {
      title: 'CORE',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'SALES & CUSTOMERS',
      items: [
        { id: 'orders', label: 'Orders Management', icon: ShoppingBag, badge: '17' },
        { id: 'invoices', label: 'Invoices', icon: Receipt },
        { id: 'payments', label: 'Payments', icon: CreditCard }
      ]
    },
    {
      title: 'CATALOG & INVENTORY',
      items: [
        { id: 'products', label: 'Products & Gift Boxes', icon: Package },
        { id: 'inventory', label: 'Stock & Warehouses', icon: Layers, badge: '23' }
      ]
    },
    {
      title: 'PURCHASE & SUPPLIERS',
      items: [
        { id: 'purchases', label: 'Purchase Orders & GRN', icon: Truck }
      ]
    },
    {
      title: 'FINANCE & REPORTS',
      items: [
        { id: 'finance', label: 'Expenses & P&L', icon: DollarSign },
        { id: 'reports', label: 'Analytics & CSV Export', icon: BarChart3 }
      ]
    },
    {
      title: 'SYSTEM & SECURITY',
      items: [
        { id: 'audit-logs', label: 'Audit Logs (JSON Diff)', icon: ShieldAlert },
        { id: 'settings', label: 'Store & API Settings', icon: Settings }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-800 font-sans">
      {/* Dark Navy Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-50 h-screen w-64 bg-[#111238] text-slate-300 flex flex-col justify-between border-r border-[#1d1e4e] transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo Brand Header */}
          <div className="p-5 border-b border-[#1d1e4e] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange to-gold flex items-center justify-center shadow-glow">
                <Flame className="w-5 h-5 text-navy fill-current" />
              </div>
              <div>
                <div className="font-black text-white text-base tracking-wide flex items-center space-x-1">
                  <span>AADHI</span>
                  <span className="text-orange text-xs font-semibold">ERP</span>
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
          <div className="flex-1 overflow-y-auto p-3 space-y-6">
            {navGroups.map((grp, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <div className="px-3 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">
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
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-orange text-white shadow-glow font-bold'
                          : 'text-slate-300 hover:bg-[#1d1e4e] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white text-orange' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Sidebar Bottom System Status Card */}
          <div className="p-3 border-t border-[#1d1e4e]">
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple/40 to-navy-light border border-purple/30 text-white space-y-2">
              <div className="flex items-center space-x-1.5 text-gold text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-orange" />
                <span>Festival Campaign</span>
              </div>
              <div className="text-[11px] text-slate-200 leading-tight">
                Diwali 2026 early bookings active with 15% discount code.
              </div>
              <div className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Backend Connected (Port 5050)</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content View */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top ERP Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center space-x-3 flex-1 max-w-md">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search orders, SKU, customers, stock..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 relative"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 animate-slide-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <span className="font-bold text-xs text-navy">System Notifications</span>
                    <span className="text-[10px] text-orange font-bold">3 New</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-orange/5 border border-orange/15 text-slate-700">
                      <strong className="text-navy block">Low Stock Alert:</strong>
                      Flower Pots (Big) stock dropped to 120 units (Reorder level 200).
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-slate-700">
                      <strong className="text-navy block">New Order:</strong>
                      ORD#1248 received from Ramesh Kumar (₹2,499).
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="flex items-center space-x-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-navy text-gold flex items-center justify-center font-bold text-xs shadow-xs">
                AK
              </div>
              <div className="hidden sm:block text-left text-xs">
                <div className="font-bold text-navy leading-tight">Arun Kumar</div>
                <div className="text-[10px] text-slate-400 font-semibold">SuperAdmin</div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};
