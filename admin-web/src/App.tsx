import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Pages & Components
import { LoginPage } from './pages/auth/LoginPage';
import { ErpLayout } from './components/erp/ErpLayout';
import { ErpDashboardPage } from './pages/erp/ErpDashboardPage';
import { ErpSalesAndOrdersModule } from './pages/erp/ErpSalesAndOrdersModule';
import { ErpCatalogModule } from './pages/erp/ErpCatalogModule';
import { ErpInventoryLedgerModule } from './pages/erp/ErpInventoryLedgerModule';
import { ErpPurchaseOrdersModule } from './pages/erp/ErpPurchaseOrdersModule';
import { ErpFinanceAndPnlModule } from './pages/erp/ErpFinanceAndPnlModule';
import { ErpMarketingModule } from './pages/erp/ErpMarketingModule';
import { ErpReportsCenterModule } from './pages/erp/ErpReportsCenterModule';
import { ErpSecurityAndAuditModule } from './pages/erp/ErpSecurityAndAuditModule';
import { ErpSystemHealthAndSettingsModule } from './pages/erp/ErpSystemHealthAndSettingsModule';

// Protected Route Shell
function ProtectedAdminShell({ children, currentTab }: { children: React.ReactNode; currentTab: string }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#07081c] flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-bold">Verifying ERP Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ErpLayout
      currentTab={currentTab}
      onNavigateTab={(tab) => {
        const routeMap: Record<string, string> = {
          dashboard: '/admin/dashboard',
          orders: '/admin/orders',
          customers: '/admin/customers',
          quotes: '/admin/quotes',
          invoices: '/admin/invoices',
          payments: '/admin/payments',
          returns: '/admin/returns',
          products: '/admin/products',
          categories: '/admin/categories',
          combos: '/admin/combos',
          reviews: '/admin/reviews',
          banners: '/admin/banners',
          inventory: '/admin/inventory',
          transfers: '/admin/transfers',
          'low-stock': '/admin/low-stock',
          warehouses: '/admin/warehouses',
          purchases: '/admin/purchases',
          suppliers: '/admin/suppliers',
          grn: '/admin/goods-received',
          bills: '/admin/supplier-bills',
          finance: '/admin/finance',
          expenses: '/admin/expenses',
          receivables: '/admin/receivables',
          payables: '/admin/payables',
          coupons: '/admin/marketing/coupons',
          reports: '/admin/reports',
          'audit-logs': '/admin/security/audit-logs',
          users: '/admin/security/users',
          'rate-limit-logs': '/admin/security/rate-limits',
          sessions: '/admin/security/sessions',
          settings: '/admin/settings',
          'system-health': '/admin/system-health',
          backup: '/admin/backup'
        };
        const targetRoute = routeMap[tab] || '/admin/dashboard';
        navigate(targetRoute);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      {children}
    </ErpLayout>
  );
}

function AdminAppRoutes() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <Routes>
      {/* Public Login Route */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <LoginPage onSuccess={() => navigate('/admin/dashboard')} />
        }
      />

      {/* Dashboard */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedAdminShell currentTab="dashboard">
            <ErpDashboardPage onNavigateTab={(tab) => navigate(`/admin/${tab}`)} />
          </ProtectedAdminShell>
        }
      />

      {/* Sales & Orders */}
      <Route path="/admin/orders" element={<ProtectedAdminShell currentTab="orders"><ErpSalesAndOrdersModule initialSubTab="orders" /></ProtectedAdminShell>} />
      <Route path="/admin/customers" element={<ProtectedAdminShell currentTab="customers"><ErpSalesAndOrdersModule initialSubTab="customers" /></ProtectedAdminShell>} />
      <Route path="/admin/quotes" element={<ProtectedAdminShell currentTab="quotes"><ErpSalesAndOrdersModule initialSubTab="quotes" /></ProtectedAdminShell>} />
      <Route path="/admin/invoices" element={<ProtectedAdminShell currentTab="invoices"><ErpSalesAndOrdersModule initialSubTab="invoices" /></ProtectedAdminShell>} />
      <Route path="/admin/payments" element={<ProtectedAdminShell currentTab="payments"><ErpSalesAndOrdersModule initialSubTab="payments" /></ProtectedAdminShell>} />
      <Route path="/admin/returns" element={<ProtectedAdminShell currentTab="returns"><ErpSalesAndOrdersModule initialSubTab="returns" /></ProtectedAdminShell>} />

      {/* Catalog */}
      <Route path="/admin/products" element={<ProtectedAdminShell currentTab="products"><ErpCatalogModule initialSubTab="products" /></ProtectedAdminShell>} />
      <Route path="/admin/categories" element={<ProtectedAdminShell currentTab="categories"><ErpCatalogModule initialSubTab="categories" /></ProtectedAdminShell>} />
      <Route path="/admin/combos" element={<ProtectedAdminShell currentTab="combos"><ErpCatalogModule initialSubTab="combos" /></ProtectedAdminShell>} />
      <Route path="/admin/reviews" element={<ProtectedAdminShell currentTab="reviews"><ErpCatalogModule initialSubTab="reviews" /></ProtectedAdminShell>} />
      <Route path="/admin/banners" element={<ProtectedAdminShell currentTab="banners"><ErpCatalogModule initialSubTab="banners" /></ProtectedAdminShell>} />

      {/* Inventory */}
      <Route path="/admin/inventory" element={<ProtectedAdminShell currentTab="inventory"><ErpInventoryLedgerModule initialSubTab="overview" /></ProtectedAdminShell>} />
      <Route path="/admin/transfers" element={<ProtectedAdminShell currentTab="transfers"><ErpInventoryLedgerModule initialSubTab="transfers" /></ProtectedAdminShell>} />
      <Route path="/admin/low-stock" element={<ProtectedAdminShell currentTab="low-stock"><ErpInventoryLedgerModule initialSubTab="low-stock" /></ProtectedAdminShell>} />
      <Route path="/admin/warehouses" element={<ProtectedAdminShell currentTab="warehouses"><ErpInventoryLedgerModule initialSubTab="warehouses" /></ProtectedAdminShell>} />

      {/* Purchases & Suppliers */}
      <Route path="/admin/purchases" element={<ProtectedAdminShell currentTab="purchases"><ErpPurchaseOrdersModule initialSubTab="purchases" /></ProtectedAdminShell>} />
      <Route path="/admin/suppliers" element={<ProtectedAdminShell currentTab="suppliers"><ErpPurchaseOrdersModule initialSubTab="suppliers" /></ProtectedAdminShell>} />
      <Route path="/admin/goods-received" element={<ProtectedAdminShell currentTab="grn"><ErpPurchaseOrdersModule initialSubTab="grn" /></ProtectedAdminShell>} />
      <Route path="/admin/supplier-bills" element={<ProtectedAdminShell currentTab="bills"><ErpPurchaseOrdersModule initialSubTab="bills" /></ProtectedAdminShell>} />

      {/* Finance & P&L */}
      <Route path="/admin/finance" element={<ProtectedAdminShell currentTab="finance"><ErpFinanceAndPnlModule initialSubTab="pnl" /></ProtectedAdminShell>} />
      <Route path="/admin/expenses" element={<ProtectedAdminShell currentTab="expenses"><ErpFinanceAndPnlModule initialSubTab="expenses" /></ProtectedAdminShell>} />
      <Route path="/admin/receivables" element={<ProtectedAdminShell currentTab="receivables"><ErpFinanceAndPnlModule initialSubTab="receivables" /></ProtectedAdminShell>} />
      <Route path="/admin/payables" element={<ProtectedAdminShell currentTab="payables"><ErpFinanceAndPnlModule initialSubTab="payables" /></ProtectedAdminShell>} />

      {/* Marketing */}
      <Route path="/admin/marketing/coupons" element={<ProtectedAdminShell currentTab="coupons"><ErpMarketingModule /></ProtectedAdminShell>} />

      {/* Reports */}
      <Route path="/admin/reports" element={<ProtectedAdminShell currentTab="reports"><ErpReportsCenterModule /></ProtectedAdminShell>} />

      {/* Security */}
      <Route path="/admin/security/audit-logs" element={<ProtectedAdminShell currentTab="audit-logs"><ErpSecurityAndAuditModule initialSubTab="audit" /></ProtectedAdminShell>} />
      <Route path="/admin/security/users" element={<ProtectedAdminShell currentTab="users"><ErpSecurityAndAuditModule initialSubTab="users" /></ProtectedAdminShell>} />
      <Route path="/admin/security/rate-limits" element={<ProtectedAdminShell currentTab="rate-limit-logs"><ErpSecurityAndAuditModule initialSubTab="rate-limits" /></ProtectedAdminShell>} />
      <Route path="/admin/security/sessions" element={<ProtectedAdminShell currentTab="sessions"><ErpSecurityAndAuditModule initialSubTab="sessions" /></ProtectedAdminShell>} />

      {/* Settings & Health */}
      <Route path="/admin/settings" element={<ProtectedAdminShell currentTab="settings"><ErpSystemHealthAndSettingsModule initialSubTab="settings" /></ProtectedAdminShell>} />
      <Route path="/admin/system-health" element={<ProtectedAdminShell currentTab="system-health"><ErpSystemHealthAndSettingsModule initialSubTab="health" /></ProtectedAdminShell>} />
      <Route path="/admin/backup" element={<ProtectedAdminShell currentTab="backup"><ErpSystemHealthAndSettingsModule initialSubTab="backup" /></ProtectedAdminShell>} />

      {/* Root & Fallback Redirection */}
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AdminAppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
