import { apiClient, wrapPagedResult } from './apiClient';
import { Product } from '../types';

export const productApi = {
  getProducts: async (params?: {
    categoryId?: string;
    brandId?: string;
    search?: string;
    isFeatured?: boolean;
    isBestSeller?: boolean;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDescending?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.categoryId) searchParams.append('categoryId', params.categoryId);
    if (params?.brandId) searchParams.append('brandId', params.brandId);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.isFeatured !== undefined) searchParams.append('isFeatured', params.isFeatured.toString());
    if (params?.isBestSeller !== undefined) searchParams.append('isBestSeller', params.isBestSeller.toString());
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortDescending !== undefined) searchParams.append('sortDescending', params.sortDescending.toString());

    const res = await apiClient.get(`/products?${searchParams.toString()}`);
    return wrapPagedResult<Product>(res.data?.data);
  },

  getProductById: async (id: string) => {
    const res = await apiClient.get<{ data: Product }>(`/products/id/${id}`);
    return res.data?.data;
  },

  getProductBySlug: async (slug: string) => {
    const res = await apiClient.get<{ data: Product }>(`/products/${slug}`);
    return res.data?.data;
  },

  createProduct: async (productData: Partial<Product>) => {
    const res = await apiClient.post<{ data: Product }>('/products', productData);
    return res.data?.data;
  },

  updateProduct: async (id: string, productData: Partial<Product>) => {
    const res = await apiClient.put<{ data: Product }>(`/products/${id}`, productData);
    return res.data?.data;
  },

  deleteProduct: async (id: string) => {
    const res = await apiClient.delete(`/products/${id}`);
    return res.data?.data;
  },

  getLowStockProducts: async (count = 10) => {
    const res = await apiClient.get<{ data: Product[] }>(`/products/low-stock?count=${count}`);
    return res.data?.data || [];
  }
};

