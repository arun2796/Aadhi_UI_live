import { apiClient, wrapPagedResult } from './apiClient';
import { ComboItemInput, Product } from '../types';

export interface ProductQueryParams {
  categoryId?: string;
  brandId?: string;
  search?: string;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  /** `GET /products?excludeGiftBoxes=true` keeps gift-box products out of ordinary listings. */
  excludeGiftBoxes?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDescending?: boolean;
}

/**
 * Body accepted by POST/PUT /products.
 *
 * `comboItems` is deliberately re-typed: the *response* carries fully resolved
 * `ComboItem` rows (name / sku / prices), while the *request* only sends
 * `{ componentProductId, quantity }` pairs — the full list replaces the combo
 * contents and `[]` clears them. `imageUrls` is what the API actually persists
 * images from (first url wins as primary).
 */
export type ProductWritePayload = Omit<Partial<Product>, 'comboItems'> & {
  imageUrls?: string[];
  comboItems?: ComboItemInput[];
};

/** Max products pulled by {@link productApi.getAllProducts} (safety valve). */
const ALL_PRODUCTS_PAGE_SIZE = 500;
const ALL_PRODUCTS_MAX_PAGES = 6;

const fetchProductsPage = async (params?: ProductQueryParams) => {
  const searchParams = new URLSearchParams();
  if (params?.categoryId) searchParams.append('categoryId', params.categoryId);
  if (params?.brandId) searchParams.append('brandId', params.brandId);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.isFeatured !== undefined) searchParams.append('isFeatured', params.isFeatured.toString());
  if (params?.isBestSeller !== undefined) searchParams.append('isBestSeller', params.isBestSeller.toString());
  if (params?.excludeGiftBoxes !== undefined) searchParams.append('excludeGiftBoxes', params.excludeGiftBoxes.toString());
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());
  if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
  if (params?.sortDescending !== undefined) searchParams.append('sortDescending', params.sortDescending.toString());

  const res = await apiClient.get(`/products?${searchParams.toString()}`);
  return wrapPagedResult<Product>(res.data?.data);
};

/**
 * Walks the paged endpoint until the whole catalogue is in memory — used by
 * client-side pickers (e.g. the combo builder) and by the gift-box fallback below,
 * which need to filter a few hundred products instantly without a request per keystroke.
 */
const fetchAllProducts = async (params?: Omit<ProductQueryParams, 'page' | 'pageSize'>) => {
  const all: Product[] = [];
  for (let page = 1; page <= ALL_PRODUCTS_MAX_PAGES; page++) {
    const chunk = await fetchProductsPage({ ...params, page, pageSize: ALL_PRODUCTS_PAGE_SIZE });
    all.push(...chunk);
    if (chunk.length < ALL_PRODUCTS_PAGE_SIZE || all.length >= chunk.totalCount) break;
  }
  return all;
};

export const productApi = {
  getProducts: (params?: ProductQueryParams) => fetchProductsPage(params),

  getAllProducts: fetchAllProducts,

  /**
   * Every gift-box product, from the dedicated `GET /products/gift-boxes` endpoint.
   * `wrapPagedResult` tolerates both a bare array and a paged envelope.
   *
   * A server build that predates the endpoint answers either 404 or — because
   * `/products/{slug}` sits on the same path shape — a single product object. Both are
   * recognised and fall back to filtering the catalogue on `isGiftBox`, so this module keeps
   * working while the API side ships. A genuinely empty list is *not* treated as a miss.
   */
  getGiftBoxes: async (): Promise<Product[]> => {
    try {
      const payload = (await apiClient.get('/products/gift-boxes')).data?.data;
      const isList =
        Array.isArray(payload) ||
        (Boolean(payload) && Array.isArray((payload as { items?: unknown }).items));
      if (isList) return [...wrapPagedResult<Product>(payload)];
    } catch (error) {
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status !== 404) throw error;
    }

    const all = await fetchAllProducts();
    return all.filter((p) => Boolean(p.isGiftBox));
  },

  getProductById: async (id: string) => {
    const res = await apiClient.get<{ data: Product }>(`/products/id/${id}`);
    return res.data?.data;
  },

  getProductBySlug: async (slug: string) => {
    const res = await apiClient.get<{ data: Product }>(`/products/${slug}`);
    return res.data?.data;
  },

  createProduct: async (productData: ProductWritePayload) => {
    const res = await apiClient.post<{ data: Product }>('/products', productData);
    return res.data?.data;
  },

  updateProduct: async (id: string, productData: ProductWritePayload) => {
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
