# Rate Limiting Policies & Security Governance

## 1. Rate Limiting Configuration

| Policy Name | Window | Permit Limit | Target |
|---|---|---|---|
| `PublicGeneral` | 1 minute | 100 reqs | Per IP Address |
| `AuthLogin` | 1 minute | 5 reqs | Per IP Address |
| `PasswordReset` | 15 minutes | 3 reqs | Per IP Address |
| `ProductSearch` | 1 minute | 60 reqs | Per IP Address |
| `Checkout` | 1 minute | 10 reqs | Per User / IP |
| `OrderCreation` | 10 minutes | 10 reqs | Per User / IP |
| `AdminApi` | 1 minute | 120 reqs | Per Authenticated User |
| `ReportsExport` | 1 minute | 30 reqs | Per Authenticated User |
| `AuditSearch` | 1 minute | 60 reqs | Per Authenticated User |

## 2. Dynamic `Retry-After` Header
- When limit is exceeded, server responds with `HTTP 429 Too Many Requests`.
- `Retry-After` header indicates the precise number of seconds remaining until the rate-limiting window resets.
- Violations are logged to the `RateLimitLogs` security table for audit inspection.
