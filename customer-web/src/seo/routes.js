/**
 * URL scheme for the AADHI CRACKERS storefront.
 *
 * Plain ESM JavaScript on purpose: this module is the single source of truth for
 * the URL scheme and is imported BOTH by the React app (TypeScript, bundled by
 * Vite) and by the Node build scripts in `scripts/` (sitemap + prerender), which
 * cannot import `.ts`.
 *
 * The app's navigation API is unchanged — `onNavigate(page, params)` still takes
 * the same page ids and params. These helpers only translate between that pair
 * and a real URL.
 *
 *   /                        home
 *   /shop                    all products              (?q= search, ?sort= sort)
 *   /shop/<category-slug>    a category listing        (?q=, ?sort=)
 *   /combos                  combo packs               (?q=, ?sort=)
 *   /gift-boxes              pre-packed gift boxes     (?q=, ?sort=)
 *   /categories              category menu
 *   /product/<slug>          product / combo detail
 *   /cart  /checkout         basket + checkout
 *   /order-confirmed         "order placed" confirmation (state-backed)
 *   /track  /track/<orderNo> order tracking
 *   /orders  /orders/<id>    my orders + order detail
 *   /account  /account/addresses  /wishlist
 *   /login  /register  /forgot-password  /verify-otp  /reset-password
 *   /about /contact /safety /terms /privacy /shipping-policy
 *   /payment/success|failed|pending
 */

/** Legacy slugs that the storefront renders as the combos view (see ShopPage). */
const COMBO_VIEW_SLUGS = new Set(['combos', 'combo-offers']);

/** Slugs that render the gift-box view. Gift boxes used to be an alias of the
 *  combos view; they are their own module now, so `gift-boxes` lands here. */
const GIFT_BOX_VIEW_SLUGS = new Set(['gift-boxes', 'giftboxes', 'gift-box']);

/** Lower-cased, dash-joined, URL-safe path segment. GUIDs pass through unchanged. */
export const slugifySegment = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

/** True when these navigation params should render the gift-box listing. */
export const isGiftBoxesView = (params) =>
  (params && (params.view === 'giftboxes' || params.view === 'gift-boxes')) ||
  GIFT_BOX_VIEW_SLUGS.has(String((params && params.category) ?? '').trim().toLowerCase());

/** True when these navigation params should render the combos listing.
 *  Checked AFTER the gift-box view, which is a separate module. */
export const isCombosView = (params) =>
  !isGiftBoxesView(params) &&
  ((params && params.view === 'combos') ||
    COMBO_VIEW_SLUGS.has(String((params && params.category) ?? '').trim().toLowerCase()));

/**
 * Screens whose content lives entirely in navigation params (an order that was
 * just placed, a payment result, an OTP in flight). They get a real URL so Back
 * works, but a *cold* load of that URL — no `history.state` to restore — has
 * nothing to show, so the app sends the visitor home instead.
 */
export const EPHEMERAL_PAGES = new Set([
  'order-placed',
  'payment-success',
  'payment-failed',
  'payment-pending',
  'otp-verification',
  'reset-password'
]);

/** Pages that must never be indexed (private, transactional or state-backed). */
export const NOINDEX_PAGES = new Set([
  'cart',
  'checkout',
  'order-placed',
  'orders',
  'my-orders',
  'order-details',
  'account',
  'addresses',
  'wishlist',
  'auth',
  'forgot-password',
  'otp-verification',
  'reset-password',
  'payment-success',
  'payment-failed',
  'payment-pending'
]);

/** Drops undefined/null/empty params so URLs and history state stay clean. */
export const compactParams = (params) => {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
};

/**
 * (page, params) → path (+ query string). Never throws; unknown pages map to `/`.
 * @param {string} page
 * @param {Record<string, any>} [params]
 * @returns {string}
 */
export function buildPath(page, params = {}) {
  const p = params || {};
  const qs = new URLSearchParams();
  if (p.search) qs.set('q', String(p.search));
  if (p.sortBy) qs.set('sort', String(p.sortBy));
  const withQuery = (path) => {
    const s = qs.toString();
    return s ? `${path}?${s}` : path;
  };

  switch (page) {
    case 'home':
      return '/';

    // `shop` and `category` render the same listing (ShopPage on desktop,
    // Screen2Category on mobile), so they share one canonical URL shape.
    case 'shop':
    case 'category': {
      if (isGiftBoxesView(p)) return withQuery('/gift-boxes');
      if (isCombosView(p)) return withQuery('/combos');
      const cat = slugifySegment(p.category);
      return withQuery(cat && cat !== 'all' ? `/shop/${cat}` : '/shop');
    }

    case 'category-menu':
      return '/categories';

    case 'product-detail': {
      // Product slugs must round-trip byte-for-byte: GET /products/<slug> resolves them.
      const slug = String(p.slug ?? '').trim();
      return slug ? `/product/${encodeURIComponent(slug)}` : '/shop';
    }

    case 'cart':
      return '/cart';
    case 'checkout':
      return '/checkout';
    case 'order-placed':
      return '/order-confirmed';

    case 'track-order': {
      const orderNumber = String(p.orderNumber ?? '').trim();
      return orderNumber ? `/track/${encodeURIComponent(orderNumber)}` : '/track';
    }

    case 'orders':
    case 'my-orders':
      return '/orders';

    case 'order-details': {
      const id = String(p.orderId ?? '').trim();
      const orderNumber = String(p.orderNumber ?? '').trim();
      if (!id) return '/orders';
      const suffix = orderNumber ? `?no=${encodeURIComponent(orderNumber)}` : '';
      return `/orders/${encodeURIComponent(id)}${suffix}`;
    }

    case 'account':
      return '/account';
    case 'addresses':
      return '/account/addresses';
    case 'wishlist':
      return '/wishlist';

    case 'auth':
      return p.initialTab === 'register' ? '/register' : '/login';
    case 'forgot-password':
      return '/forgot-password';
    case 'otp-verification':
      return '/verify-otp';
    case 'reset-password':
      return '/reset-password';

    case 'about':
      return '/about';
    case 'contact':
      return '/contact';
    case 'safety':
      return '/safety';
    case 'terms':
      return '/terms';
    case 'privacy':
      return '/privacy';
    case 'shipping-policy':
      return '/shipping-policy';

    case 'payment-success':
      return '/payment/success';
    case 'payment-failed':
      return '/payment/failed';
    case 'payment-pending':
      return '/payment/pending';

    default:
      return '/';
  }
}

/**
 * path (+ query) → { page, params, matched }. `matched: false` means the URL is
 * not part of the scheme: the app renders Home and the page is marked noindex
 * so an unknown URL never becomes an indexable soft-404 duplicate of the home page.
 *
 * @param {string} pathname
 * @param {string} [search]
 * @returns {{ page: string, params: Record<string, any>, matched: boolean }}
 */
export function parsePath(pathname, search = '') {
  const qs = new URLSearchParams(search || '');
  const q = qs.get('q') || undefined;
  const sort = qs.get('sort') || undefined;
  const orderNumber = qs.get('no') || undefined;

  let segments;
  try {
    segments = String(pathname || '/')
      .split('/')
      .filter(Boolean)
      .map((s) => decodeURIComponent(s));
  } catch {
    segments = String(pathname || '/').split('/').filter(Boolean);
  }

  const hit = (page, params = {}) => ({ page, params: compactParams(params), matched: true });
  const miss = () => ({ page: 'home', params: {}, matched: false });

  if (segments.length === 0) return hit('home');

  const [first, second] = segments;

  switch (first) {
    case 'shop':
      if (segments.length === 1) return hit('shop', { search: q, sortBy: sort });
      if (segments.length === 2) return hit('shop', { category: second, search: q, sortBy: sort });
      return miss();

    case 'combos':
      if (segments.length === 1) return hit('shop', { view: 'combos', search: q, sortBy: sort });
      return miss();

    case 'gift-boxes':
      if (segments.length === 1) return hit('shop', { view: 'giftboxes', search: q, sortBy: sort });
      return miss();

    case 'categories':
      return segments.length === 1 ? hit('category-menu') : miss();

    case 'product':
      return segments.length === 2 && second ? hit('product-detail', { slug: second }) : miss();

    case 'cart':
      return segments.length === 1 ? hit('cart') : miss();
    case 'checkout':
      return segments.length === 1 ? hit('checkout') : miss();
    case 'order-confirmed':
      return segments.length === 1 ? hit('order-placed') : miss();

    case 'track':
      if (segments.length === 1) return hit('track-order');
      if (segments.length === 2) return hit('track-order', { orderNumber: second });
      return miss();

    case 'orders':
      if (segments.length === 1) return hit('my-orders');
      if (segments.length === 2) return hit('order-details', { orderId: second, orderNumber });
      return miss();

    case 'account':
      if (segments.length === 1) return hit('account');
      if (segments.length === 2 && second === 'addresses') return hit('addresses');
      return miss();

    case 'wishlist':
      return segments.length === 1 ? hit('wishlist') : miss();

    case 'login':
      return segments.length === 1 ? hit('auth', { initialTab: 'login' }) : miss();
    case 'register':
      return segments.length === 1 ? hit('auth', { initialTab: 'register' }) : miss();
    case 'forgot-password':
      return segments.length === 1 ? hit('forgot-password') : miss();
    case 'verify-otp':
      return segments.length === 1 ? hit('otp-verification') : miss();
    case 'reset-password':
      return segments.length === 1 ? hit('reset-password') : miss();

    case 'about':
      return segments.length === 1 ? hit('about') : miss();
    case 'contact':
      return segments.length === 1 ? hit('contact') : miss();
    case 'safety':
      return segments.length === 1 ? hit('safety') : miss();
    case 'terms':
      return segments.length === 1 ? hit('terms') : miss();
    case 'privacy':
      return segments.length === 1 ? hit('privacy') : miss();
    case 'shipping-policy':
      return segments.length === 1 ? hit('shipping-policy') : miss();

    case 'payment':
      if (segments.length === 2 && second === 'success') return hit('payment-success');
      if (segments.length === 2 && second === 'failed') return hit('payment-failed');
      if (segments.length === 2 && second === 'pending') return hit('payment-pending');
      return miss();

    default:
      return miss();
  }
}
