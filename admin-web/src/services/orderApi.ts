import { apiClient, wrapPagedResult } from './apiClient';
import { Order, OrderStatus } from '../types';

export const orderApi = {
  getOrders: async (params?: {
    status?: OrderStatus;
    search?: string;
    customerId?: string;
    page?: number;
    pageSize?: number;
    fromDate?: string;
    toDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.customerId) searchParams.append('customerId', params.customerId);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());
    if (params?.fromDate) searchParams.append('fromDate', params.fromDate);
    if (params?.toDate) searchParams.append('toDate', params.toDate);

    const res = await apiClient.get(`/orders?${searchParams.toString()}`);
    return wrapPagedResult<Order>(res.data?.data);
  },

  getOrderById: async (id: string) => {
    const res = await apiClient.get<{ data: Order }>(`/orders/${id}`);
    return res.data?.data;
  },

  createOrder: async (orderData: Record<string, unknown>) => {
    const res = await apiClient.post<{ data: Order }>('/orders', orderData);
    return res.data?.data;
  },

  updateOrderStatus: async (
    id: string,
    status: OrderStatus,
    notes?: string,
    trackingNumber?: string,
    carrier?: string
  ) => {
    const res = await apiClient.put<{ data: Order }>(`/orders/${id}/status`, {
      status,
      notes,
      trackingNumber,
      carrier
    });
    return res.data?.data;
  },

  verifyUpiPayment: async (
    orderId: string,
    proofUrl?: string | { verifiedUtrNumber?: string; verificationNotes?: string; autoMoveToPacking?: boolean },
    notes?: string
  ) => {
    const payload = typeof proofUrl === 'object'
      ? { proofUrl: proofUrl.verifiedUtrNumber, notes: proofUrl.verificationNotes, ...proofUrl }
      : { proofUrl, notes };

    const res = await apiClient.post<{ data: Order }>(`/orders/${orderId}/verify-upi`, payload);
    return res.data?.data;
  },

  moveToPacking: async (orderId: string) => {
    const res = await apiClient.put<{ data: Order }>(`/orders/${orderId}/status`, {
      status: 'Processing',
      notes: 'Moved to packing by admin'
    });
    return res.data?.data;
  },

  rejectPayment: async (orderId: string, reason: string) => {
    const res = await apiClient.put<{ data: Order }>(`/orders/${orderId}/status`, {
      status: 'Cancelled',
      notes: `Payment rejected: ${reason}`
    });
    return res.data?.data;
  }
};
