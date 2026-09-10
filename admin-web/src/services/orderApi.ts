import { apiClient, wrapPagedResult } from './apiClient';
import { Order, OrderStatus } from '../types';

/** Safety valve for {@link orderApi.getAllOrders}. */
const ALL_ORDERS_PAGE_SIZE = 200;
const ALL_ORDERS_MAX_PAGES = 10;

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

  /**
   * Walks the paged endpoint until every order is in memory.
   *
   * The ERP orders screen filters, tabs, counts and paginates client-side, so a single default
   * page (20 rows) silently hid every order past the first page and made its tab counts disagree
   * with the dashboard's per-status totals.
   */
  getAllOrders: async (params?: { status?: OrderStatus; search?: string; customerId?: string; fromDate?: string; toDate?: string }) => {
    const all: Order[] = [];
    for (let page = 1; page <= ALL_ORDERS_MAX_PAGES; page++) {
      const chunk = await orderApi.getOrders({ ...params, page, pageSize: ALL_ORDERS_PAGE_SIZE });
      all.push(...chunk);
      if (chunk.length < ALL_ORDERS_PAGE_SIZE || all.length >= chunk.totalCount) break;
    }
    return all;
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
   * { carrierName, trackingNumber, carrierPhone, carrierAddress, notes } → updated OrderDto.
   *
   * `carrierPhone` / `carrierAddress` are the transport office the customer rings and the branch
   * they collect from. Both optional — blank fields are sent as `undefined`, never as "".
   */
  dispatchOrder: async (
    id: string,
    data: {
      carrierName?: string;
      trackingNumber: string;
      carrierPhone?: string;
      carrierAddress?: string;
      notes?: string;
    }
  ) => {
    const res = await apiClient.post<{ data: Order }>(`/orders/${id}/dispatch`, {
      carrierName: data.carrierName?.trim() || undefined,
      trackingNumber: data.trackingNumber.trim(),
      carrierPhone: data.carrierPhone?.trim() || undefined,
      carrierAddress: data.carrierAddress?.trim() || undefined,
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
