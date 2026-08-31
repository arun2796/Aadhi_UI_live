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

  getPurchaseOrders: async (page = 1, pageSize = 20) => {
    const res = await apiClient.get(`/purchases?page=${page}&pageSize=${pageSize}`);
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
    notes?: string;
    items?: Array<{ productId: string; quantity: number; unitCost: number }>;
  }) => {
    const res = await apiClient.post<{ data: PurchaseOrder }>('/purchases', data);
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
