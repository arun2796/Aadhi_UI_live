# DEPLOYMENT — Admin ERP (`admin-web`)

How the staff-facing ERP (`adminerp.aadhicracker.in`) reaches production on **Cloudflare
Pages**, with automatic deployment from GitHub.

This file covers the admin app only. The API has its own runbook
(`Aadhi_API_live/DEPLOYMENT.md`) and the storefront has `customer-web/DEPLOYMENT.md`.

```
  push to ak-dev ─▶ GitHub Actions ──build──▶ Cloudflare Pages: aadhi-admin
                                                      │
                    staff ◀── adminerp.aadhicracker.in ┘
                        │ email + password only (JWT)
                        ▼
              https://api.aadhicracker.in
```

A static build with no server of its own. Sign-in is **email + password only** — this app has
no Firebase, deliberately: Google sign-in exists solely on the storefront and the API refuses
a staff email arriving through it.

---

## 1. Cloudflare Pages project (once, by hand)

Workers & Pages → **Create** → **Pages** → **Upload assets** (Direct Upload):

| Setting | Value |
|---|---|
| Project name | `aadhi-admin` — hard-coded in `deploy-pages.yml`'s matrix; change both together |
| Production branch | **`ak-dev`** — the deploy workflow runs from `ak-dev`; a deploy publishes to production only when its branch matches this setting, any other branch gets a preview URL |

**Custom domain** (project → Custom domains): `adminerp.aadhicracker.in`. TLS is provisioned
automatically when the DNS zone is on the same Cloudflare account.

Keeping the admin on its own subdomain (and its own Pages project) means its deployments,
rollbacks and access are independent of the storefront — a broken storefront release cannot
take the counter's ERP down with it, and vice versa.

## 2. GitHub configuration

Shared with the storefront — one set per repository (`Aadhi_UI_live` → Settings → Secrets and
variables → Actions), used by both apps in the matrix:

| Kind | Name | Value |
|---|---|---|
| secret | `CLOUDFLARE_API_TOKEN` | custom token, **Cloudflare Pages: Edit** only — never the Global API Key |
| secret | `CLOUDFLARE_ACCOUNT_ID` | dashboard sidebar |
| variable | `VITE_API_BASE_URL` | `https://api.aadhicracker.in/api/v1` — **absolute**; a relative path would resolve to Pages itself and every request would 404. Preflight rejects it |

(`VITE_SITE_URL` exists too but is storefront-SEO only; this app ignores it.)

## 3. What the pipeline does

`.github/workflows/deploy-pages.yml`, on every push to `ak-dev` — the two apps build **in
parallel with `fail-fast: false`**, so a broken storefront build never blocks an admin fix
from shipping, or the other way around:

```
preflight  secrets/variables present, API URL absolute        ~5s, fails fast
deploy     npm ci → write .env.production.local → type-check → build
           → verify the configured API URL is really inside the bundle
           → write an SPA fallback → deploy via wrangler
```

**The SPA fallback matters here specifically:** `admin-web` ships no `public/_redirects` of
its own, so the workflow writes `/*  /index.html  200` into the build. Without it, a hard
refresh on any deep link — `/admin/gift-boxes/<id>`, `/admin/orders/<id>` — would 404, and an
ERP is used almost entirely at deep links.

`ci.yml` type-checks and builds on every other branch and every PR.

## 4. The API-side settings this app depends on

Set on the Lightsail server (`/etc/aadhi-api/aadhi-api.env`), not here — listed because when
they are wrong, it is *this* app that visibly breaks:

| API setting | Breaks the admin how |
|---|---|
| `Cors__AllowedOrigins` missing `https://adminerp.aadhicracker.in` (exact scheme, no trailing slash) | login and every API call blocked by the browser with a CORS error |
| `Seeding__AdminEmail` / `Seeding__AdminPassword` | this is the account you first log in with; change the password in the app afterwards |
| `Storage__R2__*` | product image uploads from the catalogue/gift-box forms fail with a 500 naming the failing key |
| `JwtSettings__SecretKey` rotated | every staff member is signed out (expected effect, not a bug) |

## 5. Verification checklist

- [ ] `https://adminerp.aadhicracker.in` loads over HTTPS
- [ ] Log in with the seeded admin account → dashboard renders with live numbers
- [ ] Hard-refresh a deep link (`/admin/orders`) — no 404 (SPA fallback works)
- [ ] Devtools → Network: calls go to `https://api.aadhicracker.in/api/v1/…`, no CORS errors
- [ ] Upload a product image → previews, and its URL serves from the R2 public origin in an
      incognito tab
- [ ] Open an order → **Print Estimate** produces the A4 document
- [ ] System Health screen: database Connected, outbox pending drains to 0; if a dead-letter
      count shows, the **Retry undelivered notifications** button clears it
- [ ] Push a trivial commit to `ak-dev` → `CI` runs and passes

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Deploy fails at preflight | The named secret/variable is missing, or `VITE_API_BASE_URL` is relative — §2 |
| Deploy fails: *does not appear in the built bundle* | Env file not picked up; check the "Write build-time environment" step output |
| wrangler: *project not found* | Pages project missing or named differently from the matrix — §1 |
| Login fails with a CORS error in the console | `https://adminerp.aadhicracker.in` missing from the API's `Cors__AllowedOrigins` — §4 |
| Login rejected with valid credentials | Wrong seeded credentials, or the API restart-looped on boot — check `journalctl -u aadhi-api -n 50` on the server |
| Deep links 404 on refresh | The SPA fallback step was skipped/altered — §3 |
| Image upload fails | R2 keys on the API server — §4 |
| Deployed to a preview URL instead of production | Run wasn't from `ak-dev`, or the project's production branch isn't `ak-dev` — §1 |
