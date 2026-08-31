import { apiClient, wrapPagedResult } from './apiClient';
import { Warehouse, StockItem, StockMovement, LowStockAlert, StockTransfer } from '../types';

export const inventoryApi = {
  getWarehouses: async () => {
    const res = await apiClient.get<{ data: Warehouse[] }>('/inventory/warehouses');
    return res.data?.data || [];
  },

  getStockItems: async (
    warehouseIdOrParams?: string | { warehouseId?: string; search?: string; lowStockOnly?: boolean; page?: number; pageSize?: number },
    searchParam?: string,
    lowStockOnlyParam?: boolean,
    pageParam?: number,
    pageSizeParam?: number
  ) => {
    const searchParams = new URLSearchParams();

    if (typeof warehouseIdOrParams === 'object' && warehouseIdOrParams !== null) {
      if (warehouseIdOrParams.warehouseId) searchParams.append('warehouseId', warehouseIdOrParams.warehouseId);
      if (warehouseIdOrParams.search) searchParams.append('search', warehouseIdOrParams.search);
      if (warehouseIdOrParams.lowStockOnly) searchParams.append('lowStockOnly', 'true');
      if (warehouseIdOrParams.page) searchParams.append('page', warehouseIdOrParams.page.toString());
      if (warehouseIdOrParams.pageSize) searchParams.append('pageSize', warehouseIdOrParams.pageSize.toString());
    } else {
      if (typeof warehouseIdOrParams === 'string' && warehouseIdOrParams) searchParams.append('warehouseId', warehouseIdOrParams);
      if (searchParam) searchParams.append('search', searchParam);
      if (lowStockOnlyParam) searchParams.append('lowStockOnly', 'true');
      if (pageParam) searchParams.append('page', pageParam.toString());
      if (pageSizeParam) searchParams.append('pageSize', pageSizeParam.toString());
    }

    const res = await apiClient.get(`/inventory/stock?${searchParams.toString()}`);
    return wrapPagedResult<StockItem>(res.data?.data);
  },

  adjustStock: async (
    p1: any,
    p2?: any,
    p3?: any,
    p4?: any
  ) => {
    let productId = '';
    let warehouseId = '';
    let adjustmentQuantity = 0;
    let reason = 'Manual Adjustment';

    if (typeof p1 === 'object' && p1 !== null) {
      productId = p1.productId || '';
      warehouseId = p1.warehouseId || '';
      adjustmentQuantity = p1.adjustmentQuantity ?? p1.quantityChange ?? 0;
      reason = p1.reason || reason;
    } else if (typeof p1 === 'string') {
      productId = p1;
      if (typeof p2 === 'number') {
        adjustmentQuantity = p2;
        reason = typeof p3 === 'string' ? p3 : reason;
        warehouseId = typeof p4 === 'string' ? p4 : '';
      } else if (typeof p2 === 'string') {
        warehouseId = p2;
        adjustmentQuantity = typeof p3 === 'number' ? p3 : 0;
        reason = typeof p4 === 'string' ? p4 : reason;
      }
    }

    const payload = {
      productId,
      warehouseId,
      adjustmentQuantity,
      reason
    };

    const res = await apiClient.post<{ data: StockItem }>('/inventory/adjustments', payload);
    return res.data?.data;
  },

  transferStock: async (data: {
    productId: string;
    fromWarehouseId?: string;
    sourceWarehouseId?: string;
    toWarehouseId?: string;
    targetWarehouseId?: string;
    destinationWarehouseId?: string;
    quantity: number;
    notes?: string;
    reason?: string;
  }) => {
    const payload = {
      productId: data.productId,
      fromWarehouseId: data.fromWarehouseId || data.sourceWarehouseId,
      toWarehouseId: data.toWarehouseId || data.targetWarehouseId || data.destinationWarehouseId,
      quantity: data.quantity,
      notes: data.notes || data.reason
    };
    const res = await apiClient.post<{ data: boolean }>('/inventory/transfers', payload);
    return res.data?.data;
  },

  getStockMovements: async (params?: {
    productId?: string;
    warehouseId?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.productId) searchParams.append('productId', params.productId);
    if (params?.warehouseId) searchParams.append('warehouseId', params.warehouseId);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());

    const res = await apiClient.get(`/inventory/movements?${searchParams.toString()}`);
    return wrapPagedResult<StockMovement>(res.data?.data);
  },

  getStockTransfers: async () => {
    return [] as StockTransfer[];
  },

  getLowStockAlerts: async (limit = 10) => {
    const res = await apiClient.get<{ data: LowStockAlert[] }>(`/inventory/low-stock?limit=${limit}`);
    return res.data?.data || [];
  }
};
