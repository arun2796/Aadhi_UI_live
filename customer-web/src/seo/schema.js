/**
 * Per-page metadata and JSON-LD builders for the AADHI CRACKERS storefront.
 *
 * Plain ESM JavaScript on purpose — imported both by the React app (bundled by
 * Vite) and by the Node build scripts in `scripts/`, which cannot import `.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS IDENTITY IS NEVER HARDCODED.
 * Store name / address / phone / email all come from `GET /settings/public`
 * (`Store.BusinessName`, `Store.Address`, `Store.Phone`, `Store.Email`).
 * Values that look like unedited placeholders are DROPPED rather than published
 * as structured fact — see `isPlaceholder*` below. Fix the values in the admin
 * Settings screen and the structured data corrects itself with no code change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buildPath, isCombosView, isGiftBoxesView, slugifySegment, NOINDEX_PAGES } from './routes.js';

/* ── text helpers ────────────────────────────────────────────────────────── */

/** Strips tags/entities/markdown noise and collapses whitespace. */
export const plainText = (value) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/^\s*[\d]+\.\s*/gm, '')
    .replace(/[*_`#>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Clamps to `max` characters at a word boundary, adding an ellipsis. */
export const clamp = (value, max = 158) => {
  const text = plainText(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\-\s]+$/, '')}…`;
};

/** Joins non-empty fragments into one sentence-ish description, then clamps it. */
export const composeDescription = (parts, max = 158) =>
  clamp(parts.filter((p) => p && String(p).trim()).join(' ').replace(/\s+/g, ' '), max);

export const titleCase = (value) =>
  String(value ?? '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const formatInr = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

/* ── placeholder detection ───────────────────────────────────────────────── */

/**
 * Well-known dummy phone numbers. `+91 98765 43210` is the value currently in
 * the database and is the canonical Indian "example" number — publishing it as
 * a LocalBusiness telephone would be publishing a false fact.
 */
const PLACEHOLDER_PHONE_DIGITS = new Set([
  '9876543210',
  '1234567890',
  '9999999999',
  '0000000000',
  '1111111111'
]);

export const isPlaceholderPhone = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return true;
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  if (local.length < 10) return true;
  if (PLACEHOLDER_PHONE_DIGITS.has(local)) return true;
  return /^(\d)\1{9}$/.test(local);
};

const PLACEHOLDER_EMAIL_PATTERNS = [
  /@example\.(com|org|net)$/i,
  /^(test|demo|sample|placeholder|noreply|no-reply)@/i,
  /@(test|demo|sample|placeholder)\./i
];

export const isPlaceholderEmail = (value) => {
  const email = String(value ?? '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return true;
  return PLACEHOLDER_EMAIL_PATTERNS.some((re) => re.test(email));
};

const PLACEHOLDER_ADDRESS_PATTERNS = [
  /\b123,?\s*(west|main|first|test|sample)\s+street\b/i,
  /\byour\s+(address|street|city)\b/i,
  /\b(lorem|ipsum|placeholder|dummy|sample address|address line 1|xxxx+)\b/i,
  /^\s*(n\/?a|tbd|-+)\s*$/i
];

export const isPlaceholderAddress = (value) => {
  const address = String(value ?? '').trim();
  // Too short to be a real postal address.
  if (address.length < 12) return true;
  return PLACEHOLDER_ADDRESS_PATTERNS.some((re) => re.test(address));
};

/**
 * Splits a single-line Indian postal address into PostalAddress parts.
 * Returns null when it cannot be parsed with confidence — a partial address is
 * better omitted than published wrong.
 *
 * Handles the shape the admin Settings screen produces:
 *   "<street…>, <city>, <state> - <pincode>"
 */
export const parsePostalAddress = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw || isPlaceholderAddress(raw)) return null;

  const postalMatch = raw.match(/\b(\d{6})\b/);
  const postalCode = postalMatch ? postalMatch[1] : undefined;

  const withoutPin = raw.replace(/[-–,\s]*\b\d{6}\b\s*$/, '').trim();
  const parts = withoutPin
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const region = parts[parts.length - 1];
  const locality = parts[parts.length - 2];
  const street = parts.slice(0, -2).join(', ');

  if (!region || !locality) return null;

  return {
    '@type': 'PostalAddress',
    ...(street ? { streetAddress: street } : {}),
    addressLocality: locality,
    addressRegion: region,
    ...(postalCode ? { postalCode } : {}),
    addressCountry: 'IN'
  };
};

/* ── business identity, sanitised ────────────────────────────────────────── */

/** Only used when `Store.BusinessName` is missing entirely — matches the <title>. */
const FALLBACK_STORE_NAME = 'Aadhi Crackers';

/**
 * Turns the raw `GET /settings/public` map into the verified subset that may be
 * published as structured data. Anything that looks like an unedited placeholder
 * comes back undefined, and `warnings` names it so the build can print it.
 *
 * @param {Record<string, string>} settings
 */
export function resolveBusiness(settings = {}) {
  const get = (key) => String(settings?.[key] ?? '').trim();

  const name = get('Store.BusinessName') || FALLBACK_STORE_NAME;
  const tagline = get('Store.Tagline');

  const rawPhone = get('Store.Phone');
  const rawEmail = get('Store.Email');
  const rawAddress = get('Store.Address');

  const warnings = [];
  let telephone;
  if (!rawPhone) warnings.push('Store.Phone is empty — telephone omitted from structured data.');
  else if (isPlaceholderPhone(rawPhone)) warnings.push(`Store.Phone "${rawPhone}" looks like a placeholder — telephone omitted from structured data.`);
  else telephone = rawPhone.replace(/\s+/g, ' ');

  let email;
  if (!rawEmail) warnings.push('Store.Email is empty — email omitted from structured data.');
  else if (isPlaceholderEmail(rawEmail)) warnings.push(`Store.Email "${rawEmail}" looks like a placeholder — email omitted from structured data.`);
  else email = rawEmail;

  let address;
  if (!rawAddress) warnings.push('Store.Address is empty — postal address omitted from structured data.');
  else if (isPlaceholderAddress(rawAddress)) warnings.push(`Store.Address "${rawAddress}" looks like a placeholder — postal address omitted from structured data.`);
  else {
    address = parsePostalAddress(rawAddress);
    if (!address) warnings.push(`Store.Address "${rawAddress}" could not be parsed into a PostalAddress — omitted from structured data.`);
  }

  return { name, tagline, telephone, email, address, warnings };
}

/* ── URL helpers ─────────────────────────────────────────────────────────── */

export const stripTrailingSlash = (origin) => String(origin || '').replace(/\/+$/, '');

/** Absolute URL from an origin + app path. Falls back to the path when no origin. */
export const absoluteUrl = (origin, path = '/') => {
  const base = stripTrailingSlash(origin);
  const suffix = String(path || '/').startsWith('/') ? path : `/${path}`;
  return base ? `${base}${suffix}` : suffix;
};

/** Product/category images are already absolute (CDN or API origin) after api.normalizeImageUrl. */
export const absoluteImage = (origin, url) => {
  const value = String(url ?? '').trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return absoluteUrl(origin, value);
};

/* ── JSON-LD graphs ──────────────────────────────────────────────────────── */

export const organizationLd = (business, origin, logoUrl) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${absoluteUrl(origin, '/')}#organization`,
  name: business.name,
  url: absoluteUrl(origin, '/'),
  ...(business.tagline ? { slogan: business.tagline } : {}),
  ...(logoUrl ? { logo: absoluteImage(origin, logoUrl) } : {}),
  ...(business.email ? { email: business.email } : {}),
  ...(business.telephone ? { telephone: business.telephone } : {}),
  ...(business.address ? { address: business.address } : {}),
  areaServed: { '@type': 'Country', name: 'India' },
  ...(business.telephone || business.email
    ? {
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            ...(business.telephone ? { telephone: business.telephone } : {}),
            ...(business.email ? { email: business.email } : {}),
            areaServed: 'IN',
            availableLanguage: ['en', 'ta']
          }
        ]
      }
    : {})
});

export const webSiteLd = (business, origin) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${absoluteUrl(origin, '/')}#website`,
  name: business.name,
  url: absoluteUrl(origin, '/'),
  inLanguage: 'en-IN',
  publisher: { '@id': `${absoluteUrl(origin, '/')}#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${absoluteUrl(origin, '/shop')}?q={search_term_string}`
    },
    'query-input': 'required name=search_term_string'
  }
});

/**
 * LocalBusiness for the geo/local signal. Emitted with verified properties only:
 * a placeholder address/phone/email is left out rather than published as fact.
 * `geo` and `openingHours` are omitted entirely — the API exposes neither, and
 * inventing coordinates or opening hours would be inventing business facts.
 */
export const localBusinessLd = (business, origin, imageUrl) => ({
  '@context': 'https://schema.org',
  '@type': 'Store',
  '@id': `${absoluteUrl(origin, '/')}#localbusiness`,
  name: business.name,
  url: absoluteUrl(origin, '/'),
  ...(business.tagline ? { description: business.tagline } : {}),
  ...(imageUrl ? { image: absoluteImage(origin, imageUrl) } : {}),
  ...(business.telephone ? { telephone: business.telephone } : {}),
  ...(business.email ? { email: business.email } : {}),
  ...(business.address ? { address: business.address } : {}),
  areaServed: { '@type': 'Country', name: 'India' },
  currenciesAccepted: 'INR',
  parentOrganization: { '@id': `${absoluteUrl(origin, '/')}#organization` }
});

export const breadcrumbLd = (crumbs, origin) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    ...(crumb.path ? { item: absoluteUrl(origin, crumb.path) } : {})
  }))
});

/**
 * Product JSON-LD.
 *
 * NO AggregateRating / Review is emitted unless the API genuinely returns
 * `rating` > 0 AND `reviewCount` > 0. Today every product comes back with
 * rating 0 / reviewCount 0, so no rating markup is produced — by design.
 */
/**
 * ISO date one year out, used for Offer.priceValidUntil.
 *
 * Deliberately a plain date (no time component): Google reads it as "the quoted price is good
 * until at least this day", and a timestamp implies a precision the shop does not actually
 * commit to.
 */
const priceValidUntilDate = () => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

export const productLd = (product, origin, business) => {
  const url = absoluteUrl(origin, buildPath('product-detail', { slug: product.slug }));
  const images = [
    product.primaryImageUrl,
    ...(Array.isArray(product.images)
      ? product.images.map((img) => (typeof img === 'string' ? img : img && img.url))
      : [])
  ]
    .map((img) => absoluteImage(origin, img))
    .filter((img, index, arr) => img && arr.indexOf(img) === index);

  const available = Number(product.availableQuantity ?? product.stockQuantity ?? 0) > 0 && product.isActive !== false;

  const rating = Number(product.rating) || 0;
  const reviewCount = Number(product.reviewCount) || 0;
  const hasRealRating = rating > 0 && reviewCount > 0;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    url,
    ...(images.length ? { image: images } : {}),
    description: productDescription(product),
    ...(product.sku ? { sku: product.sku, mpn: product.sku } : {}),
    ...(product.brandName ? { brand: { '@type': 'Brand', name: product.brandName } } : {}),
    ...(product.categoryName
      ? {
          category:
            product.isGiftBox === true ? 'Gift Box' : product.isCombo === true ? 'Combo Pack' : product.categoryName
        }
      : {}),
    ...(Number(product.weightKg) > 0
      ? { weight: { '@type': 'QuantitativeValue', value: Number(product.weightKg), unitCode: 'KGM' } }
      : {}),
    offers: {
      '@type': 'Offer',
      '@id': `${url}#offer`,
      url,
      price: Number(product.price),
      priceCurrency: 'INR',
      availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',

      // Google reports an Offer with no priceValidUntil as a non-critical issue and may stop
      // showing the price in rich results once it considers the quote stale. A year out is the
      // conventional answer for a catalogue with no scheduled price change; the prerender is
      // regenerated on every deploy, so this never drifts far from "today".
      priceValidUntil: priceValidUntilDate(),

      // Stated because it is TRUE, not to win a rich result: the printed terms are "goods once
      // sold are not returnable or exchangeable". Declaring an accurate restrictive policy is
      // what stops Google guessing, and it is the honest signal to a shopper comparing sellers.
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted'
      },

      ...(business && business.name
        ? { seller: { '@type': 'Organization', name: business.name, '@id': `${absoluteUrl(origin, '/')}#organization` } }
        : {})
    },
    ...(hasRealRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating,
            reviewCount
          }
        }
      : {}),
    ...(Array.isArray(product.comboItems) && product.comboItems.length > 0
      ? {
          isRelatedTo: product.comboItems.slice(0, 25).map((item) => ({
            '@type': 'Product',
            name: item.productName,
            ...(item.sku ? { sku: item.sku } : {})
          }))
        }
      : {})
  };
};

/** ItemList for a listing page — lets generative engines enumerate the catalogue. */
export const itemListLd = (products, origin, name) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  ...(name ? { name } : {}),
  numberOfItems: products.length,
  itemListElement: products.slice(0, 60).map((product, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: absoluteUrl(origin, buildPath('product-detail', { slug: product.slug })),
    name: product.name
  }))
});

/* ── page metadata ───────────────────────────────────────────────────────── */

/** A genuinely descriptive product description, never truncated raw HTML. */
export const productDescription = (product) => {
  const body = plainText(product.description);
  const short = plainText(product.shortDescription);
  const priceLine = Number(product.price) > 0 ? `${formatInr(product.price)}.` : '';
  const kind =
    product.isGiftBox === true
      ? 'gift box'
      : product.isCombo === true
      ? 'combo pack'
      : String(product.categoryName || 'fireworks').toLowerCase();

  if (body.length >= 60) return clamp(body);
  if (short) return composeDescription([`${product.name} —`, `${short}.`, priceLine, 'Buy online with delivery across India.']);
  return composeDescription([
    `Buy ${product.name}`,
    product.brandName ? `by ${product.brandName}` : '',
    `— ${kind} from Sivakasi.`,
    priceLine,
    'Delivered across India.'
  ]);
};

const STATIC_PAGE_META = {
  about: {
    title: 'About Us',
    description:
      'AADHI CRACKERS is a Sivakasi fireworks maker and direct-to-consumer distributor, supplying PESO-compliant sparklers, gift boxes and crackers to families and vendors across India.'
  },
  contact: {
    title: 'Contact Us',
    description: 'Get in touch with the AADHI CRACKERS team for orders, bulk enquiries, delivery questions and support.'
  },
  safety: {
    title: 'Fireworks Safety Precautions',
    description:
      'How to burst crackers safely: open-area clearance, lighting with an agarbathi, keeping water and sand nearby, storage rules and adult supervision.'
  },
  terms: {
    title: 'Terms & Conditions',
    description: 'The terms and conditions that apply when you order fireworks from AADHI CRACKERS.'
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How AADHI CRACKERS collects, uses and protects the personal information you share when you shop with us.'
  },
  'shipping-policy': {
    title: 'Shipping Policy',
    description:
      'How fireworks orders are packed and dispatched by lorry to your destination transport office, with freight payable on collection.'
  },
  cart: { title: 'Your Cart', description: 'Review the items in your AADHI CRACKERS cart before checkout.' },
  checkout: { title: 'Checkout', description: 'Complete your AADHI CRACKERS order.' },
  'order-placed': { title: 'Order Confirmed', description: 'Your AADHI CRACKERS order has been placed.' },
  'track-order': { title: 'Track Your Order', description: 'Enter your order number to see the live status of your AADHI CRACKERS delivery.' },
  orders: { title: 'My Orders', description: 'Your AADHI CRACKERS order history.' },
  'my-orders': { title: 'My Orders', description: 'Your AADHI CRACKERS order history.' },
  'order-details': { title: 'Order Details', description: 'The details of your AADHI CRACKERS order.' },
  account: { title: 'My Account', description: 'Manage your AADHI CRACKERS profile, addresses and orders.' },
  addresses: { title: 'My Addresses', description: 'Manage your saved delivery addresses.' },
  wishlist: { title: 'My Wishlist', description: 'The AADHI CRACKERS products you saved for later.' },
  auth: { title: 'Login or Register', description: 'Sign in to your AADHI CRACKERS account or create a new one.' },
  'forgot-password': { title: 'Forgot Password', description: 'Reset the password for your AADHI CRACKERS account.' },
  'otp-verification': { title: 'Verify OTP', description: 'Enter the one-time password we sent you.' },
  'reset-password': { title: 'Reset Password', description: 'Choose a new password for your AADHI CRACKERS account.' },
  'category-menu': {
    title: 'All Categories',
    description: 'Browse every AADHI CRACKERS category — sparklers, ground chakkar, flower pots, aerial shots, gift boxes and combo packs.'
  },
  'payment-success': { title: 'Payment Successful', description: 'Your payment was received.' },
  'payment-failed': { title: 'Payment Failed', description: 'Your payment could not be completed.' },
  'payment-pending': { title: 'Payment Pending', description: 'Your payment is being verified.' }
};

const COMBOS_TITLE = 'Combo Packs & Gift Boxes';
const GIFT_BOXES_TITLE = 'Gift Boxes';

/**
 * The one entry point both the app and the build scripts use.
 *
 * @param {object} input
 * @param {string} input.page              page id (as passed to onNavigate)
 * @param {Record<string, any>} [input.params]
 * @param {boolean} [input.matched]        false → unknown URL, force noindex
 * @param {string} input.origin            absolute site origin (no trailing slash)
 * @param {Record<string,string>} [input.settings]  raw GET /settings/public map
 * @param {object} [input.product]         resolved product for /product/<slug>
 * @param {object} [input.category]        resolved category for /shop/<slug>
 * @param {object[]} [input.categories]    all categories (used for the home description)
 * @param {object[]} [input.listing]       products shown on a listing page (ItemList)
 * @param {string} [input.defaultImage]    sitewide fallback og:image (absolute)
 * @returns {{title:string, description:string, canonicalPath:string, robots?:string,
 *            ogType:string, image?:string, siteName:string, jsonLd:object[]}}
 */
export function buildPageSeo(input) {
  const {
    page,
    params = {},
    matched = true,
    origin,
    settings = {},
    product = null,
    category = null,
    categories = [],
    listing = null,
    defaultImage
  } = input;

  const business = resolveBusiness(settings);
  const siteName = business.name;
  // A sort order is a view of the same listing, not a separate page: the
  // canonical drops `?sort=` so Google consolidates it onto the plain listing.
  const canonicalPath = buildPath(page, params.sortBy ? { ...params, sortBy: undefined } : params);
  const noindex = !matched || NOINDEX_PAGES.has(page);

  const sitewideLd = [
    organizationLd(business, origin, defaultImage),
    webSiteLd(business, origin),
    localBusinessLd(business, origin, defaultImage)
  ];

  const withSuffix = (title) => (title.includes(siteName) ? title : `${title} | ${siteName}`);
  const home = { name: 'Home', path: '/' };

  /* ── product / combo detail ── */
  if (page === 'product-detail' && product) {
    const isGiftBox = product.isGiftBox === true;
    const isCombo = !isGiftBox && product.isCombo === true;
    const crumbLabel = isGiftBox ? GIFT_BOXES_TITLE : isCombo ? 'Combos' : product.categoryName || 'Shop';
    // Slugified exactly as ProductDetailPage's own breadcrumb does, so the link
    // in the structured data lands on the same listing the on-screen crumb opens.
    const crumbPath = isGiftBox
      ? buildPath('shop', { view: 'giftboxes' })
      : isCombo
      ? buildPath('shop', { view: 'combos' })
      : buildPath('shop', { category: slugifySegment(product.categoryName) });

    const priceBit = Number(product.price) > 0 ? ` at ${formatInr(product.price)}` : '';
    return {
      title: withSuffix(`${product.name}${priceBit}`),
      description: productDescription(product),
      canonicalPath,
      robots: noindex ? 'noindex, follow' : undefined,
      ogType: 'product',
      image: absoluteImage(origin, product.primaryImageUrl) || defaultImage,
      siteName,
      extraMeta: {
        'product:price:amount': Number(product.price) > 0 ? String(product.price) : undefined,
        'product:price:currency': 'INR',
        'product:availability':
          Number(product.availableQuantity ?? product.stockQuantity ?? 0) > 0 && product.isActive !== false
            ? 'in stock'
            : 'out of stock'
      },
      jsonLd: [
        ...sitewideLd,
        productLd(product, origin, business),
        breadcrumbLd([home, { name: crumbLabel, path: crumbPath }, { name: product.name, path: canonicalPath }], origin)
      ]
    };
  }

  /* ── product detail before the product resolves (or an unknown slug) ── */
  if (page === 'product-detail') {
    const pretty = titleCase(String(params.slug || 'Product'));
    return {
      title: withSuffix(pretty),
      description: composeDescription([`${pretty} —`, 'fireworks from Sivakasi, delivered across India by', `${siteName}.`]),
      canonicalPath,
      robots: noindex ? 'noindex, follow' : undefined,
      ogType: 'product',
      image: defaultImage,
      siteName,
      jsonLd: [...sitewideLd, breadcrumbLd([home, { name: 'Shop', path: '/shop' }, { name: pretty, path: canonicalPath }], origin)]
    };
  }

  /* ── listings: /shop, /shop/<category>, /combos, /gift-boxes ── */
  if (page === 'shop' || page === 'category') {
    const combos = isCombosView(params);
    const giftBoxes = isGiftBoxesView(params);
    const search = String(params.search || '').trim();

    let title;
    let description;
    const crumbs = [home, { name: 'Shop', path: '/shop' }];

    if (giftBoxes) {
      title = GIFT_BOXES_TITLE;
      description = composeDescription([
        'Shop AADHI CRACKERS gift boxes — pre-packed, ready-to-gift Sivakasi cracker boxes at one sealed price,',
        'delivered across India.'
      ]);
      crumbs.push({ name: GIFT_BOXES_TITLE, path: buildPath('shop', { view: 'giftboxes' }) });
    } else if (combos) {
      title = COMBOS_TITLE;
      description = composeDescription([
        'Shop AADHI CRACKERS combo packs and gift boxes — curated Sivakasi cracker assortments at one bundled price,',
        'delivered across India.'
      ]);
      crumbs.push({ name: COMBOS_TITLE, path: buildPath('shop', { view: 'combos' }) });
    } else if (category) {
      // Owner-editable SEO overrides win when the API exposes them.
      title = plainText(category.seoTitle) || `${category.name} — Buy Online`;
      description =
        plainText(category.seoDescription) ||
        (plainText(category.description).length > 40
          ? clamp(category.description)
          : composeDescription([
              `Buy ${category.name.toLowerCase()} online from ${siteName}.`,
              plainText(category.description),
              'Sivakasi-made fireworks delivered across India.'
            ]));
      crumbs.push({ name: category.name, path: canonicalPath });
    } else if (params.category) {
      const pretty = titleCase(String(params.category));
      title = `${pretty} — Buy Online`;
      description = composeDescription([`Buy ${pretty.toLowerCase()} online from ${siteName}.`, 'Sivakasi-made fireworks delivered across India.']);
      crumbs.push({ name: pretty, path: canonicalPath });
    } else if (search) {
      title = `Search results for “${search}”`;
      description = composeDescription([`Fireworks matching “${search}” at ${siteName}.`, 'Sivakasi crackers, sparklers and gift boxes delivered across India.']);
    } else {
      title = 'All Products';
      const names = categories
        .filter((c) => c && c.isActive !== false && Number(c.productCount) > 0)
        .map((c) => c.name)
        .slice(0, 5)
        .join(', ');
      description = composeDescription([
        `Browse the full ${siteName} range —`,
        names ? `${names.toLowerCase()} and more,` : 'sparklers, flower pots, aerial shots, gift boxes and combo packs,',
        'made in Sivakasi and delivered across India.'
      ]);
    }

    const jsonLd = [...sitewideLd, breadcrumbLd(crumbs, origin)];
    if (Array.isArray(listing) && listing.length > 0) jsonLd.push(itemListLd(listing, origin, title));

    return {
      title: withSuffix(title),
      description,
      canonicalPath,
      // A search-results URL is a thin duplicate of the listing — keep it out of the index.
      robots: noindex || search ? 'noindex, follow' : undefined,
      ogType: 'website',
      image: absoluteImage(origin, category && category.imageUrl) || defaultImage,
      siteName,
      jsonLd
    };
  }

  /* ── home ── */
  if (page === 'home') {
    const names = categories
      .filter((c) => c && c.isActive !== false && Number(c.productCount) > 0)
      .map((c) => c.name)
      .slice(0, 5)
      .join(', ');
    return {
      title: business.tagline ? `${siteName} — ${business.tagline}` : `${siteName} — Sivakasi Crackers Online`,
      description: composeDescription([
        `Buy Sivakasi crackers online from ${siteName} —`,
        names ? `${names.toLowerCase()},` : 'sparklers, flower pots, aerial shots, gift boxes,',
        'and combo packs delivered across India.'
      ]),
      canonicalPath: '/',
      robots: matched ? undefined : 'noindex, follow',
      ogType: 'website',
      image: defaultImage,
      siteName,
      jsonLd: [...sitewideLd, breadcrumbLd([home], origin)]
    };
  }

  /* ── everything else: static + account/transactional pages ── */
  const meta = STATIC_PAGE_META[page] || { title: titleCase(page), description: '' };
  const crumbs = [home, { name: meta.title, path: canonicalPath }];
  return {
    title: withSuffix(meta.title),
    description: meta.description || composeDescription([`${meta.title} at ${siteName}.`]),
    canonicalPath,
    robots: noindex ? 'noindex, follow' : undefined,
    ogType: 'website',
    image: defaultImage,
    siteName,
    jsonLd: [...sitewideLd, breadcrumbLd(crumbs, origin)]
  };
}
