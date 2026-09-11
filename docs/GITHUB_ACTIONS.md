# GitHub Actions — `Aadhi_UI_live`

This repository holds **two** independent SPAs, and both workflows treat them as a matrix so one
broken app never blocks the other.

| Workflow | Runs on | Does |
|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | every branch **except** `ak-dev`, and every PR into `ak-dev` or `main` | install → type-check → build, for `customer-web` and `admin-web` |
| [`deploy-pages.yml`](../.github/workflows/deploy-pages.yml) | push to `ak-dev`, or **Run workflow** | preflight → build both → deploy to Cloudflare Pages |

> CI exists because of a real incident: a duplicate `Package` import sat in
> `Screen1HomeAndCategory.tsx` breaking the entire customer build, on a branch, unnoticed.
> `ci.yml` runs `tsc -b` on every branch so that cannot happen again.

---

## Secrets

**Settings → Secrets and variables → Actions → Secrets tab.**

| Name | Required | Value | Where to get it |
|---|:--:|---|---|
| `CLOUDFLARE_API_TOKEN` | yes | An API token with the **Cloudflare Pages: Edit** permission | Cloudflare dashboard → My Profile → API Tokens → Create Token |
| `CLOUDFLARE_ACCOUNT_ID` | yes | Your 32-character account ID | Cloudflare dashboard → Workers & Pages → right sidebar |

### Creating the API token

Use **Create Custom Token**, not the Global API Key. The Global Key can do anything to your whole
Cloudflare account — including your R2 bucket and DNS — and cannot be scoped. This token only
needs to publish Pages builds:

| Setting | Value |
|---|---|
| Permissions | **Account** → **Cloudflare Pages** → **Edit** |
| Account Resources | Include → your account |
| TTL | leave open, or set a renewal reminder |

Nothing else. In particular it does **not** need R2 access — images are uploaded by the API
using separate R2 credentials that live on the Lightsail server.

## Variables

**Settings → Secrets and variables → Actions → Variables tab.** Plain text, visible in logs.

| Name | Required | Value | Effect if unset |
|---|:--:|---|---|
| `VITE_API_BASE_URL` | **yes** | `https://api.aadhicracker.in/api/v1` | The deploy **fails at preflight**. |
| `VITE_SITE_URL` | recommended | `https://aadhicracker.in` | The storefront builds and works, but `sitemap.xml`, canonical URLs and `og:url` have no absolute origin, so SEO output is degraded. A warning is printed. |

### `VITE_API_BASE_URL` must be absolute

This is the single most likely thing to get wrong. Previously these apps were served by Render
from the same origin as the API, so a relative `/api/v1` worked. **Cloudflare Pages and the
Lightsail API are different origins** — a relative path now resolves to Pages itself and every
request 404s, producing a site that looks deployed and works for nobody.

The preflight job rejects a non-`https://` value outright and warns if it does not end in
`/api/v1` or if it has a trailing slash.

Because the origins differ, the API must also allow them. `Cors__AllowedOrigins` in
`/etc/aadhi-api/aadhi-api.env` on the Lightsail instance must list both site origins **exactly**
— scheme included, no trailing slash — or the browser blocks every call:

```
Cors__AllowedOrigins=https://aadhicracker.in;https://www.aadhicracker.in;https://adminerp.aadhicracker.in
```

---

## Cloudflare Pages projects

Create these **once**, by hand, before the first deploy — the workflow pushes builds into them,
it does not create them.

Workers & Pages → **Create** → **Pages** → **Upload assets** (Direct Upload):

| App | Pages project name | Suggested domain |
|---|---|---|
| `customer-web` | `aadhi-customer` | `aadhicracker.in` |
| `admin-web` | `aadhi-admin` | `adminerp.aadhicracker.in` |

The project names are hard-coded in the workflow's matrix; change them there if you name them
differently. Attach custom domains in each project's **Custom domains** tab.

Set each project's **production branch to `ak-dev`** (Settings → Builds & deployments). That is
what makes a deploy from `ak-dev` publish to production while a run from any other branch
publishes a preview URL instead — a manual run from a feature branch is a safe preview, never an
accidental release.

---

## How the deploy works

```
preflight   secrets + variables present, API URL absolute and sane      ~5s, fails fast
    ↓
deploy      (customer-web and admin-web in parallel, fail-fast: false)
            install → write .env.production.local → type-check → build
            → verify the configured API URL really is in the bundle
            → ensure an SPA fallback exists
            → wrangler pages deploy
```

**Build-time environment.** The workflow writes `.env.production.local`, which outranks the
committed `.env.production` in Vite's precedence order. The SEO scripts (`seo-shared.mjs`
`readEnv`) read the same files in the same order, so this one file drives both the JS bundle and
the sitemap/prerender output — no per-deploy editing of committed env files.

**Bundle verification.** After building, the workflow greps the output for the configured API
URL. It checks the URL **is present** rather than that `localhost` is absent — the source carries
a `|| 'http://localhost:5050/api/v1'` fallback that survives minification, so the reverse check
would fail every good build.

**SPA fallback.** `customer-web` ships its own `public/_redirects`. `admin-web` does not, so the
workflow writes one; without it a hard refresh on `/admin/gift-boxes/<id>` would 404.

## Troubleshooting

| Job fails at | Meaning |
|---|---|
| preflight → *Missing* | Add the named secret or variable. Note which tab: `CLOUDFLARE_*` are **secrets**, `VITE_*` are **variables**. |
| preflight → *must be an absolute https URL* | `VITE_API_BASE_URL` is relative. See above. |
| deploy → type-check fails | A TypeScript error. It would have been caught earlier by `ci.yml` on the branch. |
| deploy → *does not appear in the built bundle* | The env file was not picked up; check the *Write build-time environment* step output. |
| deploy → wrangler *project not found* | The Pages project does not exist yet, or its name differs from the workflow matrix. |
| Site loads but every API call fails with a CORS error | The Pages origin is missing from `Cors__AllowedOrigins` on the API server, or has a trailing slash. |
| Deployed to a preview URL instead of production | The run was not from `ak-dev`, or the project's production branch is not set to `ak-dev`. |
