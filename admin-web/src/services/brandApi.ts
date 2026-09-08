import { apiClient } from './apiClient';
import { Brand } from '../types';

export const brandApi = {
  getBrands: async (includeInactive = true) => {
    const res = await apiClient.get<{ data: Brand[] }>(`/brands?includeInactive=${includeInactive}`);
    return res.data?.data || [];
  },

  createBrand: async (brandData: { name: string; slug?: string; description?: string; logoUrl?: string; isFeatured?: boolean }) => {
    const res = await apiClient.post<{ data: Brand }>('/brands', brandData);
    return res.data?.data;
  },

  deleteBrand: async (id: string) => {
    const res = await apiClient.delete<{ data: boolean }>(`/brands/${id}`);
    return res.data?.data;
  }
};
