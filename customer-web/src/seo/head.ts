/**
 * The only place in the app that writes to <head>.
 *
 * `applySeo()` takes the plain object produced by `buildPageSeo()` (src/seo/schema.js)
 * and reconciles <title>, the meta tags, <link rel="canonical"> and the JSON-LD
 * blocks against it — updating the tags that index.html already ships with rather
 * than appending duplicates, and removing tags a later page no longer needs.
 */

export interface SeoDescriptor {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  ogType: string;
  image?: string;
  siteName: string;
  extraMeta?: Record<string, string | undefined>;
  jsonLd: unknown[];
}

/** Runtime origin — never hardcoded, so previews/tunnels/production all self-describe. */
export const siteOrigin = (): string =>
  typeof window !== 'undefined' && window.location ? window.location.origin.replace(/\/+$/, '') : '';

const readInitialContent = (selector: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const el = document.head.querySelector<HTMLMetaElement>(selector);
  const value = el?.getAttribute('content')?.trim();
  return value || undefined;
};

/**
 * The build-time defaults baked into index.html by scripts/seo-prebuild.mjs.
 * Captured once, before anything overwrites them, so a page with no image of its
 * own still falls back to the site-wide social image.
 */
export const STATIC_DEFAULTS = {
  image: readInitialContent('meta[property="og:image"]'),
  description: readInitialContent('meta[name="description"]')
};

type MetaKey = { attr: 'name' | 'property'; key: string };

const META_KEYS: Record<string, MetaKey> = {};
const managed = new Set<string>();

const metaKeyOf = (key: string): MetaKey => {
  if (!META_KEYS[key]) {
    // og:*, product:*, article:*, fb:* use `property`; everything else uses `name`.
    const attr = /^(og|product|article|fb|music|video|book|profile):/.test(key) ? 'property' : 'name';
    META_KEYS[key] = { attr, key };
  }
  return META_KEYS[key];
};

const upsertMeta = (key: string, content: string | undefined) => {
  const { attr } = metaKeyOf(key);
  // Meta keys are plain ASCII (`og:title`, `product:price:amount`, …), so a quoted
  // attribute selector needs no escaping — CSS.escape would break the match here.
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);

  if (!content) {
    if (existing && managed.has(key)) existing.remove();
    managed.delete(key);
    return;
  }

  let el = existing;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  managed.add(key);
};

const upsertLink = (rel: string, href: string | undefined) => {
  const selector = `link[rel="${rel}"]`;
  const existing = document.head.querySelector<HTMLLinkElement>(selector);
  if (!href) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.head.appendChild(document.createElement('link'));
  el.setAttribute('rel', rel);
  el.setAttribute('href', href);
};

/**
 * Replaces every JSON-LD block the app manages. Blocks baked into index.html are
 * marked `data-seo-jsonld` too, so they are replaced rather than duplicated once
 * the app boots and the live settings arrive.
 */
const applyJsonLd = (blocks: unknown[]) => {
  document.head.querySelectorAll('script[data-seo-jsonld]').forEach((node) => node.remove());
  blocks
    .filter(Boolean)
    .forEach((block) => {
      let serialised: string;
      try {
        // `</script>` inside a string would end the block early.
        serialised = JSON.stringify(block).replace(/<\//g, '<\\/');
      } catch {
        return;
      }
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo-jsonld', '');
      script.textContent = serialised;
      document.head.appendChild(script);
    });
};

/** Absolute URL for a path, using the live origin. */
export const toAbsolute = (path: string): string => {
  const origin = siteOrigin();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${suffix}` : suffix;
};

export function applySeo(seo: SeoDescriptor): void {
  if (typeof document === 'undefined') return;

  const canonical = toAbsolute(seo.canonicalPath);
  const image = seo.image || STATIC_DEFAULTS.image;

  document.title = seo.title;
  if (document.documentElement.getAttribute('lang') !== 'en-IN') {
    document.documentElement.setAttribute('lang', 'en-IN');
  }

  upsertLink('canonical', canonical);

  upsertMeta('description', seo.description);
  upsertMeta('robots', seo.robots);

  upsertMeta('og:site_name', seo.siteName);
  upsertMeta('og:locale', 'en_IN');
  upsertMeta('og:type', seo.ogType);
  upsertMeta('og:title', seo.title);
  upsertMeta('og:description', seo.description);
  upsertMeta('og:url', canonical);
  upsertMeta('og:image', image);
  upsertMeta('og:image:alt', image ? seo.title : undefined);

  upsertMeta('twitter:card', image ? 'summary_large_image' : 'summary');
  upsertMeta('twitter:title', seo.title);
  upsertMeta('twitter:description', seo.description);
  upsertMeta('twitter:image', image);

  const extra = seo.extraMeta || {};
  // Reconcile the optional, page-type-specific tags (product price/availability):
  // anything previously set but absent now is removed.
  const optionalKeys = new Set([...Object.keys(extra), 'product:price:amount', 'product:price:currency', 'product:availability']);
  optionalKeys.forEach((key) => upsertMeta(key, extra[key]));

  applyJsonLd(seo.jsonLd);
}
