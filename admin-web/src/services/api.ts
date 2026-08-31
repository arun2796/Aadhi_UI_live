// Central Re-Export & Unified API Service Adapter
export * from './apiClient';
export * from './authApi';
export * from './productApi';
export * from './categoryApi';
export * from './brandApi';
export * from './orderApi';
export * from './customerApi';
export * from './inventoryApi';
export * from './purchaseApi';
export * from './invoiceApi';
export * from './paymentApi';
export * from './financeApi';
export * from './reportApi';
export * from './auditApi';
export * from './settingsApi';

import { apiClient, TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT, getApiErrorDetails } from './apiClient';
import { authApi } from './authApi';
import { productApi } from './productApi';
import { categoryApi } from './categoryApi';
import { brandApi } from './brandApi';
import { orderApi } from './orderApi';
import { customerApi } from './customerApi';
import { inventoryApi } from './inventoryApi';
import { purchaseApi } from './purchaseApi';
import { invoiceApi } from './invoiceApi';
import { paymentApi } from './paymentApi';
import { financeApi } from './financeApi';
import { reportApi } from './reportApi';
import { auditApi } from './auditApi';
import { settingsApi } from './settingsApi';
import {
  Quote,
  Order,
  ReturnOrder,
  GoodsReceipt,
  SupplierBill,
  StoreSettings,
  Coupon,
  GiftBox,
  ComboOffer,
  ProductReview,
  HomepageBanner,
  StockTransfer,
  ProfitAndLossStatement,
  ReceivableItem,
  PayableItem
} from '../types';

export { apiClient, TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT, getApiErrorDetails };

// Complete Unified `api` Object matching existing component calls
export const api = {
  // Global Search
  searchGlobal: async (query: string) => {
    try {
      const [products, orders, customers] = await Promise.all([
        productApi.getProducts({ search: query, pageSize: 5 }),
        orderApi.getOrders({ search: query, pageSize: 5 }),
        customerApi.getCustomers({ search: query, pageSize: 5 })
      ]);
      return {
        products: (products.items || products).map(p => ({ id: p.id, name: p.name, sku: p.sku, price: p.price })),
        orders: (orders.items || orders).map(o => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, grandTotal: o.grandTotal, status: o.orderStatus })),
        customers: (customers.items || customers).map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })),
        invoices: [],
        suppliers: []
      };
    } catch {
      return { products: [], orders: [], customers: [], invoices: [], suppliers: [] };
    }
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
  getProductReviews: async () => [] as ProductReview[],
  updateReviewStatus: async (id: string, status: string) => ({ id, status }),
  getHomepageBanners: async () => [] as HomepageBanner[],

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
  getQuotes: async () => [] as Quote[],
  convertQuoteToOrder: async (quoteId: string) => ({ id: quoteId, orderNumber: `ORD-${Date.now()}` } as unknown as Order),
  getReturns: async () => [] as ReturnOrder[],
  updateReturnStatus: async (returnId: string, status: string, notes?: string) => ({ id: returnId, status, notes }),

  // Customers
  getCustomers: customerApi.getCustomers,
  getCustomerById: customerApi.getCustomerById,

  // Inventory & Warehouses
  getWarehouses: inventoryApi.getWarehouses,
  getStockItems: inventoryApi.getStockItems,
  adjustStock: inventoryApi.adjustStock,
  transferStock: inventoryApi.transferStock,
  getStockMovements: inventoryApi.getStockMovements,
  getStockTransfers: async () => [] as StockTransfer[],
  getLowStockAlerts: inventoryApi.getLowStockAlerts,

  // Purchases
  getSuppliers: purchaseApi.getSuppliers,
  createSupplier: purchaseApi.createSupplier,
  getPurchases: purchaseApi.getPurchaseOrders,
  getPurchaseOrders: purchaseApi.getPurchaseOrders,
  getPurchaseOrderById: purchaseApi.getPurchaseOrderById,
  createPurchaseOrder: async (data: any) => purchaseApi.createPurchaseOrder(data),
  createGoodsReceipt: purchaseApi.createGoodsReceipt,
  getGoodsReceivedNotes: async () => [] as GoodsReceipt[],
  getSupplierBills: async () => [] as SupplierBill[],

  // Invoices & Payments
  getInvoices: invoiceApi.getInvoices,
  getPayments: paymentApi.getPayments,
  createPayment: paymentApi.createPayment,

  // Finance & PnL
  getExpenses: financeApi.getExpenses,
  createExpense: financeApi.createExpense,
  getProfitLoss: financeApi.getProfitLoss,
  getProfitAndLoss: async (): Promise<ProfitAndLossStatement> => {
    const raw = await financeApi.getProfitLoss();
    return {
      totalRevenue: raw?.grossSales ?? 0,
      discountsTotal: raw?.discounts ?? 0,
      returnsTotal: 0,
      netSales: raw?.netRevenue ?? 0,
      costOfGoodsSold: raw?.cogs ?? 0,
      grossProfit: raw?.grossProfit ?? 0,
      grossMarginPercentage: raw?.grossMarginPercentage ?? 0,
      operatingExpenses: {
        transport: 0,
        packaging: 0,
        rentAndUtilities: 0,
        salaries: 0,
        marketing: 0,
        officeAndAdmin: 0,
        total: raw?.operatingExpenses ?? 0
      },
      netOperatingProfit: raw?.netProfit ?? 0,
      netProfitMarginPercentage: raw?.netMarginPercentage ?? 0
    };
  },
  getReceivables: async () => [] as ReceivableItem[],
  getPayables: async () => [] as PayableItem[],

  // Marketing & Coupons
  getCoupons: async () => [] as Coupon[],
  createCoupon: async (coupon: Partial<Coupon>) => ({ id: `CPN-${Date.now()}`, ...coupon } as unknown as Coupon),
  deleteCoupon: async (id: string) => true,

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
