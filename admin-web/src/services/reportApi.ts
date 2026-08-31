import { apiClient } from './apiClient';
import { DashboardKpis, SalesReport, CategorySales, TopProduct, PaymentMethodReport } from '../types';

export const reportApi = {
  getDashboardKpis: async () => {
    const res = await apiClient.get<{ data: DashboardKpis }>('/reports/dashboard');
    return res.data?.data;
  },

  getSalesOverview: async (period = 'month') => {
    const res = await apiClient.get<{ data: SalesReport }>(`/reports/sales-overview?period=${period}`);
    return res.data?.data;
  },

  getTopCategories: async () => {
    const res = await apiClient.get<{ data: CategorySales[] }>('/reports/top-categories');
    return res.data?.data || [];
  },

  getTopProducts: async (limit = 5) => {
    const res = await apiClient.get<{ data: TopProduct[] }>(`/reports/top-products?limit=${limit}`);
    return res.data?.data || [];
  },

  getPaymentMethods: async () => {
    const res = await apiClient.get<{ data: PaymentMethodReport[] }>('/reports/payment-methods');
    return res.data?.data || [];
  },

  exportCsv: async (reportType: string, fromDate?: string, toDate?: string) => {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);

    const res = await apiClient.get(`/reports/export/${reportType}?${params.toString()}`, {
      responseType: 'blob'
    });
    return res.data;
  }
};
