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

/** `PaymentMethod.UPI` in the API enum — the only method a storefront order is
 *  ever created with (see createOrder). */
const UPI_PAYMENT_METHOD = 2;

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

/** Combo + gift-box fields (ProductDto.isCombo / isGiftBox, comboItemCount and,
 *  on the detail DTO, comboItems / comboItemsTotal). The API may not expose them
 *  yet, so every field stays undefined when absent and the UI simply hides itself.
 *  A gift box is a sealed single SKU: it carries `isGiftBox` but never comboItems. */
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
    isGiftBox: typeof p?.isGiftBox === 'boolean' ? p.isGiftBox : undefined,
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

/* ── Short-lived caches for public catalogue reads ──────────────────────────
   The <head> builder (src/seo/SeoHead.tsx) needs the same product/category data
   the visible page already fetches. A short TTL de-duplicates those concurrent
   requests instead of doubling them; anything older than the TTL is refetched,
   so stock/price changes still show up. */
const CATALOGUE_TTL_MS = 30_000;

interface CacheEntry<T> { at: number; value: Promise<T>; }
const catalogueCache = new Map<string, CacheEntry<any>>();

const cached = <T,>(key: string, load: () => Promise<T>): Promise<T> => {
  const hit = catalogueCache.get(key);
  if (hit && Date.now() - hit.at < CATALOGUE_TTL_MS) return hit.value as Promise<T>;
  const value = load().catch((error) => {
    catalogueCache.delete(key);
    throw error;
  });
  catalogueCache.set(key, { at: Date.now(), value });
  return value;
};

/* ── The authoritative price quote ────────────────────────────────────────────
   POST /cart/calculate runs the SAME arithmetic the order will
   (OrderPricingService.Calculate on the server), so the components below are the
   components the created order will carry. The storefront must never re-derive a
   payable amount from these parts — it displays them and pays `grandTotal`.

   `subtotal` is a legacy alias for `itemsSubtotal` kept for older callers. The
   breakdown fields (`itemsSubtotal`, `tax`, `packingCharges`, `packingChargePercent`)
   are only present on an API build that carries the quote fix; a response missing
   any of them is NOT a quote we can charge against — see isAuthoritativeQuote. */
export interface CartQuoteLine {
  productId: string;
  sku: string;
  name: string;
  imageUrl?: string;
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
  maxStock: number;
  lineTotal: number;
}

export interface CartQuote {
  items: CartQuoteLine[];
  totalItems: number;
  /** Legacy alias of itemsSubtotal. */
  subtotal: number;
  itemsSubtotal: number;
  discount: number;
  couponCode?: string | null;
  /** GST on the lines, at each product's own tax rate. */
  tax: number;
  packingCharges: number;
  /** The rate packingCharges was computed at, e.g. 1.5 for 1.5%. */
  packingChargePercent: number;
  /** Always 0 — freight is To-Pay, settled with the transport company. */
  shippingCharge: number;
  /** itemsSubtotal - discount + tax + shippingCharge + packingCharges. */
  grandTotal: number;
}

/* ── Order notifications ─────────────────────────────────────────────
   The shop tells the customer what is happening to their order out of OUR OWN
   database — no third-party SMS / WhatsApp / e-mail provider is in the loop. The
   row that matters most is `OrderDispatched`: it carries the transport company,
   the LR / waybill number and the transport office phone + address, which is how
   the customer knows where to collect the goods from.

   `type` stays a plain string so an unknown value from a newer API build still
   renders as its own title / message instead of breaking the list. The four
   carrier fields are populated on `OrderDispatched` (and repeated on an
   `OrderStatusChanged` → Shipped row); phone and address are null on orders
   dispatched before the API recorded them. Every optional string is trimmed to
   `undefined` by the mapper below, so a caller renders a row only when it
   actually has a value — never an empty line or a stray dash. */
export type NotificationType =
  | 'OrderPlaced'
  | 'PaymentVerified'
  | 'PaymentRejected'
  | 'OrderStatusChanged'
  | 'OrderDispatched';

export interface AppNotification {
  id: string;
  /** One of NotificationType — left open so an unrecognised value still shows. */
  type: string;
  title: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
  isRead: boolean;
  createdAtUtc?: string;
  readAtUtc?: string;
  orderStatus?: string;
  carrierName?: string;
  trackingNumber?: string;
  carrierPhone?: string;
  carrierAddress?: string;
  /** Flat string map the API may attach, or undefined. */
  data?: Record<string, string>;
}

export interface NotificationPage {
  items: AppNotification[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  unreadCount: number;
}

/** Answer of POST /notifications/{id}/read and /notifications/read-all. Both
 *  carry the NEW unread count, so the bell badge never needs a refetch. */
export interface NotificationReadResult {
  markedCount: number;
  unreadCount: number;
}

const emptyNotificationPage = (pageSize = 20): NotificationPage => ({
  items: [],
  pageNumber: 1,
  pageSize,
  totalCount: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
  unreadCount: 0
});

/** Trimmed text, or undefined when the API sent null / '' / whitespace. */
const optionalText = (value: any): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
};

const mapNotificationData = (raw: any): Record<string, string> | undefined => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && value !== undefined) map[key] = String(value);
  }
  return Object.keys(map).length > 0 ? map : undefined;
};

/** Single NotificationDto → AppNotification. EVERY notification-returning
 *  endpoint funnels through here, so the signed-in feed and the anonymous
 *  per-order feed are normalized identically. */
const mapNotificationDto = (n: any): AppNotification => ({
  id: String(n?.id ?? ''),
  type: String(n?.type ?? '').trim(),
  title: String(n?.title ?? '').trim(),
  message: String(n?.message ?? '').trim(),
  orderId: optionalText(n?.orderId),
  orderNumber: optionalText(n?.orderNumber),
  isRead: n?.isRead === true,
  createdAtUtc: optionalText(n?.createdAtUtc),
  readAtUtc: optionalText(n?.readAtUtc),
  orderStatus: optionalText(n?.orderStatus),
  carrierName: optionalText(n?.carrierName),
  trackingNumber: optionalText(n?.trackingNumber),
  carrierPhone: optionalText(n?.carrierPhone),
  carrierAddress: optionalText(n?.carrierAddress),
  data: mapNotificationData(n?.data)
});

/** Accepts either a bare array or a `{ items: [] }` page and maps both. A row
 *  carrying neither a title nor a message would render as an empty line, so it
 *  is dropped rather than shown. */
const mapNotificationList = (raw: any): AppNotification[] => {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
  return list
    .filter((n: any) => n && n.id)
    .map((n: any) => mapNotificationDto(n))
    .filter((n: AppNotification) => n.title.length > 0 || n.message.length > 0);
};

const mapNotificationReadResult = (raw: any): NotificationReadResult | null => {
  if (!raw || typeof raw !== 'object') return null;
  const unreadCount = Number(raw.unreadCount);
  if (!Number.isFinite(unreadCount)) return null;
  return {
    markedCount: Number(raw.markedCount) || 0,
    unreadCount: Math.max(0, unreadCount)
  };
};

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
    excludeCombos?: boolean;
    excludeGiftBoxes?: boolean;
  }): Promise<Product[]> {
    try {
      const queryParams: Record<string, any> = { ...params };
      if (params?.category && !params.categorySlug) {
        queryParams.categorySlug = params.category.toLowerCase().replace(/\s+/g, '-');
      }
      // Only ever send the flags when they are on; never `exclude…=false`.
      if (params?.excludeCombos) queryParams.excludeCombos = true;
      else delete queryParams.excludeCombos;
      if (params?.excludeGiftBoxes) queryParams.excludeGiftBoxes = true;
      else delete queryParams.excludeGiftBoxes;
      const res = await apiClient.get('/products', { params: queryParams });
      if (res.data?.data?.items) {
        const list = mapProductList(res.data.data.items);
        // Belt and braces: the flags are honoured server-side, but a product that
        // slips through still must not appear in an ordinary listing. Products
        // whose DTO omits the flag entirely are left alone (undefined ≠ true).
        return list.filter(
          (p) =>
            !(params?.excludeCombos && p.isCombo === true) &&
            !(params?.excludeGiftBoxes && p.isGiftBox === true)
        );
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch live products from API:', error);
      return [];
    }
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    return cached(`product:${slug}`, async () => {
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
    });
  },

  async getFeaturedProducts(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/featured');
      return mapProductList(res.data?.data).filter((p) => !p.isCombo && !p.isGiftBox);
    } catch {
      return [];
    }
  },

  async getBestSellers(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/best-sellers');
      return mapProductList(res.data?.data).filter((p) => !p.isCombo && !p.isGiftBox);
    } catch {
      return [];
    }
  },

  async getNewArrivals(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/new-arrivals');
      return mapProductList(res.data?.data).filter((p) => !p.isCombo && !p.isGiftBox);
    } catch {
      return [];
    }
  },

  /** Gift boxes: pre-packed sealed SKUs, their own storefront section.
   *  Mirrors getCombos() — the endpoint has historically returned false
   *  positives, so the `isGiftBox` flag is re-checked here and the list is
   *  de-duplicated by id. Any failure collapses to an empty list, and the
   *  gift-box UI renders nothing at all. */
  async getGiftBoxes(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/gift-boxes', { params: { count: 50 } });
      const seen = new Set<string>();
      return mapProductList(res.data?.data).filter((p) => {
        if (p.isGiftBox !== true) return false;
        const key = String(p.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
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

  async getCombos(): Promise<Product[]> {
    try {
      const res = await apiClient.get('/products/combo-offers', { params: { count: 50 } });
      const seen = new Set<string>();
      return mapProductList(res.data?.data).filter((p) => {
        if (p.isCombo !== true) return false;
        // Gift boxes are their own module — never mixed into the combos list.
        if (p.isGiftBox === true) return false;
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
    return cached('categories', async () => {
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
            productCount: c.productCount || 0,
            // Owner-editable category SEO overrides. Present on the Category entity and
            // on Create/UpdateCategoryRequest, but NOT yet projected onto CategoryDto —
            // they stay undefined until the API exposes them, and the storefront then
            // falls back to a derived title/description. See the SEO notes in README.
            seoTitle: c.seoTitle || undefined,
            seoDescription: c.seoDescription || undefined,
            subCategories: Array.isArray(c.subCategories) ? c.subCategories : []
          }));
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch live categories:', error);
        return [];
      }
    });
  },

  async getBrands(): Promise<Brand[]> {
    try {
      const res = await apiClient.get('/brands');
      return res.data?.data || [];
    } catch {
      return [];
    }
  },

  // CART PRICING CALCULATION — the authoritative quote (see CartQuote above).
  // Returned raw: callers that state a payable amount MUST first run it through
  // isAuthoritativeQuote() (src/utils/checkoutQuote.ts) rather than reading fields
  // straight off it, because an older API build answers with a partial breakdown.
  async calculateCart(items: Array<{ productId: string; quantity: number }>, couponCode?: string): Promise<CartQuote> {
    const res = await apiClient.post('/cart/calculate', {
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      couponCode: couponCode || undefined
    });
    return res.data?.data;
  },

  // LIVE ORDER CREATION & TRACKING
  //
  // Every storefront order is paid up front by UPI / bank transfer and evidenced by
  // a UTR the store verifies — there is no cash at delivery, because the goods go by
  // lorry and the customer pays the freight to the transport company on collection.
  // So the payment method is not a choice the caller makes: it is always UPI (2 in
  // the API's PaymentMethod enum), and POST /orders rejects COD outright. Historical
  // COD orders keep their own value and still display everywhere they always did.
  async createOrder(payload: {
    shippingAddress: Address;
    items: Array<{ product: Product; quantity: number }>;
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
      paymentMethod: UPI_PAYMENT_METHOD,
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

  async forgotPassword(identifier: string): Promise<{ message?: string }> {
    const res = await apiClient.post('/auth/forgot-password', { identifier });
    return res.data?.data ?? res.data ?? {};
  },

  async resendOtp(identifier: string): Promise<{ message?: string }> {
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

  async submitPaymentProof(params: {
    orderId: string;
    /** Required for guests; harmless (and still sent) for logged-in customers. */
    orderNumber: string;
    utrNumber: string;
    screenshotBase64?: string;
    paymentScreenshotUrl?: string;
    notes?: string;
  }): Promise<any> {
    const screenshot = params.screenshotBase64 || undefined;
    const res = await apiClient.post(`/orders/${params.orderId}/payment-proof`, {
      orderNumber: (params.orderNumber || '').trim(),
      utrNumber: (params.utrNumber || '').trim(),
      // Both aliases carry the same image so the API reads it whichever it prefers.
      screenshotBase64: screenshot,
      paymentScreenshotBase64: screenshot,
      paymentScreenshotUrl: params.paymentScreenshotUrl || undefined,
      notes: params.notes || undefined
    });
    return res.data?.data ?? null;
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

  // NOTIFICATIONS — order updates, straight out of the store's own database.
  //
  // Every call here is tolerant: a failure (endpoint absent on an older API
  // build, network down, 401 after the token expired) answers with an empty page
  // / empty list / null, so the bell and the tracking screen show nothing at all
  // rather than throwing into the UI.

  /** The signed-in customer's feed, newest first. Paged — the caller walks the
   *  pages with `hasNextPage` instead of asking for everything at once. */
  async getNotifications(page: number = 1, pageSize: number = 20): Promise<NotificationPage> {
    try {
      const res = await apiClient.get('/notifications', { params: { page, pageSize } });
      const d = res.data?.data;
      if (!d) return emptyNotificationPage(pageSize);
      const items = mapNotificationList(d.items);
      const pageNumber = Number(d.pageNumber) || page;
      const totalPages = Number(d.totalPages) || (items.length > 0 ? pageNumber : 0);
      return {
        items,
        pageNumber,
        pageSize: Number(d.pageSize) || pageSize,
        totalCount: Number(d.totalCount) || items.length,
        totalPages,
        hasPreviousPage:
          typeof d.hasPreviousPage === 'boolean' ? d.hasPreviousPage : pageNumber > 1,
        hasNextPage:
          typeof d.hasNextPage === 'boolean' ? d.hasNextPage : pageNumber < totalPages,
        unreadCount: Math.max(0, Number(d.unreadCount) || 0)
      };
    } catch {
      return emptyNotificationPage(pageSize);
    }
  },

  /** ANONYMOUS — a guest has no account and so the bell can never help them.
   *  Their order number is the only handle they have, and this is how they learn
   *  which transport company to collect the goods from. Newest first. */
  async getOrderNotifications(orderNumber: string): Promise<AppNotification[]> {
    const number = (orderNumber || '').trim();
    if (!number) return [];
    try {
      const res = await apiClient.get(`/notifications/order/${encodeURIComponent(number)}`);
      return mapNotificationList(res.data?.data);
    } catch {
      return [];
    }
  },

  /** Marks one notification read. Returns the server's NEW unread count, which
   *  the badge adopts directly; null means the call did not land. */
  async markNotificationRead(id: string): Promise<NotificationReadResult | null> {
    const key = (id || '').trim();
    if (!key) return null;
    try {
      const res = await apiClient.post(`/notifications/${encodeURIComponent(key)}/read`);
      return mapNotificationReadResult(res.data?.data);
    } catch {
      return null;
    }
  },

  /** Marks the whole feed read. Same contract as markNotificationRead. */
  async markAllNotificationsRead(): Promise<NotificationReadResult | null> {
    try {
      const res = await apiClient.post('/notifications/read-all');
      return mapNotificationReadResult(res.data?.data);
    } catch {
      return null;
    }
  }
};

export default api;
