import axios from 'axios';
import {
  Product,
  Category,
  Brand,
  Order,
  Address,
  CartItem
} from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5050/api/v1';

/** Converts Google Drive share links into direct-image URLs usable in <img> tags.
 *  Any other URL passes through unchanged. Mirrors the backend ImageUrlNormalizer. */
export const normalizeImageUrl = (url?: string | null): string | undefined => {
  if (!url || !url.trim()) return undefined;
  const trimmed = url.trim();
  if (!/drive\.google\.com/i.test(trimmed)) return trimmed;
  if (/drive\.google\.com\/thumbnail/i.test(trimmed)) return trimmed;
  const match =
    trimmed.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/i) ||
    trimmed.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
  if (!match) return trimmed;
  return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
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

export const api = {
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

  async register(data: { firstName: string; lastName: string; email: string; phone: string; password: string }): Promise<{ user: any; token: string }> {
    const res = await apiClient.post('/auth/register', data);
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
        return res.data.data.items.map((p: any) => ({
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
          primaryImageUrl: normalizeImageUrl(p.primaryImageUrl) || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600&auto=format&fit=crop&q=80',
          images: (p.images || []).map((img: any) =>
            typeof img === 'string' ? normalizeImageUrl(img) : { ...img, url: normalizeImageUrl(img?.url) }
          )
        }));
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
        const p = res.data.data;
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          slug: p.slug,
          description: p.description,
          shortDescription: p.shortDescription,
          categoryId: p.categoryId,
          categoryName: p.categoryName,
          brandId: p.brandId,
          brandName: p.brandName,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          costPrice: p.costPrice,
          taxRate: p.taxRate,
          discountType: p.discountType,
          discountValue: p.discountValue,
          discountPercentage: p.discountPercentage,
          stockQuantity: p.stockQuantity,
          availableQuantity: p.availableQuantity,
          reorderLevel: p.reorderLevel,
          unit: p.unit,
          weightKg: p.weightKg,
          isActive: p.isActive,
          isFeatured: p.isFeatured,
          isBestSeller: p.isBestSeller,
          isNewArrival: p.isNewArrival,
          primaryImageUrl: normalizeImageUrl(p.primaryImageUrl),
          images: (p.images || []).map((img: any) =>
            typeof img === 'string' ? normalizeImageUrl(img) : { ...img, url: normalizeImageUrl(img?.url) }
          )
        };
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
      return res.data?.data || [];
    } catch {
      return [];
    }
  },

  async getBestSellers(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/best-sellers');
      return res.data?.data || [];
    } catch {
      return [];
    }
  },

  async getNewArrivals(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/new-arrivals');
      return res.data?.data || [];
    } catch {
      return [];
    }
  },

  async getGiftBoxes(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/gift-boxes');
      return res.data?.data || [];
    } catch {
      return [];
    }
  },

  async getComboOffers(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/combo-offers');
      return res.data?.data || [];
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
    shippingCharge: number;
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
      deliveryMethod: payload.deliveryMethod || 'standard',
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
  async getDeliveryOptions(subtotal: number): Promise<Array<{
    code: string; name: string; charge: number; etaMinDays: number; etaMaxDays: number;
  }>> {
    try {
      const res = await apiClient.get('/orders/delivery-options', { params: { subtotal } });
      return res.data?.data || [];
    } catch {
      return [
        { code: 'standard', name: 'Standard Delivery (3-5 Days)', charge: 40, etaMinDays: 3, etaMaxDays: 5 },
        { code: 'express', name: 'Express Delivery (1-2 Days)', charge: 90, etaMinDays: 1, etaMaxDays: 2 }
      ];
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
  },

  // RETURNS & REFUNDS (customer)
  async getMyReturns(): Promise<any[]> {
    try {
      const res = await apiClient.get('/returns/my');
      return res.data?.data || [];
    } catch {
      return [];
    }
  },

  async createReturn(payload: {
    orderId: string;
    reason: string;
    comments?: string;
    items: Array<{ orderItemId: string; quantity: number }>;
  }): Promise<any> {
    const res = await apiClient.post('/returns', payload);
    return res.data?.data;
  }
};

export default api;
