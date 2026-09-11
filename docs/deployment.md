# Deployment — where the runbooks live

Each deployable piece has its own self-contained runbook, kept next to what it deploys:

| What | Runbook | Deploys to |
|---|---|---|
| Customer storefront | [`customer-web/DEPLOYMENT.md`](../customer-web/DEPLOYMENT.md) | Cloudflare Pages → `aadhicracker.in` |
| Admin ERP | [`admin-web/DEPLOYMENT.md`](../admin-web/DEPLOYMENT.md) | Cloudflare Pages → `adminerp.aadhicracker.in` |
| API + PostgreSQL | `Aadhi_API_live/DEPLOYMENT.md` (API repo) | AWS Lightsail → `api.aadhicracker.in` |

Cross-cutting references in this repo:

- [`GITHUB_ACTIONS.md`](GITHUB_ACTIONS.md) — CI/CD secrets, variables and per-error
  troubleshooting for both frontend workflows.

The split matters operationally: the two frontends deploy **in parallel and independently**
(`fail-fast: false`), and the API deploys from its own repo with its own rollback — no single
release can take everything down at once.
