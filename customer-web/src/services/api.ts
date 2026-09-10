import axios from 'axios';
import {
  Product,
  Category,
  Brand,
  ComboItem,
  Order,
  Address,
  CartItem
} from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5050/api/v1';

const API_ORIGIN = API_BASE_URL.replace(/\/api.*$/i, '');

/** Converts Google Drive share links into direct-image URLs usable in <img> tags,
 *  and resolves server-hosted /storage/... paths to absolute API origin.
 *  Any other URL passes through unchanged. */
export const normalizeImageUrl = (url?: string | null): string | undefined => {
  if (!url || !url.trim()) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith('/storage/')) {
    return `${API_ORIGIN}${trimmed}`;
  }
  if (!/drive\.google\.com/i.test(trimmed)) return trimmed;
  if (/drive\.google\.com\/thumbnail/i.test(trimmed)) return trimmed;
  const match =
    trimmed.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/i) ||
    trimmed.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
  if (!match) return trimmed;
  return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
};

/** Combo / gift-box fields (ProductDto.isCombo, comboItemCount and, on the detail
 *  DTO, comboItems / comboItemsTotal). The API may not expose them yet, so every
 *  field stays undefined when absent and the combo UI simply hides itself. */
const mapComboFields = (p: any): Partial<Product> => {
  const rawItems = Array.isArray(p?.comboItems) ? p.comboItems : null;
  const comboItems: ComboItem[] | undefined = rawItems
    ? rawItems
        .map((c: any): ComboItem => ({
          componentProductId: String(c?.componentProductId ?? c?.productId ?? ''),
          productName: String(c?.productName ?? c?.name ?? '').trim(),
          sku: String(c?.sku ?? '').trim(),
          imageUrl: normalizeImageUrl(c?.imageUrl ?? c?.primaryImageUrl),
          quantity: Number(c?.quantity) || 1,
          unitPrice: Number(c?.unitPrice ?? c?.price) || 0,
          lineTotal:
            Number(c?.lineTotal) ||
            (Number(c?.unitPrice ?? c?.price) || 0) * (Number(c?.quantity) || 1)
        }))
        .filter((c: ComboItem) => c.productName.length > 0)
    : undefined;

  const count = Number(p?.comboItemCount);
  const total = Number(p?.comboItemsTotal);

  return {
    isCombo: typeof p?.isCombo === 'boolean' ? p.isCombo : undefined,
    comboItemCount: Number.isFinite(count) && count > 0 ? count : undefined,
    comboItems: comboItems && comboItems.length > 0 ? comboItems : undefined,
    comboItemsTotal: Number.isFinite(total) && total > 0 ? total : undefined
  };
};

/** Single ProductDto → Product mapper. EVERY product-returning endpoint funnels
 *  through here, so image URLs and combo fields are normalized identically no
 *  matter which list a product arrived in (grid, detail, featured, combos …). */
const mapProductDto = (p: any): Product => ({
  id: p.id,
  sku: p.sku,
  name: p.name,
  slug: p.slug,
  description: p.description,
  shortDescription: p.shortDescription,
  categoryId: p.categoryId,
  categoryName: p.categoryName || 'Crackers',
  brandId: p.brandId,
  brandName: p.brandName,
  price: p.price,
  compareAtPrice: p.compareAtPrice,
  costPrice: p.costPrice,
  taxRate: p.taxRate,
  discountType: p.discountType || 'None',
  discountValue: p.discountValue || 0,
  discountPercentage: p.discountPercentage,
  stockQuantity: p.stockQuantity,
  availableQuantity: p.availableQuantity,
  reorderLevel: p.reorderLevel,
  unit: p.unit || 'Box',
  weightKg: p.weightKg || 0.5,
  isActive: p.isActive,
  isFeatured: p.isFeatured,
  isBestSeller: p.isBestSeller,
  isNewArrival: p.isNewArrival,
  primaryImageUrl: normalizeImageUrl(p.primaryImageUrl),
  images: (p.images || []).map((img: any) =>
    typeof img === 'string' ? normalizeImageUrl(img) : { ...img, url: normalizeImageUrl(img?.url) }
  ),
  safetyInformation: p.safetyInformation,
  minOrderQuantity: p.minOrderQuantity,
  maxOrderQuantity: p.maxOrderQuantity,
  rating: p.rating,
  reviewCount: p.reviewCount,
  ...mapComboFields(p)
});

/** Accepts either a bare array or a `{ items: [] }` page and maps both. */
const mapProductList = (raw: any): Product[] => {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
  return list.filter((p: any) => p && p.id).map((p: any) => mapProductDto(p));
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  if (!config.headers['X-Correlation-ID']) {
    config.headers['X-Correlation-ID'] = 'cust-' + Math.random().toString(36).substring(2, 9);
  }
  const token = localStorage.getItem('aadhi_customer_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('aadhi_customer_token');
      localStorage.removeItem('aadhi_customer_user');
    }
    return Promise.reject(error);
  }
);

/* ── Public storefront settings: small in-memory cache (fetched once per session) ── */
let publicSettingsCache: Record<string, string> | null = null;
let publicSettingsPromise: Promise<Record<string, string>> | null = null;

export const api = {
  // PUBLIC STOREFRONT SETTINGS (anonymous; tolerant to the endpoint being absent)
  async getPublicSettings(): Promise<Record<string, string>> {
    if (publicSettingsCache) return publicSettingsCache;
    if (!publicSettingsPromise) {
      publicSettingsPromise = apiClient
        .get('/settings/public')
        .then(res => {
          const raw = res.data?.data ?? res.data;
          const map: Record<string, string> = {};
          if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            for (const [key, value] of Object.entries(raw)) {
              if (value !== null && value !== undefined) map[key] = String(value);
            }
          }
          publicSettingsCache = map;
          return map;
        })
        .catch(() => {
          // 404 / network error → empty map (callers fall back to defaults);
          // clear the promise so a later call can retry.
          publicSettingsPromise = null;
          return {};
        });
    }
    return publicSettingsPromise;
  },

  // AUTH
  async login(email: string, password: string): Promise<{ user: any; token: string }> {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.data?.data?.token) {
      localStorage.setItem('aadhi_customer_token', res.data.data.token);
      return res.data.data;
    }
    throw new Error(res.data?.message || 'Login failed');
  },

  async loginWithFirebase(firebaseData: { idToken: string; email?: string; displayName?: string; photoUrl?: string; phoneNumber?: string }): Promise<{ user: any; token: string }> {
    const res = await apiClient.post('/auth/firebase-login', firebaseData);
    if (res.data?.data?.token) {
      localStorage.setItem('aadhi_customer_token', res.data.data.token);
      return res.data.data;
    }
    throw new Error(res.data?.message || 'Firebase login failed');
  },

  async register(data: { firstName: string; lastName: string; email: string; phone: string; password: string; confirmPassword?: string }): Promise<{ user: any; token: string }> {
    // The API requires ConfirmPassword and rejects the request without it. Both
    // sign-up forms already validate the two typed passwords match before calling.
    const res = await apiClient.post('/auth/register', {
      ...data,
      confirmPassword: data.confirmPassword ?? data.password
    });
    if (res.data?.data?.token) {
      localStorage.setItem('aadhi_customer_token', res.data.data.token);
      return res.data.data;
    }
    throw new Error(res.data?.message || 'Registration failed');
  },

  async getCurrentUser(): Promise<any> {
    const res = await apiClient.get('/auth/me');
    return res.data?.data;
  },

  async updateProfile(data: { firstName: string; lastName?: string; phone?: string }): Promise<any> {
    const res = await apiClient.put('/auth/me', data);
    if (res.data?.data) {
      return res.data.data;
    }
    throw new Error(res.data?.message || 'Failed to update profile');
  },

  logout(): void {
    localStorage.removeItem('aadhi_customer_token');
    localStorage.removeItem('aadhi_customer_user');
  },

  async getMyOrders(): Promise<Order[]> {
    const res = await apiClient.get('/orders/my-orders');
    return (res.data?.data && Array.isArray(res.data.data)) ? res.data.data : [];
  },
  // PRODUCTS
  async getProducts(params?: {
    category?: string;
    categorySlug?: string;
    brand?: string;
    brandId?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
    search?: string;
    sortBy?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Product[]> {
    try {
      const queryParams: Record<string, any> = { ...params };
      if (params?.category && !params.categorySlug) {
        queryParams.categorySlug = params.category.toLowerCase().replace(/\s+/g, '-');
      }
      const res = await apiClient.get('/products', { params: queryParams });
      if (res.data?.data?.items) {
        return mapProductList(res.data.data.items);
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch live products from API:', error);
      return [];
    }
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    try {
      const res = await apiClient.get(`/products/${slug}`);
      if (res.data?.data) {
        return mapProductDto(res.data.data);
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch live product slug '${slug}':`, error);
      return null;
    }
  },

  async getFeaturedProducts(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/featured');
      return mapProductList(res.data?.data);
    } catch {
      return [];
    }
  },

  async getBestSellers(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/best-sellers');
      return mapProductList(res.data?.data);
    } catch {
      return [];
    }
  },

  async getNewArrivals(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/new-arrivals');
      return mapProductList(res.data?.data);
    } catch {
      return [];
    }
  },

  async getGiftBoxes(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/gift-boxes');
      return mapProductList(res.data?.data);
    } catch {
      return [];
    }
  },

  async getComboOffers(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/combo-offers');
      return mapProductList(res.data?.data);
    } catch {
      return [];
    }
  },

  /** The storefront's single source of combos / gift boxes.
   *  GET /products/combo-offers also matches loose legacy rows (name contains
   *  "combo", DiscountValue > 20), so the response is narrowed to products the
   *  API actually flagged `isCombo` and de-duplicated by id. Returns [] on any
   *  failure — every combo surface collapses to nothing rather than faking data. */
  async getCombos(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/combo-offers', { params: { count: 50 } });
      const seen = new Set<string>();
      return mapProductList(res.data?.data).filter((p) => {
        if (p.isCombo !== true) return false;
        const key = String(p.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch {
      return [];
    }
  },

  // BANNERS (public storefront hero/promo banners; tolerant to the endpoint being absent)
  async getBanners(placement: string = 'Home'): Promise<Array<{
    id: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    ctaText?: string;
    targetUrl?: string;
    displayOrder: number;
  }>> {
    try {
      const res = await apiClient.get('/banners', {
        params: { activeOnly: true, placement }
      });
      const raw = res.data?.data ?? res.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
      return list
        .map((b: any, i: number) => ({
          id: String(b?.id ?? i),
          title: String(b?.title ?? '').trim(),
          subtitle: b?.subtitle ? String(b.subtitle).trim() : undefined,
          imageUrl: normalizeImageUrl(b?.imageUrl),
          ctaText: b?.ctaText ? String(b.ctaText).trim() : undefined,
          targetUrl: b?.targetUrl ? String(b.targetUrl).trim() : undefined,
          displayOrder: Number(b?.displayOrder) || 0
        }))
        .sort((a: { displayOrder: number }, b: { displayOrder: number }) => a.displayOrder - b.displayOrder);
    } catch {
      return [];
    }
  },

  // CATEGORIES & BRANDS
  async getCategories(): Promise<Category[]> {
    try {
      const res = await apiClient.get('/categories');
      if (res.data?.data) {
        return res.data.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          imageUrl: normalizeImageUrl(c.imageUrl),
          displayOrder: c.displayOrder || 1,
          isActive: c.isActive ?? true,
          productCount: c.productCount || 0
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch live categories:', error);
      return [];
    }
  },

  async getBrands(): Promise<Brand[]> {
    try {
      const res = await apiClient.get('/brands');
      return res.data?.data || [];
    } catch {
      return [];
    }
  },

  // CART PRICING CALCULATION
  async calculateCart(items: Array<{ productId: string; quantity: number }>, couponCode?: string): Promise<{
    items: Array<{ productId: string; sku: string; name: string; imageUrl?: string; unitPrice: number; quantity: number; maxStock: number; lineTotal: number }>;
    totalItems: number;
    subtotal: number;
    discount: number;
    couponCode?: string;
    grandTotal: number;
  }> {
    const res = await apiClient.post('/cart/calculate', {
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      couponCode: couponCode || undefined
    });
    return res.data?.data;
  },

  // LIVE ORDER CREATION & TRACKING
  async createOrder(payload: {
    shippingAddress: Address;
    items: Array<{ product: Product; quantity: number }>;
    paymentMethod: string | number;
    couponCode?: string;
    notes?: string;
    utrNumber?: string;
    paymentScreenshotUrl?: string;
    paymentScreenshotBase64?: string;
    /** Delivery method code from GET /orders/delivery-options; 'transport' by default. */
    deliveryMethod?: string;
  }): Promise<Order> {
    // Backend requires a bare 10-digit phone: strip "+91 98765 43210" style formatting.
    const sanitizePhone = (raw: string): string => {
      let digits = (raw || '').replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
      if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
      return digits;
    };

    const res = await apiClient.post('/orders', {
      shippingAddress: {
        fullName: (payload.shippingAddress.fullName || '').trim(),
        phone: sanitizePhone(payload.shippingAddress.phone),
        addressLine1: (payload.shippingAddress.addressLine1 || '').trim(),
        addressLine2: payload.shippingAddress.addressLine2,
        city: (payload.shippingAddress.city || '').trim(),
        state: (payload.shippingAddress.state || '').trim(),
        postalCode: (payload.shippingAddress.postalCode || '').trim(),
        country: payload.shippingAddress.country || 'India'
      },
      paymentMethod: typeof payload.paymentMethod === 'number' ? payload.paymentMethod : (payload.paymentMethod === 'COD' ? 1 : 2),
      couponCode: payload.couponCode,
      notes: payload.notes,
      deliveryMethod: payload.deliveryMethod || 'transport',
      utrNumber: payload.utrNumber,
      paymentScreenshotUrl: payload.paymentScreenshotUrl,
      paymentScreenshotBase64: payload.paymentScreenshotBase64,
      items: payload.items.map(i => ({
        productId: i.product.id,
        quantity: i.quantity
      }))
    });

    if (res.data?.data) {
      return res.data.data;
    }
    throw new Error(res.data?.message || 'Failed to place live order on server');
  },

  async trackOrder(orderNumber: string): Promise<any> {
    try {
      const res = await apiClient.get(`/orders/track/${orderNumber.trim()}`);
      return res.data?.data || null;
    } catch (error) {
      console.error(`Failed to track order ${orderNumber}:`, error);
      return null;
    }
  },

  async getOrders(params?: { status?: string; search?: string }): Promise<Order[]> {
    try {
      const res = await apiClient.get('/orders', { params });
      return res.data?.data?.items || [];
    } catch {
      return [];
    }
  },

  async getCustomerOrders(customerId?: string): Promise<Order[]> {
    try {
      if (!customerId) return [];
      const res = await apiClient.get(`/orders/customer/${customerId}`);
      return res.data?.data || [];
    } catch {
      return [];
    }
  },

  // AUTH — OTP / PASSWORD RESET (see docs/API_CONTRACTS_PHASE1.md §1)
  async loginWithIdentifier(identifier: string, password: string): Promise<{ user: any; token: string }> {
    const body = identifier.includes('@')
      ? { email: identifier, identifier, password }
      : { identifier, password };
    const res = await apiClient.post('/auth/login', body);
    if (res.data?.data?.token) {
      localStorage.setItem('aadhi_customer_token', res.data.data.token);
      return res.data.data;
    }
    throw new Error(res.data?.message || 'Login failed');
  },

  async forgotPassword(identifier: string): Promise<{ message?: string; devOtp?: string }> {
    const res = await apiClient.post('/auth/forgot-password', { identifier });
    return res.data?.data ?? res.data ?? {};
  },

  async resendOtp(identifier: string): Promise<{ message?: string; devOtp?: string }> {
    const res = await apiClient.post('/auth/resend-otp', { identifier });
    return res.data?.data ?? res.data ?? {};
  },

  async verifyOtp(identifier: string, otp: string): Promise<{ resetToken: string }> {
    const res = await apiClient.post('/auth/verify-otp', { identifier, otp });
    const data = res.data?.data ?? res.data;
    if (data?.resetToken) return data;
    throw new Error(res.data?.message || 'Invalid or expired OTP');
  },

  async resetPassword(resetToken: string, newPassword: string, confirmNewPassword: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { resetToken, newPassword, confirmNewPassword });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  },

  // WISHLIST (Authorize)
  async getWishlist(): Promise<any[]> {
    try {
      const res = await apiClient.get('/wishlist');
      return res.data?.data || [];
    } catch {
      return [];
    }
  },

  async addToWishlist(productId: string): Promise<void> {
    await apiClient.post(`/wishlist/${productId}`);
  },

  async removeFromWishlist(productId: string): Promise<void> {
    await apiClient.delete(`/wishlist/${productId}`);
  },

  // ADDRESSES (Authorize)
  async getAddresses(): Promise<any[]> {
    try {
      const res = await apiClient.get('/addresses');
      return res.data?.data || [];
    } catch {
      return [];
    }
  },

  async createAddress(address: any): Promise<any> {
    const res = await apiClient.post('/addresses', address);
    return res.data?.data;
  },

  async updateAddress(id: string, address: any): Promise<any> {
    const res = await apiClient.put(`/addresses/${id}`, address);
    return res.data?.data;
  },

  async deleteAddress(id: string): Promise<void> {
    await apiClient.delete(`/addresses/${id}`);
  },

  async setDefaultAddress(id: string): Promise<void> {
    await apiClient.post(`/addresses/${id}/set-default`);
  },

  // DELIVERY OPTIONS
  // There is exactly one delivery method: the parcel goes by lorry to the destination
  // transport office and the customer pays the freight to the transport company on
  // collection. The store never charges or discounts freight, so no `charge` is read.
  async getDeliveryOptions(subtotal: number): Promise<Array<{
    code: string; name: string; note?: string; etaMinDays?: number; etaMaxDays?: number;
  }>> {
    try {
      const res = await apiClient.get('/orders/delivery-options', { params: { subtotal } });
      const list = res.data?.data;
      return Array.isArray(list) ? list : [];
    } catch {
      // Endpoint unavailable — the checkout falls back to its own transport copy.
      return [];
    }
  },

  // PAYMENT PROOF SUBMISSION
  async submitPaymentProof(orderId: string, utrNumber: string, screenshotBase64?: string): Promise<void> {
    await apiClient.post(`/orders/${orderId}/payment-proof`, { utrNumber, screenshotBase64 });
  },

  // ORDER DETAIL
  async getOrderById(id: string): Promise<any | null> {
    try {
      const res = await apiClient.get(`/orders/${id}`);
      return res.data?.data || null;
    } catch {
      return null;
    }
  }
};

export default api;
