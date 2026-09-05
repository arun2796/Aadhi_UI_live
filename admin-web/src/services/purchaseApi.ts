import { apiClient, wrapPagedResult } from './apiClient';
import { Supplier, PurchaseOrder, GoodsReceipt } from '../types';

export const purchaseApi = {
  getSuppliers: async () => {
    const res = await apiClient.get<{ data: Supplier[] }>('/purchases/suppliers');
    return res.data?.data || [];
  },

  createSupplier: async (supplierData: Partial<Supplier>) => {
    const res = await apiClient.post<{ data: Supplier }>('/purchases/suppliers', supplierData);
    return res.data?.data;
  },

  getSupplierById: async (id: string) => {
    const res = await apiClient.get<{ data: Supplier }>(`/purchases/suppliers/${id}`);
    return res.data?.data;
  },

  updateSupplier: async (id: string, supplierData: Partial<Supplier>) => {
    const res = await apiClient.put<{ data: Supplier }>(`/purchases/suppliers/${id}`, supplierData);
    return res.data?.data;
  },

  deleteSupplier: async (id: string) => {
    const res = await apiClient.delete<{ data: boolean }>(`/purchases/suppliers/${id}`);
    return res.data?.data ?? true;
  },

  getPurchaseOrders: async (page = 1, pageSize = 20, status?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.append('status', status);
    const res = await apiClient.get(`/purchases?${params.toString()}`);
    return wrapPagedResult<PurchaseOrder>(res.data?.data);
  },

  getPurchaseOrderById: async (id: string) => {
    const res = await apiClient.get<{ data: PurchaseOrder }>(`/purchases/${id}`);
    return res.data?.data;
  },

  createPurchaseOrder: async (data: {
    supplierId?: string;
    warehouseId?: string;
    supplierName?: string;
    expectedDeliveryDateUtc?: string;
    notes?: string;
    items?: Array<{ productId: string; quantity: number; unitCost?: number; unitPrice?: number }>;
  }) => {
    // Backend CreatePurchaseOrderRequest expects items: [{ productId, unitPrice, quantity }]
    const payload = {
      ...data,
      items: (data.items || []).map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice ?? it.unitCost ?? 0
      }))
    };
    const res = await apiClient.post<{ data: PurchaseOrder }>('/purchases', payload);
    return res.data?.data;
  },

  submitPurchaseOrder: async (id: string) => {
    const res = await apiClient.post<{ data: PurchaseOrder }>(`/purchases/${id}/submit`, {});
    return res.data?.data;
  },

  approvePurchaseOrder: async (id: string, notes?: string) => {
    const res = await apiClient.post<{ data: PurchaseOrder }>(`/purchases/${id}/approve`, { notes: notes || null });
    return res.data?.data;
  },

  rejectPurchaseOrder: async (id: string, reason: string) => {
    const res = await apiClient.post<{ data: PurchaseOrder }>(`/purchases/${id}/reject`, { reason });
    return res.data?.data;
  },

  cancelPurchaseOrder: async (id: string, reason: string) => {
    const res = await apiClient.post<{ data: PurchaseOrder }>(`/purchases/${id}/cancel`, { reason });
    return res.data?.data;
  },

  createGoodsReceipt: async (data: {
    purchaseOrderId: string;
    receivedDate: string;
    notes?: string;
    items: Array<{ purchaseOrderItemId: string; quantityReceived: number; quantityRejected: number; notes?: string }>;
  }) => {
    const res = await apiClient.post<{ data: GoodsReceipt }>('/purchases/goods-receipts', data);
    return res.data?.data;
  }
};
