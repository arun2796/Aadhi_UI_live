import { apiClient } from './apiClient';
import { Category } from '../types';

export const categoryApi = {
  getCategories: async (includeInactive = true) => {
    const res = await apiClient.get<{ data: Category[] }>(`/categories?includeInactive=${includeInactive}`);
    return res.data?.data || [];
  },

  getCategoryBySlug: async (slug: string) => {
    const res = await apiClient.get<{ data: Category }>(`/categories/${slug}`);
    return res.data?.data;
  },

  createCategory: async (categoryData: Partial<Category>) => {
    const res = await apiClient.post<{ data: Category }>('/categories', categoryData);
    return res.data?.data;
  },

  updateCategory: async (id: string, categoryData: Partial<Category>) => {
    const res = await apiClient.put<{ data: Category }>(`/categories/${id}`, categoryData);
    return res.data?.data;
  },

  deleteCategory: async (id: string) => {
    const res = await apiClient.delete(`/categories/${id}`);
    return res.data?.data;
  }
};
