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
    // Backend contract is UpdateOrderStatusRequest { newStatus, reason };
    // legacy keys are kept alongside for mock/back-compat servers.
    const res = await apiClient.put<{ data: Order }>(`/orders/${id}/status`, {
      newStatus: status,
      status,
      reason: notes,
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
    // Backend contract: POST /orders/{id}/verify-payment with VerifyPaymentRequest.
    const payload =
      typeof proofUrl === 'object' && proofUrl !== null
        ? {
            verifiedUtrNumber: proofUrl.verifiedUtrNumber,
            verificationNotes: proofUrl.verificationNotes,
            autoMoveToPacking: proofUrl.autoMoveToPacking ?? false
          }
        : { verifiedUtrNumber: proofUrl, verificationNotes: notes, autoMoveToPacking: false };

    const res = await apiClient.post<{ data: Order }>(`/orders/${orderId}/verify-payment`, payload);
    return res.data?.data;
  },

  /**
   * Quick Dispatch (Phase 6) — hands the parcel to the transport carrier and moves the
   * order to Shipped. Backend contract: POST /orders/{id}/dispatch
   * { carrierName, trackingNumber, notes } → updated OrderDto.
   */
  dispatchOrder: async (
    id: string,
    data: { carrierName?: string; trackingNumber: string; notes?: string }
  ) => {
    const res = await apiClient.post<{ data: Order }>(`/orders/${id}/dispatch`, {
      carrierName: data.carrierName?.trim() || undefined,
      trackingNumber: data.trackingNumber.trim(),
      notes: data.notes?.trim() || undefined
    });
    return res.data?.data;
  },

  moveToPacking: async (orderId: string) => {
    const res = await apiClient.post<{ data: Order }>(`/orders/${orderId}/move-to-packing`);
    return res.data?.data;
  },

  rejectPayment: async (orderId: string, reason: string) => {
    // Backend contract: POST /orders/{id}/reject-payment { reason } → order cancelled.
    const res = await apiClient.post<{ data: Order }>(`/orders/${orderId}/reject-payment`, { reason });
    return res.data?.data;
  },

  submitPaymentProof: async (
    orderId: string,
    data: { utrNumber?: string; paymentScreenshotBase64?: string; notes?: string; orderNumber?: string }
  ) => {
    const res = await apiClient.post<{ data: Order }>(`/orders/${orderId}/payment-proof`, data);
    return res.data?.data;
  }
};
