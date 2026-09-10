/**
 * Shared helpers for the two SEO build steps:
 *   scripts/seo-prebuild.mjs   — index.html head block, robots.txt, sitemap.xml
 *   scripts/seo-prerender.mjs  — static HTML per product / category / static page
 *
 * Both import the SAME URL scheme and JSON-LD builders the React app uses
 * (src/seo/routes.js, src/seo/schema.js), so a URL or a schema fix can never
 * drift between the runtime and the build.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── env ─────────────────────────────────────────────────────────────────── */

const parseEnvFile = (file) => {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
};

/**
 * Reads a variable from process.env first, then the .env files Vite would load
 * for `mode` (.env.<mode>.local → .env.<mode> → .env.local → .env).
 */
export const readEnv = (name, mode = process.env.NODE_ENV === 'development' ? 'development' : 'production') => {
  if (process.env[name]) return String(process.env[name]).trim();
  for (const file of [`.env.${mode}.local`, `.env.${mode}`, '.env.local', '.env']) {
    const values = parseEnvFile(path.join(ROOT, file));
    if (values[name]) return values[name];
  }
  return '';
};

/** The public site origin. Never guessed — it must be configured. */
export const siteOrigin = (mode) => {
  const raw = readEnv('VITE_SITE_URL', mode);
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
};

/**
 * The API base URL usable from the *build machine*. `.env.production` sets
 * VITE_API_BASE_URL to the relative `/api/v1` (correct for the browser, useless
 * for `fetch` in Node), so an absolute VITE_SEO_API_BASE_URL takes priority.
 */
export const apiBaseUrl = (mode) => {
  const explicit = readEnv('VITE_SEO_API_BASE_URL', mode);
  if (explicit) return explicit.replace(/\/+$/, '');
  const shared = readEnv('VITE_API_BASE_URL', mode);
  if (/^https?:\/\//i.test(shared)) return shared.replace(/\/+$/, '');
  return '';
};

/* ── logging ─────────────────────────────────────────────────────────────── */

const BANNER = '─'.repeat(72);
export const log = (message) => console.log(`[seo] ${message}`);
export const warnBlock = (title, lines) => {
  console.warn(`\n${BANNER}\n[seo] ${title}`);
  lines.filter(Boolean).forEach((line) => console.warn(`[seo]   ${line}`));
  console.warn(`${BANNER}\n`);
};

/* ── catalogue fetch ─────────────────────────────────────────────────────── */

const getJson = async (url, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return body?.data ?? body;
  } finally {
    clearTimeout(timer);
  }
};

/** Mirrors services/api.ts normalizeImageUrl so build-time images resolve the same way. */
export const normalizeImageUrl = (url, apiOrigin) => {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/storage/')) return `${apiOrigin}${trimmed}`;
  if (!/drive\.google\.com/i.test(trimmed)) return trimmed;
  if (/drive\.google\.com\/thumbnail/i.test(trimmed)) return trimmed;
  const match =
    trimmed.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/i) || trimmed.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
  return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000` : trimmed;
};

/** Max products whose detail DTO is fetched, and how many at a time. */
const DETAIL_LIMIT = 400;
const DETAIL_BATCH = 8;

async function enrichWithDetails(products, base, apiOrigin, mapProduct) {
  const targets = products.slice(0, DETAIL_LIMIT);
  const out = [...products];
  for (let i = 0; i < targets.length; i += DETAIL_BATCH) {
    const batch = targets.slice(i, i + DETAIL_BATCH);
    /* eslint-disable no-await-in-loop */
    const details = await Promise.all(
      batch.map((p) => getJson(`${base}/products/${encodeURIComponent(p.slug)}`, 15000).catch(() => null))
    );
    details.forEach((detail, index) => {
      if (!detail || !detail.id) return;
      const at = out.findIndex((p) => String(p.id) === String(batch[index].id));
      if (at >= 0) out[at] = { ...out[at], ...mapProduct(detail) };
    });
  }
  return out;
}

/**
 * Fetches everything the SEO build needs. Returns `{ ok:false }` (never throws)
 * when the API cannot be reached, so the caller decides whether to fall back.
 */
export async function fetchCatalogue(mode) {
  const base = apiBaseUrl(mode);
  if (!base) {
    return { ok: false, reason: 'no absolute API base URL configured (set VITE_SEO_API_BASE_URL)', settings: {}, categories: [], products: [], combos: [], banners: [] };
  }
  const apiOrigin = base.replace(/\/api.*$/i, '');

  try {
    const [settingsRaw, categoriesRaw, productsRaw, combosRaw, bannersRaw] = await Promise.all([
      getJson(`${base}/settings/public`).catch(() => ({})),
      getJson(`${base}/categories`).catch(() => []),
      getJson(`${base}/products?pageSize=500`).catch(() => ({ items: [] })),
      getJson(`${base}/products/combo-offers?count=100`).catch(() => []),
      getJson(`${base}/banners?activeOnly=true&placement=Home`).catch(() => [])
    ]);

    const settings = {};
    if (settingsRaw && typeof settingsRaw === 'object' && !Array.isArray(settingsRaw)) {
      for (const [key, value] of Object.entries(settingsRaw)) {
        if (value !== null && value !== undefined) settings[key] = String(value);
      }
    }

    const mapProduct = (p) => ({
      ...p,
      primaryImageUrl: normalizeImageUrl(p?.primaryImageUrl, apiOrigin),
      images: Array.isArray(p?.images)
        ? p.images.map((img) => (typeof img === 'string' ? normalizeImageUrl(img, apiOrigin) : { ...img, url: normalizeImageUrl(img?.url, apiOrigin) }))
        : []
    });

    const listOf = (raw) => (Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : []);

    const products = listOf(productsRaw).filter((p) => p && p.id && p.slug).map(mapProduct);
    const combos = listOf(combosRaw).filter((p) => p && p.id && p.slug && p.isCombo === true).map(mapProduct);
    const categories = listOf(categoriesRaw).filter((c) => c && c.slug).map((c) => ({
      ...c,
      imageUrl: normalizeImageUrl(c?.imageUrl, apiOrigin)
    }));
    const banners = listOf(bannersRaw).map((b) => ({ ...b, imageUrl: normalizeImageUrl(b?.imageUrl, apiOrigin) }));

    // Combos are not always present in /products; merge them in, de-duplicated.
    const byId = new Map();
    [...products, ...combos].forEach((p) => byId.set(String(p.id), p));
    const merged = [...byId.values()];

    // The list endpoint omits description / safetyInformation / the full image set —
    // exactly the fields the meta description and Product JSON-LD need. Pull the
    // detail DTO for each product, in small batches, and merge it in. A product
    // whose detail call fails simply keeps its list-level fields.
    const enriched = await enrichWithDetails(merged, base, apiOrigin, mapProduct);

    return { ok: true, settings, categories, products: enriched, combos, banners, apiOrigin };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error), settings: {}, categories: [], products: [], combos: [], banners: [] };
  }
}

/**
 * The site-wide social image. Taken from real, owner-controlled data only:
 * the first active home banner, else the first featured product photo. When the
 * store has neither, no og:image is published (better than a made-up one).
 */
export const pickDefaultImage = (data) => {
  const banner = (data.banners || []).find((b) => b && b.imageUrl);
  if (banner) return banner.imageUrl;
  const featured = (data.products || []).find((p) => p.isFeatured && p.primaryImageUrl) || (data.products || []).find((p) => p.primaryImageUrl);
  return featured ? featured.primaryImageUrl : undefined;
};

/* ── HTML helpers ────────────────────────────────────────────────────────── */

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** `</script>` inside a JSON string would close the block early. */
export const jsonLdScript = (block) =>
  `<script type="application/ld+json" data-seo-jsonld>${JSON.stringify(block).replace(/<\//g, '<\\/')}</script>`;

export const metaTag = (attr, key, content) =>
  content ? `<meta ${attr}="${key}" content="${escapeHtml(content)}" />` : '';

/**
 * The complete <head> block for one page: title, description, canonical,
 * Open Graph, Twitter card and every JSON-LD graph.
 */
export function renderHeadBlock(seo, origin, indent = '    ') {
  // A canonical URL is only meaningful when it is ABSOLUTE, so it is emitted only
  // once the site origin is configured (VITE_SITE_URL, or the domain derived from
  // Store.Email). Without one, the tag is omitted entirely and crawlers fall back
  // to the request URL — which is both correct and the only safe option, because
  // an origin-less canonical on the home page renders as href="/", and Vite's
  // build-html plugin resolves every <link href> against the public directory and
  // fails the whole build on it (EISDIR). The runtime head builder
  // (src/seo/head.ts) still writes a real canonical from window.location.origin.
  const canonical = origin ? `${origin}${seo.canonicalPath}` : '';
  const image = seo.image;
  const extra = seo.extraMeta || {};

  const lines = [
    `<title>${escapeHtml(seo.title)}</title>`,
    metaTag('name', 'description', seo.description),
    seo.robots ? metaTag('name', 'robots', seo.robots) : '',
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : '',
    metaTag('property', 'og:site_name', seo.siteName),
    metaTag('property', 'og:locale', 'en_IN'),
    metaTag('property', 'og:type', seo.ogType),
    metaTag('property', 'og:title', seo.title),
    metaTag('property', 'og:description', seo.description),
    metaTag('property', 'og:url', canonical),
    metaTag('property', 'og:image', image),
    image ? metaTag('property', 'og:image:alt', seo.title) : '',
    metaTag('name', 'twitter:card', image ? 'summary_large_image' : 'summary'),
    metaTag('name', 'twitter:title', seo.title),
    metaTag('name', 'twitter:description', seo.description),
    metaTag('name', 'twitter:image', image),
    metaTag('property', 'product:price:amount', extra['product:price:amount']),
    metaTag('property', 'product:price:currency', extra['product:price:currency']),
    metaTag('property', 'product:availability', extra['product:availability']),
    ...(seo.jsonLd || []).filter(Boolean).map((block) => jsonLdScript(block))
  ].filter(Boolean);

  return lines.map((line) => `${indent}${line}`).join('\n');
}

/* ── marker-delimited block replacement ──────────────────────────────────── */

const beginMarker = (name) => `<!-- ${name}:BEGIN — generated by scripts/seo-prebuild.mjs, do not edit by hand -->`;
const endMarker = (name) => `<!-- ${name}:END -->`;

/**
 * Replaces the marker-delimited block called `name`, or inserts it before
 * `closingTag` the first time. Idempotent, so re-running the build never
 * duplicates or nests the generated markup.
 */
export function replaceMarkedBlock(html, name, block, closingTag = '</head>', indent = '    ') {
  const begin = beginMarker(name);
  const end = endMarker(name);
  const wrapped = `${begin}\n${block}\n${indent}${end}`;
  const start = html.indexOf(begin);
  const stop = html.indexOf(end);
  if (start !== -1 && stop !== -1) {
    return html.slice(0, start) + wrapped + html.slice(stop + end.length);
  }
  return html.replace(closingTag, `${indent}${wrapped}\n  ${closingTag}`);
}
