/**
 * Build-time prerender (runs after `vite build`, via the `build` npm script).
 *
 * For every public URL — home, /shop, /combos, each category, each product and
 * the static pages — this writes a real HTML file under dist/ that already
 * contains that page's <head> (title, description, canonical, Open Graph,
 * Twitter card, JSON-LD) and a plain-HTML snapshot of the content inside #root.
 *
 * WHY, and why this shape:
 *   Google renders JavaScript, but WhatsApp and Facebook link previews and most
 *   AI crawlers do not — they read the first HTML response and stop. WhatsApp is
 *   this shop's main sharing channel, so a shared product link has to carry its
 *   own title, description and image in the raw bytes.
 *
 *   It is a *snapshot*, not server-side rendering: no headless browser, no SSR
 *   entry point, no hydration. Every file is the built dist/index.html with two
 *   marker-delimited blocks swapped out, so it always ships the same JS/CSS the
 *   SPA ships. src/main.tsx clears #root before createRoot(), so React never
 *   sees the snapshot and cannot mismatch on it. If this step is skipped or the
 *   API is unreachable, the SPA fallback still serves every URL exactly as before.
 */

import fs from 'node:fs';
import path from 'node:path';

import { buildPageSeo, plainText, formatInr, clamp } from '../src/seo/schema.js';
import { buildPath, slugifySegment } from '../src/seo/routes.js';
import {
  ROOT,
  siteOrigin,
  fetchCatalogue,
  pickDefaultImage,
  renderHeadBlock,
  replaceMarkedBlock,
  escapeHtml,
  log,
  warnBlock
} from './seo-shared.mjs';

const DIST = path.join(ROOT, 'dist');
const COMBO_ALIAS_SLUGS = new Set(['combos', 'combo-offers', 'gift-boxes']);

const STATIC_PAGES = ['about', 'contact', 'safety', 'terms', 'privacy', 'shipping-policy', 'track-order', 'category-menu'];

/* ── the visible pre-boot snapshot ───────────────────────────────────────── */

const SHELL_OPEN =
  '<div data-prerender="1" style="max-width:70rem;margin:0 auto;padding:1.5rem 1.25rem;font-family:Inter,system-ui,sans-serif;color:#1e293b;line-height:1.6">';
const SHELL_CLOSE = '</div>';

const crumbNav = (crumbs) =>
  `<nav aria-label="Breadcrumb" style="font-size:.75rem;color:#64748b;margin-bottom:1rem">${crumbs
    .map((c, i) => `${i ? ' › ' : ''}${c.path ? `<a href="${escapeHtml(c.path)}" style="color:#64748b">${escapeHtml(c.name)}</a>` : escapeHtml(c.name)}`)
    .join('')}</nav>`;

const productListHtml = (products) =>
  products.length
    ? `<ul style="list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:1rem">${products
        .map(
          (p) => `<li style="border:1px solid #e2e8f0;border-radius:.75rem;padding:.9rem">
        <a href="${escapeHtml(buildPath('product-detail', { slug: p.slug }))}" style="font-weight:700;color:#111238;text-decoration:none">${escapeHtml(p.name)}</a>
        ${p.shortDescription ? `<p style="font-size:.8rem;color:#64748b;margin:.35rem 0">${escapeHtml(plainText(p.shortDescription))}</p>` : ''}
        ${Number(p.price) > 0 ? `<p style="font-weight:700;margin:.35rem 0 0">${escapeHtml(formatInr(p.price))}</p>` : ''}
      </li>`
        )
        .join('')}</ul>`
    : '';

function productSnapshot(product, business) {
  const isCombo = product.isCombo === true;
  const crumbs = [
    { name: 'Home', path: '/' },
    {
      name: isCombo ? 'Combos' : product.categoryName || 'Shop',
      path: isCombo ? buildPath('shop', { view: 'combos' }) : buildPath('shop', { category: slugifySegment(product.categoryName) })
    },
    { name: product.name }
  ];

  const description = plainText(product.description) || plainText(product.shortDescription);
  const inStock = Number(product.availableQuantity ?? product.stockQuantity ?? 0) > 0 && product.isActive !== false;

  const combo =
    Array.isArray(product.comboItems) && product.comboItems.length
      ? `<h2 style="font-size:1rem;margin:1.5rem 0 .5rem">What's inside</h2><ul>${product.comboItems
          .map((i) => `<li>${escapeHtml(i.productName)}${Number(i.quantity) > 1 ? ` × ${i.quantity}` : ''}</li>`)
          .join('')}</ul>`
      : '';

  return [
    SHELL_OPEN,
    crumbNav(crumbs),
    product.primaryImageUrl
      ? `<img src="${escapeHtml(product.primaryImageUrl)}" alt="${escapeHtml(product.name)}" width="480" style="max-width:100%;border-radius:1rem;border:1px solid #e2e8f0" />`
      : '',
    `<h1 style="font-size:1.75rem;margin:1rem 0 .35rem;color:#111238">${escapeHtml(product.name)}</h1>`,
    product.shortDescription ? `<p style="color:#475569;margin:0 0 .75rem">${escapeHtml(plainText(product.shortDescription))}</p>` : '',
    `<p style="font-size:1.25rem;font-weight:800;margin:0 0 .25rem">${escapeHtml(formatInr(product.price))}${
      Number(product.compareAtPrice) > Number(product.price)
        ? ` <span style="font-size:.9rem;font-weight:500;color:#94a3b8;text-decoration:line-through">${escapeHtml(formatInr(product.compareAtPrice))}</span>`
        : ''
    }</p>`,
    `<p style="font-size:.85rem;color:#64748b;margin:0 0 1rem">${inStock ? 'In stock' : 'Out of stock'}${
      product.sku ? ` · SKU ${escapeHtml(product.sku)}` : ''
    }${product.brandName ? ` · ${escapeHtml(product.brandName)}` : ''}${product.categoryName ? ` · ${escapeHtml(product.categoryName)}` : ''}</p>`,
    description ? `<h2 style="font-size:1rem;margin:1.5rem 0 .5rem">Description</h2><p>${escapeHtml(description)}</p>` : '',
    combo,
    product.safetyInformation
      ? `<h2 style="font-size:1rem;margin:1.5rem 0 .5rem">Safety information</h2><p>${escapeHtml(plainText(product.safetyInformation))}</p>`
      : '',
    `<p style="margin-top:2rem;font-size:.8rem;color:#94a3b8">Sold by ${escapeHtml(business.name)} · Delivered across India</p>`,
    SHELL_CLOSE
  ]
    .filter(Boolean)
    .join('\n      ');
}

function listingSnapshot({ heading, description, crumbs, products, business }) {
  return [
    SHELL_OPEN,
    crumbNav(crumbs),
    `<h1 style="font-size:1.75rem;margin:0 0 .5rem;color:#111238">${escapeHtml(heading)}</h1>`,
    description ? `<p style="color:#475569;margin:0 0 1.25rem;max-width:44rem">${escapeHtml(description)}</p>` : '',
    productListHtml(products),
    `<p style="margin-top:2rem;font-size:.8rem;color:#94a3b8">${escapeHtml(business.name)} · Sivakasi fireworks delivered across India</p>`,
    SHELL_CLOSE
  ]
    .filter(Boolean)
    .join('\n      ');
}

function simpleSnapshot(seo, business) {
  return [
    SHELL_OPEN,
    crumbNav([{ name: 'Home', path: '/' }, { name: seo.title.split(' | ')[0] }]),
    `<h1 style="font-size:1.75rem;margin:0 0 .5rem;color:#111238">${escapeHtml(seo.title.split(' | ')[0])}</h1>`,
    `<p style="color:#475569;max-width:44rem">${escapeHtml(seo.description)}</p>`,
    `<p style="margin-top:2rem;font-size:.8rem;color:#94a3b8">${escapeHtml(business.name)}</p>`,
    SHELL_CLOSE
  ].join('\n      ');
}

const pageNoscript = (seo, business) =>
  `    <noscript>
      <p style="max-width:44rem;margin:1rem auto;padding:0 1.25rem;font-family:system-ui,sans-serif;color:#64748b">
        ${escapeHtml(business.name)} — ${escapeHtml(seo.description)} Enable JavaScript to add items to your cart and check out.
      </p>
    </noscript>`;

/* ── writing files ───────────────────────────────────────────────────────── */

const writeRoute = (urlPath, html) => {
  const clean = urlPath.split('?')[0];
  const target = clean === '/' ? path.join(DIST, 'index.html') : path.join(DIST, ...clean.split('/').filter(Boolean), 'index.html');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html, 'utf8');
};

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    warnBlock('PRERENDER SKIPPED', ['dist/index.html not found — run `vite build` first.']);
    return;
  }

  // The pre-build step already fetched everything; reuse it, refetch if absent.
  const cacheFile = path.join(ROOT, 'node_modules', '.cache', 'seo', 'catalogue.json');
  let data;
  let origin;
  let defaultImage;
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    data = cached;
    origin = cached.origin || siteOrigin();
    defaultImage = cached.defaultImage;
  } else {
    data = await fetchCatalogue();
    origin = siteOrigin();
    defaultImage = pickDefaultImage(data);
  }

  if (!data.ok || !origin) {
    warnBlock('PRERENDER SKIPPED', [
      !origin ? 'No site origin (VITE_SITE_URL) — prerendered pages need absolute canonical/og:url values.' : '',
      !data.ok ? `Catalogue unavailable: ${data.reason}.` : '',
      'dist/index.html is unchanged and the SPA fallback still serves every URL — only the static per-page HTML is missing.'
    ]);
    return;
  }

  const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const business = (await import('../src/seo/schema.js')).resolveBusiness(data.settings);

  const emit = (page, params, { snapshot, product = null, category = null, listing = null }) => {
    const seo = buildPageSeo({
      page,
      params,
      matched: true,
      origin,
      settings: data.settings,
      product,
      category,
      categories: data.categories,
      listing,
      defaultImage
    });
    let html = replaceMarkedBlock(template, 'SEO', renderHeadBlock(seo, origin), '</head>');
    html = replaceMarkedBlock(html, 'NOSCRIPT', pageNoscript(seo, business), '</body>', '    ');
    html = html.replace('<div id="root"></div>', `<div id="root">\n      ${snapshot(seo)}\n    </div>`);
    writeRoute(seo.canonicalPath, html);
    return seo.canonicalPath;
  };

  const written = [];
  const activeProducts = (data.products || []).filter((p) => p.isActive !== false);
  const combos = activeProducts.filter((p) => p.isCombo === true);

  /* home */
  written.push(
    emit('home', {}, {
      listing: activeProducts,
      snapshot: (seo) =>
        listingSnapshot({
          heading: business.name,
          description: seo.description,
          crumbs: [{ name: 'Home' }],
          products: activeProducts.slice(0, 12),
          business
        })
    })
  );

  /* all products */
  written.push(
    emit('shop', {}, {
      listing: activeProducts,
      snapshot: (seo) =>
        listingSnapshot({
          heading: 'All Products',
          description: seo.description,
          crumbs: [{ name: 'Home', path: '/' }, { name: 'Shop' }],
          products: activeProducts,
          business
        })
    })
  );

  /* combos */
  written.push(
    emit('shop', { view: 'combos' }, {
      listing: combos,
      snapshot: (seo) =>
        listingSnapshot({
          heading: 'Combo Packs & Gift Boxes',
          description: seo.description,
          crumbs: [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: 'Combos' }],
          products: combos,
          business
        })
    })
  );

  /* categories */
  const categories = (data.categories || []).filter(
    (c) => c.isActive !== false && Number(c.productCount) > 0 && !COMBO_ALIAS_SLUGS.has(String(c.slug).toLowerCase())
  );
  categories.forEach((category) => {
    const inCategory = activeProducts.filter(
      (p) => String(p.categoryId) === String(category.id) || String(p.categoryName || '').toLowerCase() === String(category.name).toLowerCase()
    );
    written.push(
      emit('shop', { category: category.slug }, {
        category,
        listing: inCategory,
        snapshot: (seo) =>
          listingSnapshot({
            heading: category.name,
            description: clamp(category.description) || seo.description,
            crumbs: [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: category.name }],
            products: inCategory,
            business
          })
      })
    );
  });

  /* products */
  activeProducts.forEach((product) => {
    written.push(emit('product-detail', { slug: product.slug }, { product, snapshot: () => productSnapshot(product, business) }));
  });

  /* static pages */
  STATIC_PAGES.forEach((page) => {
    written.push(emit(page, {}, { snapshot: (seo) => simpleSnapshot(seo, business) }));
  });

  log(`prerendered ${written.length} pages into dist/ (${activeProducts.length} products, ${categories.length} categories)`);
}

main().catch((error) => {
  warnBlock('PRERENDER ERROR', [String(error?.stack || error), 'dist/ still contains the working SPA build.']);
});
