import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// ERP Layout & Pages
import { ErpLayout } from './components/erp/ErpLayout';
import { ErpDashboardPage } from './pages/erp/ErpDashboardPage';
import { ErpOrdersPage } from './pages/erp/ErpOrdersPage';
import { ErpProductsPage } from './pages/erp/ErpProductsPage';
import { ErpInventoryPage } from './pages/erp/ErpInventoryPage';
import { ErpPurchasesPage, ErpFinancePage, ErpReportsPage } from './pages/erp/ErpPurchasesAndFinancePages';
import { ErpAuditLogsPage } from './pages/erp/ErpAuditLogsPage';
import { ErpSettingsPage } from './pages/erp/ErpSettingsPage';

function AdminMainApp() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  return (
    <div className="min-h-screen bg-[#0a0b24] text-slate-100 font-sans">
      <ErpLayout
        currentTab={currentTab}
        onNavigateTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        {currentTab === 'dashboard' && (
          <ErpDashboardPage onNavigateTab={(tab) => setCurrentTab(tab)} />
        )}
        {currentTab === 'orders' && <ErpOrdersPage />}
        {currentTab === 'products' && <ErpProductsPage />}
        {currentTab === 'inventory' && <ErpInventoryPage />}
        {currentTab === 'purchases' && <ErpPurchasesPage />}
        {(currentTab === 'invoices' || currentTab === 'payments' || currentTab === 'finance') && (
          <ErpFinancePage />
        )}
        {currentTab === 'reports' && <ErpReportsPage />}
        {currentTab === 'audit-logs' && <ErpAuditLogsPage />}
        {currentTab === 'settings' && <ErpSettingsPage />}
      </ErpLayout>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AdminMainApp />
      </ToastProvider>
    </AuthProvider>
  );
}
