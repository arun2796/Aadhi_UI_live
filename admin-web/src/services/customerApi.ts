import { apiClient, wrapPagedResult } from './apiClient';
import { Customer } from '../types';

export const customerApi = {
  getCustomers: async (params?: { search?: string; page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());

    const res = await apiClient.get(`/customers?${searchParams.toString()}`);
    return wrapPagedResult<Customer>(res.data?.data);
  },

  getCustomerById: async (id: string) => {
    const res = await apiClient.get<{ data: Customer }>(`/customers/${id}`);
    return res.data?.data;
  }
};
