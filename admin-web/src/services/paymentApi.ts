import { apiClient, wrapPagedResult } from './apiClient';
import { Payment } from '../types';

export const paymentApi = {
  getPayments: async (page = 1, pageSize = 20) => {
    const res = await apiClient.get(`/payments?page=${page}&pageSize=${pageSize}`);
    return wrapPagedResult<Payment>(res.data?.data);
  },

  createPayment: async (data: {
    orderId: string;
    amount: number;
    paymentMethod: string;
    transactionReference?: string;
    proofUrl?: string;
    notes?: string;
  }) => {
    const res = await apiClient.post<{ data: Payment }>('/payments', data);
    return res.data?.data;
  }
};
