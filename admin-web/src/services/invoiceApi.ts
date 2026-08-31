import { apiClient, wrapPagedResult } from './apiClient';
import { Invoice, InvoiceStatus } from '../types';

export const invoiceApi = {
  getInvoices: async (page = 1, pageSize = 20, status?: InvoiceStatus) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (status) params.append('status', status);

    const res = await apiClient.get(`/invoices?${params.toString()}`);
    return wrapPagedResult<Invoice>(res.data?.data);
  }
};
