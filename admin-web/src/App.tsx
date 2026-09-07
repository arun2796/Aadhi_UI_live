import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Core Components
import { LoginPage } from './pages/auth/LoginPage';
import { ErpLayout } from './components/erp/ErpLayout';
import { ErpLoadingState } from './components/common/ErpLoadingState';
import { ErpUnauthorizedPage } from './components/common/ErpUnauthorizedPage';
import { ErpNotFoundPage } from './components/common/ErpNotFoundPage';

// Lazy Loaded ERP Modules
const ErpDashboardPage = lazy(() => import('./pages/erp/ErpDashboardPage').then(m => ({ default: m.ErpDashboardPage })));
const ErpSalesAndOrdersModule = lazy(() => import('./pages/erp/ErpSalesAndOrdersModule').then(m => ({ default: m.ErpSalesAndOrdersModule })));
const ErpCatalogModule = lazy(() => import('./pages/erp/ErpCatalogModule').then(m => ({ default: m.ErpCatalogModule })));
const ErpProductFormPage = lazy(() => import('./pages/erp/ErpProductFormPage').then(m => ({ default: m.ErpProductFormPage })));
const ErpSubCategoriesPage = lazy(() => import('./pages/erp/ErpSubCategoriesPage').then(m => ({ default: m.ErpSubCategoriesPage })));
const ErpInventoryLedgerModule = lazy(() => import('./pages/erp/ErpInventoryLedgerModule').then(m => ({ default: m.ErpInventoryLedgerModule })));
const ErpPurchaseOrdersModule = lazy(() => import('./pages/erp/ErpPurchaseOrdersModule').then(m => ({ default: m.ErpPurchaseOrdersModule })));
const ErpFinanceAndPnlModule = lazy(() => import('./pages/erp/ErpFinanceAndPnlModule').then(m => ({ default: m.ErpFinanceAndPnlModule })));
const ErpMarketingModule = lazy(() => import('./pages/erp/ErpMarketingModule').then(m => ({ default: m.ErpMarketingModule })));
const ErpEnquiryModule = lazy(() => import('./pages/erp/ErpEnquiryModule').then(m => ({ default: m.ErpEnquiryModule })));
const ErpReportsCenterModule = lazy(() => import('./pages/erp/ErpReportsCenterModule').then(m => ({ default: m.ErpReportsCenterModule })));
const ErpSecurityAndAuditModule = lazy(() => import('./pages/erp/ErpSecurityAndAuditModule').then(m => ({ default: m.ErpSecurityAndAuditModule })));
const ErpSystemHealthAndSettingsModule = lazy(() => import('./pages/erp/ErpSystemHealthAndSettingsModule').then(m => ({ default: m.ErpSystemHealthAndSettingsModule })));

// Protected Route Shell with Role / Permission verification
interface ProtectedAdminShellProps {
  children: React.ReactNode;
  currentTab: string;
  requiredRoles?: string[];
}

function ProtectedAdminShell({ children, currentTab, requiredRoles }: ProtectedAdminShellProps) {
  const { isAuthenticated, isInitializing, user } = useAuth();
  const navigate = useNavigate();

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#07081c] flex items-center justify-center text-white font-sans">
        <ErpLoadingState message="Verifying ERP security session..." height="h-32" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0 && user?.role) {
    if (!requiredRoles.includes(user.role) && user.role !== 'SuperAdmin' && user.role !== 'Admin') {
      return (
        <ErpLayout currentTab={currentTab} onNavigateTab={(tab) => navigate(`/admin/${tab}`)}>
          <ErpUnauthorizedPage />
        </ErpLayout>
      );
    }
  }

  const handleTabNavigation = (tab: string) => {
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
      combos: '/admin/combo-offers',
      reviews: '/admin/reviews',
      banners: '/admin/banners',
      inventory: '/admin/inventory',
      transfers: '/admin/stock-transfers',
      'low-stock': '/admin/inventory/low-stock',
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
      'audit-logs': '/admin/audit-logs',
      users: '/admin/users',
      'rate-limit-logs': '/admin/rate-limit-logs',
      sessions: '/admin/login-history',
      settings: '/admin/settings',
      'system-health': '/admin/system-health',
      backup: '/admin/backup'
    };
    let targetRoute = routeMap[tab];
    if (!targetRoute) {
      if (tab.startsWith('/admin/')) {
        targetRoute = tab;
      } else if (tab.startsWith('/')) {
        targetRoute = `/admin${tab}`;
      } else {
        targetRoute = `/admin/${tab}`;
      }
    }
    navigate(targetRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ErpLayout currentTab={currentTab} onNavigateTab={handleTabNavigation}>
      <Suspense fallback={<ErpLoadingState message="Loading module view..." height="h-96" />}>
        {children}
      </Suspense>
    </ErpLayout>
  );
}

// Sub-route Wrappers that pass Route Params
function OrderDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  return <ErpSalesAndOrdersModule initialSubTab="orders" initialSelectedOrderId={id} />;
}

function ProductFormWrapper() {
  const { id } = useParams<{ id: string }>();
  return <ErpProductFormPage productId={id} />;
}

function CategoryDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  return <ErpCatalogModule initialSubTab="categories" initialSelectedCategoryId={id} />;
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

      {/* Sales & Orders (§5) */}
      <Route path="/admin/orders" element={<ProtectedAdminShell currentTab="orders"><ErpSalesAndOrdersModule initialSubTab="orders" /></ProtectedAdminShell>} />
      <Route path="/admin/orders/:id" element={<ProtectedAdminShell currentTab="orders"><OrderDetailWrapper /></ProtectedAdminShell>} />
      <Route path="/admin/customers" element={<ProtectedAdminShell currentTab="customers"><ErpSalesAndOrdersModule initialSubTab="customers" /></ProtectedAdminShell>} />
      <Route path="/admin/customers/:id" element={<ProtectedAdminShell currentTab="customers"><ErpSalesAndOrdersModule initialSubTab="customers" /></ProtectedAdminShell>} />
      <Route path="/admin/quotes" element={<ProtectedAdminShell currentTab="quotes"><ErpSalesAndOrdersModule initialSubTab="quotes" /></ProtectedAdminShell>} />
      <Route path="/admin/invoices" element={<ProtectedAdminShell currentTab="invoices"><ErpSalesAndOrdersModule initialSubTab="invoices" /></ProtectedAdminShell>} />
      <Route path="/admin/invoices/:id" element={<ProtectedAdminShell currentTab="invoices"><ErpSalesAndOrdersModule initialSubTab="invoices" /></ProtectedAdminShell>} />
      <Route path="/admin/payments" element={<ProtectedAdminShell currentTab="payments"><ErpSalesAndOrdersModule initialSubTab="payments" /></ProtectedAdminShell>} />
      <Route path="/admin/payments/:id" element={<ProtectedAdminShell currentTab="payments"><ErpSalesAndOrdersModule initialSubTab="payments" /></ProtectedAdminShell>} />
      <Route path="/admin/returns" element={<ProtectedAdminShell currentTab="returns"><ErpSalesAndOrdersModule initialSubTab="returns" /></ProtectedAdminShell>} />
      <Route path="/admin/returns/:id" element={<ProtectedAdminShell currentTab="returns"><ErpSalesAndOrdersModule initialSubTab="returns" /></ProtectedAdminShell>} />

      {/* Catalog (§5) */}
      <Route path="/admin/products" element={<ProtectedAdminShell currentTab="products"><ErpCatalogModule initialSubTab="products" /></ProtectedAdminShell>} />
      <Route path="/admin/products/new" element={<ProtectedAdminShell currentTab="products"><ErpProductFormPage /></ProtectedAdminShell>} />
      <Route path="/admin/products/:id" element={<ProtectedAdminShell currentTab="products"><ProductFormWrapper /></ProtectedAdminShell>} />
      <Route path="/admin/products/:id/edit" element={<ProtectedAdminShell currentTab="products"><ProductFormWrapper /></ProtectedAdminShell>} />
      <Route path="/admin/categories" element={<ProtectedAdminShell currentTab="categories"><ErpCatalogModule initialSubTab="categories" /></ProtectedAdminShell>} />
      <Route path="/admin/categories/:id" element={<ProtectedAdminShell currentTab="categories"><CategoryDetailWrapper /></ProtectedAdminShell>} />
      <Route path="/admin/sub-categories" element={<ProtectedAdminShell currentTab="sub-categories"><ErpSubCategoriesPage /></ProtectedAdminShell>} />
      <Route path="/admin/brands" element={<ProtectedAdminShell currentTab="products"><ErpCatalogModule initialSubTab="products" /></ProtectedAdminShell>} />
      <Route path="/admin/gift-boxes" element={<ProtectedAdminShell currentTab="combos"><ErpCatalogModule initialSubTab="combos" /></ProtectedAdminShell>} />
      <Route path="/admin/gift-boxes/:id" element={<ProtectedAdminShell currentTab="combos"><ErpCatalogModule initialSubTab="combos" /></ProtectedAdminShell>} />
      <Route path="/admin/combo-offers" element={<ProtectedAdminShell currentTab="combos"><ErpCatalogModule initialSubTab="combos" /></ProtectedAdminShell>} />
      <Route path="/admin/combo-offers/:id" element={<ProtectedAdminShell currentTab="combos"><ErpCatalogModule initialSubTab="combos" /></ProtectedAdminShell>} />
      <Route path="/admin/reviews" element={<ProtectedAdminShell currentTab="reviews"><ErpCatalogModule initialSubTab="reviews" /></ProtectedAdminShell>} />
      <Route path="/admin/banners" element={<ProtectedAdminShell currentTab="banners"><ErpCatalogModule initialSubTab="banners" /></ProtectedAdminShell>} />

      {/* Inventory & Warehouses (§5) */}
      <Route path="/admin/inventory" element={<ProtectedAdminShell currentTab="inventory"><ErpInventoryLedgerModule initialSubTab="overview" /></ProtectedAdminShell>} />
      <Route path="/admin/inventory/movements" element={<ProtectedAdminShell currentTab="inventory"><ErpInventoryLedgerModule initialSubTab="transfers" /></ProtectedAdminShell>} />
      <Route path="/admin/inventory/adjustments" element={<ProtectedAdminShell currentTab="inventory"><ErpInventoryLedgerModule initialSubTab="overview" /></ProtectedAdminShell>} />
      <Route path="/admin/inventory/low-stock" element={<ProtectedAdminShell currentTab="low-stock"><ErpInventoryLedgerModule initialSubTab="low-stock" /></ProtectedAdminShell>} />
      <Route path="/admin/warehouses" element={<ProtectedAdminShell currentTab="warehouses"><ErpInventoryLedgerModule initialSubTab="warehouses" /></ProtectedAdminShell>} />
      <Route path="/admin/warehouses/:id" element={<ProtectedAdminShell currentTab="warehouses"><ErpInventoryLedgerModule initialSubTab="warehouses" /></ProtectedAdminShell>} />
      <Route path="/admin/stock-transfers" element={<ProtectedAdminShell currentTab="transfers"><ErpInventoryLedgerModule initialSubTab="transfers" /></ProtectedAdminShell>} />
      <Route path="/admin/stock-transfers/:id" element={<ProtectedAdminShell currentTab="transfers"><ErpInventoryLedgerModule initialSubTab="transfers" /></ProtectedAdminShell>} />

      {/* Purchases & Suppliers (§5) */}
      <Route path="/admin/suppliers" element={<ProtectedAdminShell currentTab="suppliers"><ErpPurchaseOrdersModule initialSubTab="suppliers" /></ProtectedAdminShell>} />
      <Route path="/admin/suppliers/:id" element={<ProtectedAdminShell currentTab="suppliers"><ErpPurchaseOrdersModule initialSubTab="suppliers" /></ProtectedAdminShell>} />
      <Route path="/admin/purchases" element={<ProtectedAdminShell currentTab="purchases"><ErpPurchaseOrdersModule initialSubTab="purchases" /></ProtectedAdminShell>} />
      <Route path="/admin/purchases/:id" element={<ProtectedAdminShell currentTab="purchases"><ErpPurchaseOrdersModule initialSubTab="purchases" /></ProtectedAdminShell>} />
      <Route path="/admin/goods-received" element={<ProtectedAdminShell currentTab="grn"><ErpPurchaseOrdersModule initialSubTab="grn" /></ProtectedAdminShell>} />
      <Route path="/admin/goods-received/:id" element={<ProtectedAdminShell currentTab="grn"><ErpPurchaseOrdersModule initialSubTab="grn" /></ProtectedAdminShell>} />
      <Route path="/admin/supplier-bills" element={<ProtectedAdminShell currentTab="bills"><ErpPurchaseOrdersModule initialSubTab="bills" /></ProtectedAdminShell>} />

      {/* Finance & Expenses (§5) */}
      <Route path="/admin/finance" element={<ProtectedAdminShell currentTab="finance"><ErpFinanceAndPnlModule initialSubTab="pnl" /></ProtectedAdminShell>} />
      <Route path="/admin/expenses" element={<ProtectedAdminShell currentTab="expenses"><ErpFinanceAndPnlModule initialSubTab="expenses" /></ProtectedAdminShell>} />
      <Route path="/admin/receivables" element={<ProtectedAdminShell currentTab="receivables"><ErpFinanceAndPnlModule initialSubTab="receivables" /></ProtectedAdminShell>} />
      <Route path="/admin/payables" element={<ProtectedAdminShell currentTab="payables"><ErpFinanceAndPnlModule initialSubTab="payables" /></ProtectedAdminShell>} />

      {/* Marketing (§5) */}
      <Route path="/admin/marketing/coupons" element={<ProtectedAdminShell currentTab="coupons"><ErpMarketingModule /></ProtectedAdminShell>} />

      {/* Enquiries */}
      <Route path="/admin/enquiries" element={<ProtectedAdminShell currentTab="enquiries"><ErpEnquiryModule initialSubTab="enquiries" /></ProtectedAdminShell>} />
      <Route path="/admin/enquiries/direct" element={<ProtectedAdminShell currentTab="enquiries-direct"><ErpEnquiryModule initialSubTab="direct" /></ProtectedAdminShell>} />
      <Route path="/admin/enquiries/customers" element={<ProtectedAdminShell currentTab="enquiries-customers"><ErpEnquiryModule initialSubTab="customers" /></ProtectedAdminShell>} />
      <Route path="/admin/enquiries/:id" element={<ProtectedAdminShell currentTab="enquiries"><ErpEnquiryModule initialSubTab="enquiries" /></ProtectedAdminShell>} />

      {/* Reports (§5) */}
      <Route path="/admin/reports" element={<ProtectedAdminShell currentTab="reports"><ErpReportsCenterModule /></ProtectedAdminShell>} />

      {/* Security & Audit (§5) */}
      <Route path="/admin/audit-logs" element={<ProtectedAdminShell currentTab="audit-logs"><ErpSecurityAndAuditModule initialSubTab="audit" /></ProtectedAdminShell>} />
      <Route path="/admin/login-history" element={<ProtectedAdminShell currentTab="sessions"><ErpSecurityAndAuditModule initialSubTab="sessions" /></ProtectedAdminShell>} />
      <Route path="/admin/rate-limit-logs" element={<ProtectedAdminShell currentTab="rate-limit-logs"><ErpSecurityAndAuditModule initialSubTab="rate-limits" /></ProtectedAdminShell>} />
      <Route path="/admin/users" element={<ProtectedAdminShell currentTab="users"><ErpSecurityAndAuditModule initialSubTab="users" /></ProtectedAdminShell>} />
      <Route path="/admin/roles" element={<ProtectedAdminShell currentTab="users"><ErpSecurityAndAuditModule initialSubTab="users" /></ProtectedAdminShell>} />
      <Route path="/admin/permissions" element={<ProtectedAdminShell currentTab="users"><ErpSecurityAndAuditModule initialSubTab="users" /></ProtectedAdminShell>} />

      {/* Settings & Health (§5) */}
      <Route path="/admin/settings" element={<ProtectedAdminShell currentTab="settings"><ErpSystemHealthAndSettingsModule initialSubTab="settings" /></ProtectedAdminShell>} />
      <Route path="/admin/system-health" element={<ProtectedAdminShell currentTab="system-health"><ErpSystemHealthAndSettingsModule initialSubTab="health" /></ProtectedAdminShell>} />
      <Route path="/admin/backup" element={<ProtectedAdminShell currentTab="backup"><ErpSystemHealthAndSettingsModule initialSubTab="backup" /></ProtectedAdminShell>} />

      {/* System Error Pages */}
      <Route path="/admin/unauthorized" element={<ProtectedAdminShell currentTab="dashboard"><ErpUnauthorizedPage /></ProtectedAdminShell>} />
      <Route path="/admin/404" element={<ProtectedAdminShell currentTab="dashboard"><ErpNotFoundPage /></ProtectedAdminShell>} />

      {/* Root & Fallback Redirection */}
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<ProtectedAdminShell currentTab="dashboard"><ErpNotFoundPage /></ProtectedAdminShell>} />
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
