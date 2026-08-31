# Aadhi Crackers — Current State Repository Audit

**Date:** 2026-09-01  
**Auditor:** Principal Software & ERP Architect  
**Repositories Audited:**
- **Backend:** `Aadhi_API_live` (.NET 10 LTS Clean Architecture Web API)
- **Frontend:** `Aadhi_UI_live` (React 19 + TypeScript + Vite + Tailwind CSS)

---

## 1. Executive Summary

Both repositories contain high-quality foundations, rich design systems, and verified working code. This audit documents what to **KEEP**, **CHANGE**, **REMOVE**, and **ADD** across the entire platform following the Master Implementation Prompt without rebuilding or deleting existing working implementations.

---

## 2. Audit Breakdown

### Backend (`Aadhi_API_live`)

#### KEEP ✅
- **Clean Architecture Structure**: `AadhiCrackers.Domain`, `AadhiCrackers.Application`, `AadhiCrackers.Infrastructure`, `AadhiCrackers.Api`, `AadhiCrackers.Contracts`.
- **EF Core & Database Setup**: SQLite with Write-Ahead Logging (`WAL`), decimal money converter for minor units.
- **ASP.NET Core Identity & JWT**: Real JWT issuance with role claims, password lockout policies, `admin@aadhicrackers.com` seeding.
- **Middlewares & Cross-Cutting Concerns**: Serilog structured logging, Correlation ID middleware, ProblemDetails error handler, ASP.NET Core rate limiting middleware.
- **Outbox Pattern**: `OutboxMessage` entity, `IOutboxService`, and `OutboxProcessorBackgroundService`.
- **System Diagnostics**: Multi-endpoint health checks (`/health`, `/health/live`, `/health/ready`, `/system-health`).

#### CHANGE 🔄
- **Inventory Authority**: Make `StockItem` the single authoritative warehouse record and deprecate independent `Product.StockQuantity`.
- **Stock Reservation Flow**: Ensure reservation increases `QuantityReserved` without prematurely decreasing `QuantityOnHand`.
- **Order Creation Transaction**: Wrap customer check/creation, order, items, stock reservation, movement, coupon, and audit in a single EF Core atomic transaction.
- **Order State Machine Transitions**: Enforce strict validation returning HTTP 409 Conflict on illegal jumps (e.g. `Delivered -> Pending`).
- **Authorization Enforcement**: Add fine-grained policy attributes across all write endpoints and ERP read endpoints.
- **JWT Key Loading**: Load strictly from `JwtSettings:SecretKey` or environment with production validation.
- **Configuration-Driven Rate Limits**: Read threshold limits from `appsettings.json` / `IOptions<RateLimitSettings>` instead of hardcoded numbers.

#### REMOVE ❌
- Unjustified `[AllowAnonymous]` on internal ERP endpoints (financial ledgers, stock movements, supplier directory, audit logs).
- Any residual fallback mocks returning fabricated business metrics in services.

#### ADD ➕
- **Domain Entities**: `ProductCategory` (multi-category with `IsPrimary`), `ProductVariant`, `GiftBoxItem` (BOM), `ProductReview`, `LoginHistory`, `RateLimitLog`.
- **Payment Model Enhancement**: `IdempotencyKey` tracking on payments to prevent double submissions.
- **Goods Received (GRN) Inspection**: Split received quantities into sellable vs damaged/rejected.
- **Elasticsearch Search Integration**: Safe outbox-driven indexer with non-blocking graceful fallback when ES is offline.
- **OpenTelemetry Metrics**: Metrics tracing for HTTP duration, errors, orders, payments, stock changes, and rate limits.

---

### Frontend (`Aadhi_UI_live/admin-web`)

#### KEEP ✅
- **Design System & Aesthetics**: Dark Navy (`#111238`), purple highlights (`#4F2ACB`), orange CTAs (`#FF7A00`), gold badges (`#FFB000`), glassmorphic panels, and Lucide icons.
- **Global Search (`Ctrl + K`)**: Modal with keyboard shortcuts and categorized result navigation.
- **Module Coverage**: Dashboard, Orders, Catalog, Inventory, Purchases, Finance, Marketing, Reports, Security, Settings.
- **Recharts Integration**: Visual trend charts, donut category breakdown, and revenue graphs.

#### CHANGE 🔄
- **API Architecture**: Split single `services/api.ts` into `apiClient.ts` + dedicated per-module API services (`authApi.ts`, `productApi.ts`, `categoryApi.ts`, `orderApi.ts`, `inventoryApi.ts`, `purchaseApi.ts`, `financeApi.ts`, `reportApi.ts`, `auditApi.ts`, `settingsApi.ts`).
- **Environment Configuration**: Externalize API URLs using `VITE_API_BASE_URL` with `.env.example`, `.env.development`, `.env.production`.
- **Error States**: Replace silent `catch {}` or mock fallbacks with explicit React error states containing human-readable messages, Retry buttons, and Correlation ID references.
- **Routing & Navigation**: Configure `react-router-dom` with deep-linking for all required sub-routes, route guards, and 404 page.

#### REMOVE ❌
- Hardcoded `http://localhost:5050/api/v1` strings in source code.
- Any fallback fake data generated upon network failures.

#### ADD ➕
- **Modular API Service Files**: Clean TypeScript services mapped 1:1 with backend controllers.
- **Product Multi-Section Editor**: 14-section product management interface.
- **Category Tree View**: Hierarchical categories and subcategories management.
- **Data Table Standard**: Paging controls (page, pageSize, totalPages), sorting, loading, and empty states.
- **Permission Route Guards**: Dynamic access restriction based on user permissions (`Products.Read`, `Inventory.Adjust`, etc.).

---

## 3. Implementation Roadmap
1. **Phase 1: Foundation Correctness** (Env config, Error states with Correlation IDs, API service splitting, Router configuration).
2. **Phase 2: Inventory & Stock Ledger Correctness** (`StockItem` authority, atomic reservations, stock movement ledger).
3. **Phase 3: Catalog & BOM Hierarchy** (`ProductCategory`, `ProductVariant`, `GiftBoxItem`, Category Tree).
4. **Phase 4: Orders & State Machine** (Atomic transactions, strict transitions).
5. **Phase 5: Payments & UPI Verification** (Idempotency, audit trail).
6. **Phase 6: Purchases & Goods Receiving** (PO approvals, GRN inspections, Supplier Bills).
7. **Phase 7: Finance & COGS** (True cost basis, P&L calculation).
8. **Phase 8: Enterprise Infrastructure** (Audit atomicity, Outbox worker, Elasticsearch fallback, OpenTelemetry).
9. **Phase 9: Admin UI Polish** (Data tables standard, UI states).
10. **Phase 10: Verification & Testing** (Full end-to-end tests).
