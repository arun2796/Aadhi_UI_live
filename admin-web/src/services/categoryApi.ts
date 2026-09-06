import { apiClient } from './apiClient';
import { Category } from '../types';

/**
 * The categories endpoint may return either a flat list (each row carrying `parentCategoryId`)
 * or a hierarchical list (top-level rows carrying nested `subCategories[]`) per API contract §9.
 * This normalizes both shapes into a single flat, de-duplicated list where every sub-category
 * has `parentCategoryId`/`parentCategoryName` populated.
 */
export function flattenCategories(categories: Category[]): Category[] {
  const byId = new Map<string, Category>();

  const visit = (cat: Category, parent?: Category) => {
    const normalized: Category = {
      ...cat,
      parentCategoryId: cat.parentCategoryId || parent?.id,
      parentCategoryName: cat.parentCategoryName || parent?.name
    };
    const existing = byId.get(normalized.id);
    byId.set(normalized.id, existing ? { ...existing, ...normalized } : normalized);
    (cat.subCategories || []).forEach((child) => visit(child, cat));
  };

  (categories || []).forEach((c) => visit(c));
  return Array.from(byId.values());
}

/** Mirrors the backend's slug generation from a name (lowercase, alphanumerics, dashes). */
export const slugifyCategoryName = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * POST/PUT /categories accept an optional `slug`: when the admin filled one in, it is sent
 * verbatim and the backend uses it; when blank it is omitted so the backend generates the
 * slug from the category name.
 */
const withOptionalSlug = (categoryData: Partial<Category>): Partial<Category> => ({
  ...categoryData,
  slug: categoryData.slug?.trim() || undefined
});

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
    const res = await apiClient.post<{ data: Category }>('/categories', withOptionalSlug(categoryData));
    return res.data?.data;
  },

  updateCategory: async (id: string, categoryData: Partial<Category>) => {
    const res = await apiClient.put<{ data: Category }>(`/categories/${id}`, withOptionalSlug(categoryData));
    return res.data?.data;
  },

  deleteCategory: async (id: string) => {
    const res = await apiClient.delete(`/categories/${id}`);
    return res.data?.data;
  }
};
