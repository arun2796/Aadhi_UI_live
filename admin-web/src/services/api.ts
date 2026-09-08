// Central Re-Export & Unified API Service Adapter
export * from './apiClient';
export * from './authApi';
export * from './productApi';
export * from './categoryApi';
export * from './brandApi';
export * from './orderApi';
export * from './customerApi';
export * from './invoiceApi';
export * from './paymentApi';
export * from './financeApi';
export * from './reportApi';
export * from './auditApi';
export * from './settingsApi';

import { apiClient, TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT, getApiErrorDetails, wrapPagedResult } from './apiClient';
import { authApi } from './authApi';
import { productApi } from './productApi';
import { categoryApi } from './categoryApi';
import { brandApi } from './brandApi';
import { orderApi } from './orderApi';
import { customerApi } from './customerApi';
import { invoiceApi } from './invoiceApi';
import { paymentApi } from './paymentApi';
import { financeApi } from './financeApi';
import { reportApi } from './reportApi';
import { auditApi } from './auditApi';
import { settingsApi } from './settingsApi';
import {
  Order,
  StoreSettings,
  Coupon,
  GiftBox,
  ComboOffer,
  ProductReview,
  HomepageBanner,
  ProfitAndLossStatement,
  ReceivableItem
} from '../types';

export { apiClient, TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT, getApiErrorDetails };

// Complete Unified `api` Object matching existing component calls
export const api = {
  // Global Search
  searchGlobal: async (query: string) => {
    if (!query || !query.trim()) {
      return { products: [], orders: [], customers: [], invoices: [] };
    }
    const [productsRes, ordersRes, customersRes, invoicesRes] = await Promise.allSettled([
      productApi.getProducts({ search: query, pageSize: 5 }),
      orderApi.getOrders({ search: query, pageSize: 5 }),
      customerApi.getCustomers({ search: query, pageSize: 5 }),
      invoiceApi.getInvoices(1, 10)
    ]);

    const products = productsRes.status === 'fulfilled' ? (productsRes.value.items || productsRes.value || []) : [];
    const orders = ordersRes.status === 'fulfilled' ? (ordersRes.value.items || ordersRes.value || []) : [];
    const customers = customersRes.status === 'fulfilled' ? (customersRes.value.items || customersRes.value || []) : [];
    const rawInvoices = invoicesRes.status === 'fulfilled' ? (invoicesRes.value.items || invoicesRes.value || []) : [];

    const lowerQuery = query.toLowerCase();
    const invoices = rawInvoices.filter((inv: any) =>
      inv.invoiceNumber?.toLowerCase().includes(lowerQuery) ||
      inv.customerName?.toLowerCase().includes(lowerQuery) ||
      inv.orderNumber?.toLowerCase().includes(lowerQuery)
    );

    return {
      products: products.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku, price: p.price })),
      orders: orders.map((o: any) => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, grandTotal: o.grandTotal, status: o.orderStatus })),
      customers: customers.map((c: any) => ({ id: c.id, name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(), phone: c.phone, email: c.email })),
      invoices: invoices.map((i: any) => ({ id: i.id, invoiceNumber: i.invoiceNumber, customerName: i.customerName, grandTotal: i.grandTotal, status: i.status }))
    };
  },

  // Auth
  login: authApi.login,
  getMe: authApi.getMe,
  getUsers: authApi.getUsers,
  updateUserRole: authApi.updateUserRole,
  getLoginHistory: authApi.getLoginHistory,
  getRateLimitLogs: authApi.getRateLimitLogs,

  // Products & Catalog
  getProducts: productApi.getProducts,
  getProductById: productApi.getProductById,
  getProductBySlug: productApi.getProductBySlug,
  createProduct: productApi.createProduct,
  updateProduct: productApi.updateProduct,
  deleteProduct: productApi.deleteProduct,
  getGiftBoxes: async (count = 8) => {
    const res = await apiClient.get<{ data: GiftBox[] }>(`/products/gift-boxes?count=${count}`);
    return res.data?.data || [];
  },
  getComboOffers: async (count = 8) => {
    const res = await apiClient.get<{ data: ComboOffer[] }>(`/products/combo-offers?count=${count}`);
    return res.data?.data || [];
  },
  getProductReviews: async (params?: { productId?: string; status?: string; page?: number; pageSize?: number }) => {
    const res = await apiClient.get('/reviews', { params });
    return (res.data?.data?.items || res.data?.data || []) as ProductReview[];
  },
  updateReviewStatus: async (id: string, status: string, notes?: string) => {
    const res = await apiClient.put(`/reviews/${id}/status`, { status, moderationNotes: notes });
    return res.data?.data as ProductReview;
  },
  deleteReview: async (id: string) => {
    const res = await apiClient.delete(`/reviews/${id}`);
    return res.data?.data ?? true;
  },
  // `placement` (Home | Mobile) is being added server-side; omitted → all placements.
  getHomepageBanners: async (activeOnly = false, placement?: string) => {
    const res = await apiClient.get('/banners', { params: { activeOnly, placement } });
    return (res.data?.data?.items || res.data?.data || []) as HomepageBanner[];
  },
  createBanner: async (data: Partial<HomepageBanner> & { placement?: string }) => {
    const res = await apiClient.post('/banners', data);
    return res.data?.data as HomepageBanner;
  },
  updateBanner: async (id: string, data: Partial<HomepageBanner> & { placement?: string }) => {
    const res = await apiClient.put(`/banners/${id}`, data);
    return res.data?.data as HomepageBanner;
  },
  deleteBanner: async (id: string) => {
    const res = await apiClient.delete(`/banners/${id}`);
    return res.data?.data ?? true;
  },

  // Categories & Brands
  getCategories: categoryApi.getCategories,
  getCategoryBySlug: categoryApi.getCategoryBySlug,
  createCategory: categoryApi.createCategory,
  updateCategory: categoryApi.updateCategory,
  deleteCategory: categoryApi.deleteCategory,
  getBrands: brandApi.getBrands,
  createBrand: brandApi.createBrand,

  // Orders & Sales
  getOrders: orderApi.getOrders,
  getOrderById: orderApi.getOrderById,
  createOrder: orderApi.createOrder,
  updateOrderStatus: orderApi.updateOrderStatus,
  verifyUpiPayment: orderApi.verifyUpiPayment,
  verifyPayment: orderApi.verifyUpiPayment,
  moveToPacking: orderApi.moveToPacking,
  rejectPayment: orderApi.rejectPayment,
  submitPaymentProof: orderApi.submitPaymentProof,
  // Low Stock Alerts (direct product stock)
  getLowStockAlerts: productApi.getLowStockProducts,

  // Customers
  getCustomers: customerApi.getCustomers,
  getCustomerById: customerApi.getCustomerById,

  // Invoices & Payments
  getInvoices: invoiceApi.getInvoices,
  getPayments: paymentApi.getPayments,
  createPayment: paymentApi.createPayment,

  // Finance & PnL
  getExpenses: financeApi.getExpenses,
  createExpense: financeApi.createExpense,
  getProfitLoss: financeApi.getProfitLoss,
  getProfitAndLoss: async (fromDate?: string, toDate?: string): Promise<ProfitAndLossStatement> => {
    const raw = await financeApi.getProfitLoss(fromDate, toDate);
    const exp = raw?.operatingExpensesBreakdown || {
      transport: 0,
      packaging: 0,
      rentAndUtilities: 0,
      salaries: 0,
      marketing: 0,
      officeAndAdmin: 0,
      total: raw?.operatingExpenses ?? raw?.totalExpenses ?? 0
    };
    return {
      totalRevenue: raw?.grossSales ?? raw?.totalRevenue ?? 0,
      discountsTotal: raw?.discounts ?? 0,
      returnsTotal: raw?.returnsTotal ?? 0,
      netSales: raw?.netRevenue ?? raw?.netSales ?? 0,
      costOfGoodsSold: raw?.costOfGoodsSold ?? raw?.cogs ?? 0,
      grossProfit: raw?.grossProfit ?? 0,
      grossMarginPercentage: raw?.grossMarginPercentage ?? 0,
      operatingExpenses: {
        transport: exp.transport ?? 0,
        packaging: exp.packaging ?? 0,
        rentAndUtilities: exp.rentAndUtilities ?? 0,
        salaries: exp.salaries ?? 0,
        marketing: exp.marketing ?? 0,
        officeAndAdmin: exp.officeAndAdmin ?? 0,
        total: exp.total ?? (raw?.operatingExpenses ?? raw?.totalExpenses ?? 0)
      },
      netOperatingProfit: raw?.netProfit ?? raw?.netOperatingProfit ?? 0,
      netProfitMarginPercentage: raw?.netMarginPercentage ?? raw?.netProfitMarginPercentage ?? 0
    };
  },
  getReceivables: async (params?: any): Promise<ReceivableItem[]> => {
    const res = await apiClient.get('/invoices', { params: { ...params, pageSize: 100 } });
    const invoices = (res.data?.data?.items || res.data?.data || []) as any[];
    const now = new Date().getTime();

    return invoices
      .filter((inv) => Number(inv.balanceAmount) > 0 || inv.status === 'Issued' || inv.status === 'PartiallyPaid' || inv.status === 'Overdue')
      .map((inv) => {
        const dueDate = new Date(inv.dueDateUtc).getTime();
        const diffDays = Math.max(0, Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)));
        const statusBucket = diffDays <= 0 ? 'Current' : (diffDays <= 30 ? 'Overdue30' : (diffDays <= 60 ? 'Overdue60' : 'Overdue90Plus'));
        return {
          id: inv.id,
          customerId: inv.customerId,
          customerName: inv.customerName || 'Customer',
          customerPhone: inv.customerPhone || '',
          invoiceNumber: inv.invoiceNumber,
          invoiceAmount: inv.grandTotal,
          paidAmount: inv.paidAmount,
          balanceAmount: inv.balanceAmount,
          dueDateUtc: inv.dueDateUtc,
          daysOverdue: diffDays,
          status: statusBucket
        };
      });
  },

  // Marketing & Coupons
  getCoupons: async (params?: { page?: number; pageSize?: number; search?: string }) => {
    const res = await apiClient.get('/promotions', { params });
    return wrapPagedResult<Coupon>(res.data?.data);
  },
  createCoupon: async (coupon: Partial<Coupon>) => {
    const res = await apiClient.post('/promotions', coupon);
    return res.data?.data as Coupon;
  },
  deleteCoupon: async (id: string) => {
    const res = await apiClient.delete(`/promotions/${id}`);
    return res.data?.data ?? true;
  },

  // Reports
  getDashboardKpis: reportApi.getDashboardKpis,
  getSalesOverview: reportApi.getSalesOverview,
  getSalesTrend: async (period = 'month') => {
    const res = await reportApi.getSalesOverview(period);
    const dataPoints = (res?.salesByDate || []).map(d => ({
      label: d.date,
      date: d.date,
      revenue: d.revenue,
      amount: d.revenue,
      orderCount: d.orders,
      orders: d.orders
    }));
    return { ...res, dataPoints };
  },
  getTopCategories: reportApi.getTopCategories,
  getCategoryBreakdown: reportApi.getTopCategories,
  getTopProducts: reportApi.getTopProducts,
  getPaymentMethods: reportApi.getPaymentMethods,
  exportCsv: reportApi.exportCsv,

  // Audit Logs
  getAuditLogs: auditApi.getAuditLogs,
  getAuditLogById: auditApi.getAuditLogById,

  // Settings & System Health
  getSettings: settingsApi.getSettings,
  getStoreSettings: async () => {
    const list = await settingsApi.getSettings('Store');
    const map: Record<string, string> = {};
    list.forEach(s => { map[s.key] = s.value; });
    return map as unknown as StoreSettings;
  },
  updateStoreSettings: async (settings: Partial<StoreSettings>) => {
    for (const [k, v] of Object.entries(settings)) {
      if (v !== undefined) await settingsApi.updateSetting(k, String(v));
    }
    return true;
  },
  getSystemHealth: async () => {
    const res = await apiClient.get('/system-health');
    return res.data?.data;
  },
  updateSetting: settingsApi.updateSetting
};

export default api;
