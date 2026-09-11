# DEPLOYMENT — Customer storefront (`customer-web`)

How the customer-facing SPA (`aadhicracker.in`) reaches production on **Cloudflare Pages**,
with Google sign-in through Firebase and automatic deployment from GitHub.

This file covers the storefront only. The API has its own runbook
(`Aadhi_API_live/DEPLOYMENT.md`) and the admin has `admin-web/DEPLOYMENT.md`.

```
  push to ak-dev ─▶ GitHub Actions ──build──▶ Cloudflare Pages: aadhi-customer
                                                     │
                       browser ◀── aadhicracker.in ┘
                          │  API calls (CORS)                 │ Google popup
                          ▼                                   ▼
                https://api.aadhicracker.in          Firebase (aadhi-crackers)
```

The storefront is a static build — no server of its own. Everything dynamic comes from the API
over HTTPS, and images come straight from the R2 bucket.

---

## 1. Cloudflare Pages project (once, by hand)

Workers & Pages → **Create** → **Pages** → **Upload assets** (Direct Upload):

| Setting | Value |
|---|---|
| Project name | `aadhi-customer` — hard-coded in `deploy-pages.yml`'s matrix; change both together |
| Production branch | **`ak-dev`** — Settings → Builds & deployments. The deploy workflow runs from `ak-dev`, and Pages publishes to production only when the deploying branch matches this setting; any other branch gets a safe **preview URL** |

**Custom domains** (project → Custom domains): add `aadhicracker.in` and
`www.aadhicracker.in`. Cloudflare provisions TLS automatically when the DNS zone is on the
same account.

## 2. GitHub configuration

Repository `Aadhi_UI_live` → Settings → Secrets and variables → Actions. Secrets and Variables
are **different tabs**; variables appear in logs, so nothing sensitive goes there.

| Kind | Name | Value |
|---|---|---|
| secret | `CLOUDFLARE_API_TOKEN` | custom token, permission **Account → Cloudflare Pages → Edit** only — never the Global API Key, which can touch R2 and DNS |
| secret | `CLOUDFLARE_ACCOUNT_ID` | dashboard sidebar |
| variable | `VITE_API_BASE_URL` | `https://api.aadhicracker.in/api/v1` |
| variable | `VITE_SITE_URL` | `https://aadhicracker.in` |

**`VITE_API_BASE_URL` must be absolute.** Pages and the API are different origins, so the
historical relative `/api/v1` (from the Render era, where one host served both) would resolve
to Pages itself and every request would 404 — a site that looks deployed and works for nobody.
The workflow rejects a relative value at preflight rather than shipping that.

**`VITE_SITE_URL`** feeds the SEO build: sitemap.xml, canonical URLs, `og:url` and the
prerendered product pages are all built from it. Without it the build still succeeds and says
exactly what it skipped — but search engines get a bare sitemap.

## 3. What the pipeline does

`.github/workflows/deploy-pages.yml`, on every push to `ak-dev` (docs-only pushes skipped):

```
preflight  secrets/variables present, API URL absolute and sane          ~5s, fails fast
deploy     npm ci → write .env.production.local from the variables
           → type-check → build (includes SEO prebuild + prerender)
           → verify the configured API URL is really inside the bundle
           → deploy via wrangler (production when run from ak-dev)
```

`ci.yml` type-checks and builds on every other branch and every PR, so a broken build is
caught before it ever reaches `ak-dev` — and on `ak-dev` itself the deploy's own type-check and
build must pass before anything is published.

Two details worth knowing:

- CI writes **`.env.production.local`**, which outranks the committed `.env.production` in
  Vite's precedence — and the SEO scripts read the same files in the same order, so one file
  drives both the JS bundle and the sitemap/prerender.
- The bundle check asserts the configured URL **is present**, not that `localhost` is absent —
  the source keeps a `|| 'http://localhost:5050/api/v1'` fallback that survives minification,
  so the reverse check would fail every good build.

## 4. Firebase — Google sign-in

The storefront opens a Google popup (`src/services/firebase.ts`), gets a Firebase ID token,
and posts it to the API, which verifies it cryptographically. Console setup, in the
`aadhi-crackers` project:

1. **Authentication → Sign-in method → Google** → Enable, set the support email, Save.
2. **Authentication → Settings → Authorized domains** — add:
   `aadhicracker.in`, `www.aadhicracker.in`, and `aadhi-customer.pages.dev` (so preview
   deployments can sign in). `localhost` is pre-authorized, which is why development works —
   **missing this step is why production sign-in fails** with `auth/unauthorized-domain`, an
   error the storefront surfaces verbatim.

The web config hard-coded in `src/services/firebase.ts` (`apiKey`, `projectId`, …) is
**public by design** — it identifies the project, it grants nothing. Do not move it to
secrets. Optional hardening: restrict the auto-created *Browser key* in Google Cloud console →
Credentials to your domains, and test sign-in immediately after — an over-tight referrer list
is the usual way that breaks.

The server side is one env value on the API box (`Firebase__ProjectId=aadhi-crackers`), which
must match this app's `projectId` — see the API runbook §6.

## 5. The API-side settings this app depends on

Set on the Lightsail server (`/etc/aadhi-api/aadhi-api.env`), not here — listed because when
they are wrong, it is *this* app that visibly breaks:

| API setting | Breaks the storefront how |
|---|---|
| `Cors__AllowedOrigins` missing `https://aadhicracker.in` or `https://www.aadhicracker.in` (exact scheme, no trailing slash) | every API call blocked by the browser with a CORS error |
| `Storage__R2__PublicBaseUrl` wrong | every product image 404s |
| `Firebase__ProjectId` mismatch | every Google sign-in rejected |

## 6. Verification checklist

- [ ] `https://aadhicracker.in` loads over HTTPS; `www.` redirects/loads too
- [ ] Hard-refresh a deep link (`/product/anything`) — no 404 (SPA `_redirects` fallback)
- [ ] Devtools → Network: calls go to `https://api.aadhicracker.in/api/v1/…`, return 200,
      **no CORS errors** in the console
- [ ] Products render with images served from the R2 public origin
- [ ] **Sign in with Google** → popup → signed in as a customer; the customer appears in admin
- [ ] Place a test order end to end, with a payment screenshot
- [ ] `https://aadhicracker.in/sitemap.xml` lists product/category pages (SEO env was set)
- [ ] Push a trivial commit to `ak-dev` → `CI` runs and passes

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Deploy fails at preflight: *must be an absolute https URL* | `VITE_API_BASE_URL` is relative — §2 |
| Deploy fails: *does not appear in the built bundle* | The env file wasn't picked up; check the "Write build-time environment" step output |
| wrangler: *project not found* | The Pages project doesn't exist yet, or its name differs from the workflow matrix — §1 |
| Site up, every call CORS-blocked | This origin missing from the API's `Cors__AllowedOrigins` — §5 |
| Google popup: *This domain is not authorized in Firebase* | Authorized domains — §4 step 2 |
| Sign-in popup blocked | Browser popup blocker; the UI already tells the user to allow popups |
| Deployed to a preview URL instead of production | Run wasn't from `ak-dev`, or the project's production branch isn't `ak-dev` — §1 |
| Sitemap nearly empty | `VITE_SITE_URL` / SEO variables unset at build time — §2 |
