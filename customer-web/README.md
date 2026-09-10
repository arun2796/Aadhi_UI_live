# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

---

# SEO, URLs and structured data

## Real URLs

Navigation is still driven by `onNavigate(page, params)` in `src/App.tsx` — no
router library was added and no call site changed. `src/seo/routes.js` translates
each `(page, params)` pair to a real URL and back, and `App.tsx` pushes it,
parses it on first load and restores it on `popstate`.

| URL | Screen |
| --- | --- |
| `/` | Home |
| `/shop` · `/shop/<category-slug>` | Product listing (`?q=` search, `?sort=` sort) |
| `/combos` | Combo packs & gift boxes |
| `/categories` | Category menu |
| `/product/<slug>` | Product / combo detail (the API's real `slug`) |
| `/cart` · `/checkout` · `/order-confirmed` | Basket → checkout → confirmation |
| `/track` · `/track/<orderNumber>` | Order tracking |
| `/orders` · `/orders/<orderId>?no=<orderNumber>` | My orders / order detail |
| `/account` · `/account/addresses` · `/wishlist` | Account area |
| `/login` · `/register` · `/forgot-password` · `/verify-otp` · `/reset-password` | Auth |
| `/about` · `/contact` · `/safety` · `/terms` · `/privacy` · `/shipping-policy` | Static pages |
| `/payment/success` · `/payment/failed` · `/payment/pending` | Payment results |

Navigation params travel in `history.state` as well as React state, so Back into
a screen whose content lives in its params (a just-placed order, a payment
result) restores it. A *cold* load of one of those URLs has nothing to restore
and lands on Home instead. A URL outside the scheme renders Home and is marked
`noindex` so it never becomes an indexable duplicate.

## Per-page metadata and JSON-LD

`src/seo/SeoHead.tsx` re-runs on every navigation and hands `src/seo/head.ts` the
descriptor built by `src/seo/schema.js`: `<title>`, meta description, canonical,
Open Graph, Twitter card and the JSON-LD graphs (Organization, WebSite with
SearchAction, LocalBusiness, plus Product and BreadcrumbList where they apply).
Absolute URLs come from `window.location.origin` at runtime — nothing is
hardcoded, so tunnels, previews and production all describe themselves correctly.

**Business identity is never hardcoded.** Store name, address, phone and email
are read from `GET /settings/public` (`Store.BusinessName`, `Store.Address`,
`Store.Phone`, `Store.Email`). Values that look like unedited placeholders are
**dropped** rather than published as structured fact — fix them in the admin
Settings screen and the structured data corrects itself with no redeploy. The
build prints exactly which values it rejected.

Ratings are only ever emitted when the API genuinely returns `rating > 0` **and**
`reviewCount > 0`. No rating markup is fabricated.

Category pages prefer `Category.SeoTitle` / `Category.SeoDescription` when the
API returns them. Those columns exist on the `Category` entity and on
Create/UpdateCategoryRequest but are **not yet projected onto `CategoryDto`**, so
today they arrive undefined and the storefront falls back to a derived title and
the category's own `description`. Adding the two fields to `CategoryDto` in the
API is all that is needed to switch them on.

## Build-time SEO assets

```
npm run build          # prebuild → tsc → vite build → prerender
npm run seo:assets     # regenerate index.html head, robots.txt, sitemap.xml
npm run seo:assets:dev # ... using the development origin/API
```

`scripts/seo-prebuild.mjs` fetches the live catalogue and writes:

* the `<!-- SEO:BEGIN -->` head block and `<!-- NOSCRIPT:BEGIN -->` body block in
  `index.html` (so crawlers that never run JavaScript still get title,
  description, Open Graph and the site-wide JSON-LD);
* `public/robots.txt` — crawlable, private pages disallowed, GPTBot / ClaudeBot /
  anthropic-ai / PerplexityBot / Google-Extended / CCBot and friends explicitly
  welcomed, Sitemap line included;
* `public/sitemap.xml` — every real product and category URL.

`scripts/seo-prerender.mjs` then writes a static HTML file per public URL under
`dist/` (`dist/product/<slug>/index.html`, …) carrying that page's head plus a
plain-HTML snapshot of the content inside `#root`. `src/main.tsx` clears `#root`
before `createRoot()`, so React never sees the snapshot. Both files are
regenerated by `npm run build`; both are in `.gitignore`-adjacent territory
(`dist/`) or regenerated on every build (`public/robots.txt`, `public/sitemap.xml`).

> `npm run preview` (vite preview) rewrites *every* extensionless path to
> `/index.html`, so it does not show the prerendered pages. Serve `dist/` with a
> host that does `try_files $uri $uri/index.html /index.html` to see them.

If the catalogue API cannot be reached the build **does not fail**: it warns
loudly, keeps the previous `index.html` block, writes a core sitemap with no
product URLs and skips the prerender. Pass `--strict` to
`scripts/seo-prebuild.mjs` to turn that into a hard failure instead.

## Required environment variables

| Variable | Used by | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | browser | unchanged |
| `VITE_SITE_URL` | SEO build | **Public origin of the live site.** Canonical URLs, `og:url`, `sitemap.xml` and the robots.txt `Sitemap:` line are built from it. When it is blank the build falls back to the domain of `Store.Email` from the settings API and says so — set it explicitly. |
| `VITE_SEO_API_BASE_URL` | SEO build | Absolute API base URL reachable from the **build machine**. `VITE_API_BASE_URL` is the browser-relative `/api/v1` in production and Node cannot fetch it. Without this the sitemap has no products and nothing is prerendered. |

## Deployment

`render.yaml` (see the header comment — Render only reads a blueprint from the
repository root) and `public/_redirects` both encode the same two requirements:

1. `/robots.txt` and `/sitemap.xml` must be served as themselves;
2. every other unknown path must fall back to `/index.html` so deep links survive
   a hard refresh or a shared WhatsApp link.

Files that exist on disk are served before any rewrite, so the prerendered pages
are served as themselves and only genuinely unknown paths reach the SPA shell.
