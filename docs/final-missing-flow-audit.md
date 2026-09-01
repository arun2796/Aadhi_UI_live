# AADHI CRACKERS — FINAL CURRENT-STATE AUDIT
**Scope:** MISSING / BROKEN / INCORRECT / FAKE / PARTIAL / DISCONNECTED ONLY  
**Repositories Audited:**
- **Backend:** `Aadhi_API_live` (ASP.NET Core 10 LTS Web API — Clean Architecture)
- **Frontend:** `Aadhi_UI_live` (`admin-web` & `customer-web` — React 19 + TypeScript + Vite + Tailwind CSS)
**Audit Date:** 2026-09-01  
**Auditor:** Principal Enterprise Software Architect & Security Auditor  

---

## EXECUTIVE SUMMARY & AUDIT DIRECTIVE

This audit is an authoritative, zero-assumption verification of the current state of both repositories (`Aadhi_API_live` and `Aadhi_UI_live`). Every finding is traced directly through:
$$\text{UI Component} \longrightarrow \text{API Request} \longrightarrow \text{Controller} \longrightarrow \text{Application Service} \longrightarrow \text{Domain Rule} \longrightarrow \text{Database Persistence} \longrightarrow \text{Response} \longrightarrow \text{UI State}$$

---

# 1. WHAT IS MISSING

### [MISSING-01] Customer Real Authentication & Registration API Integration in Storefront
- **Priority:** P1
- **Repository:** `Aadhi_UI_live`
- **File:** `customer-web/src/context/AuthContext.tsx`, `customer-web/src/services/api.ts`
- **Class/Component:** `AuthProvider`, `api`
- **Method:** `login`, `logout`
- **Current Behavior:** `customer-web` uses hardcoded in-memory/localStorage state (`DEFAULT_CUSTOMER_USER` with `id: 'usr-cust-1'`, email `arun.kumar@gmail.com`). `login()` generates `usr-cust-${Date.now()}` locally without calling `POST /api/v1/auth/login` or `POST /api/v1/auth/register`. No JWT Bearer token is stored or attached to requests.
- **Expected Behavior:** `customer-web` must integrate with `POST /api/v1/auth/login` and `POST /api/v1/auth/register`, persist JWT tokens, attach `Authorization: Bearer <token>` in Axios interceptors, and populate user profile from `GET /api/v1/auth/me`.
- **Why It Is Wrong:** Customer authentication is completely simulated client-side. The backend never validates customer credentials or identity on storefront actions.
- **Required Change:** Add `login`, `register`, `logout`, `getCurrentUser` methods in `customer-web/src/services/api.ts`; add Axios request interceptor for Bearer token; update `AuthContext.tsx` to execute real API calls.
- **Dependencies:** None.

### [MISSING-02] Unauthenticated Password Reset API & Workflow
- **Priority:** P2
- **Repository:** `Aadhi_API_live` & `Aadhi_UI_live`
- **File:** `AadhiCrackers.Api/Controllers/AuthController.cs`, `AadhiCrackers.Infrastructure/Identity/IdentityService.cs`
- **Class/Component:** `AuthController`, `IdentityService`
- **Method:** N/A (Missing endpoints)
- **Current Behavior:** `AuthController` only exposes `POST /change-password` for already authenticated users. There are no endpoints for `POST /forgot-password` (request reset token/OTP) or `POST /reset-password` (apply reset token/new password).
- **Expected Behavior:** Backend must expose rate-limited `forgot-password` and `reset-password` endpoints generating secure cryptographic tokens with expiration, and frontend must provide password reset screens.
- **Why It Is Wrong:** Users who forget passwords have no self-service recovery mechanism and are locked out permanently.
- **Required Change:** Implement `ForgotPasswordAsync` and `ResetPasswordAsync` in `IdentityService`, expose in `AuthController`, and wire in UI.
- **Dependencies:** `INotificationService` (Email/SMS token dispatch).

### [MISSING-03] Real Elasticsearch Client, Cluster Connection & Indexing Pipeline
- **Priority:** P2
- **Repository:** `Aadhi_API_live`
- **File:** `AadhiCrackers.Infrastructure/Services/InfrastructureServices.cs`
- **Class/Component:** `SearchService`
- **Method:** `SearchProductsAsync`
- **Current Behavior:** While `appsettings.json` contains an `"Elasticsearch"` section, no Elasticsearch package (`Elastic.Clients.Elasticsearch` or `NEST`) is referenced or connected. `SearchService` executes SQL `LIKE` queries on SQLite with static placeholder ratings (`Rating = 4.8, ReviewCount = 86`).
- **Expected Behavior:** A real Elasticsearch client must index product documents via background Outbox messages, execute fuzzy/full-text queries, and fall back to SQLite when cluster is unreachable.
- **Why It Is Wrong:** Search is purely SQLite `Contains/LIKE` pretending to have an Elasticsearch backend.
- **Required Change:** Install Elasticsearch client package, create index mappings and background index syncer worker, and use real review aggregations for ratings.
- **Dependencies:** Outbox processor event dispatcher.

### [MISSING-04] Stock Transfer Dedicated List & Detail Query Endpoints
- **Priority:** P2
- **Repository:** `Aadhi_API_live` & `Aadhi_UI_live`
- **File:** `admin-web/src/services/api.ts`, `AadhiCrackers.Api/Controllers/ErpAndOperationsControllers.cs`
- **Class/Component:** `InventoryController`, `admin-web api`
- **Method:** `getStockTransfers`
- **Current Behavior:** `InventoryController` exposes `POST /inventory/transfers` to execute a transfer, but does not expose `GET /inventory/transfers` to query historical transfer documents. `admin-web` stubs `getStockTransfers: async () => [] as StockTransfer[]`.
- **Expected Behavior:** Backend must expose `GET /api/v1/inventory/transfers` with pagination, and `admin-web` must display real historical transfers.
- **Why It Is Wrong:** Warehouse staff cannot view past inter-warehouse transfer records in the UI.
- **Required Change:** Add `GetStockTransfersAsync` in `InventoryService`, expose in `InventoryController`, and wire `admin-web`.
- **Dependencies:** None.

---

# 2. WHAT IS BROKEN

### [BROKEN-01] FluentValidation Pipeline Execution Bypassed on All API Controllers
- **Priority:** P0
- **Repository:** `Aadhi_API_live`
- **File:** `src/AadhiCrackers.Api/Program.cs`, `src/AadhiCrackers.Application/DependencyInjection.cs`
- **Class/Component:** `Program.cs`, `DependencyInjection.cs`
- **Method:** `Program.cs` service configuration
- **Current Behavior:** `services.AddValidatorsFromAssembly(...)` registers all validator classes into the DI container, but `builder.Services.AddFluentValidationAutoValidation()` is NOT configured on MVC controllers, and controllers/services do NOT inject `IValidator<T>`.
- **Expected Behavior:** Incoming requests must automatically execute FluentValidation rules (e.g. `CreateProductRequestValidator`, `CreateOrderRequestValidator`, `CreatePurchaseOrderRequestValidator`) and return RFC 7807 400 Bad Request with structured field errors.
- **Why It Is Wrong:** Business rules defined in FluentValidation classes (e.g. price > 0, SKU format, positive quantities) are never executed during API calls.
- **Required Change:** Add `SharpGrip.FluentValidation.AutoValidation.Mvc` or configure `FluentValidationAutoValidation` in `Program.cs`.
- **Dependencies:** None.

### [BROKEN-02] Customer Order Authorization IDOR Vulnerability & Type Mismatch
- **Priority:** P0
- **Repository:** `Aadhi_API_live`
- **File:** `src/AadhiCrackers.Api/Controllers/ErpAndOperationsControllers.cs`, `src/AadhiCrackers.Api/Controllers/CustomersAndPromotionsControllers.cs`
- **Class/Component:** `OrdersController`, `CustomersController`
- **Method:** `GetOrders`, `GetOrderById`, `GetCustomerOrders`
- **Current Behavior:** `OrdersController.GetOrders` and `GetOrderById` contain:
  ```csharp
  if (_currentUser.Role == "Customer" && Guid.TryParse(_currentUser.UserId, out var customerGuid))
  {
      if (order.CustomerId != customerGuid) return Forbid();
  }
  ```
  1. `_currentUser.UserId` is the `IdentityUser` ID (string GUID from `AspNetUsers`), whereas `order.CustomerId` is the `Customer.Id` (primary key of `Customers` table). Comparing them directly fails or compares mismatched entity IDs.
  2. If `Guid.TryParse(_currentUser.UserId, out ...)` returns `false` (e.g. non-GUID user ID), the check is completely skipped and the customer gets full access to ALL company orders.
- **Expected Behavior:** Authoritatively lookup `Customer` entity by `UserId == _currentUser.UserId`. If found, filter strictly by `order.CustomerId == customer.Id`. If user is a Customer and has no customer record, return empty list / 403 Forbidden.
- **Why It Is Wrong:** Critical security vulnerability allowing potential cross-tenant IDOR order data leakage and authorization bypass.
- **Required Change:** Refactor customer resolution in `OrdersController` and `OrderService` to query `_context.Customers.FirstOrDefaultAsync(c => c.UserId == _currentUser.UserId)`.
- **Dependencies:** None.

### [BROKEN-03] Unhandled Outbox Event Types Silently Swallowed as "Processed"
- **Priority:** P1
- **Repository:** `Aadhi_API_live`
- **File:** `src/AadhiCrackers.Infrastructure/BackgroundJobs/BackgroundServices.cs`
- **Class/Component:** `OutboxProcessorBackgroundService`
- **Method:** `ExecuteAsync`
- **Current Behavior:** The switch statement only handles `"OrderPlaced"` and `"OrderStatusChanged"`. The `default:` case logs a debug statement (`_logger.LogDebug(...)`) and immediately marks the outbox message `Status = "Processed"`.
- **Expected Behavior:** Handlers for all domain event types (`PaymentReceived`, `ReturnInspected`, `InventoryAdjusted`, `AuditLogCreated`, `GoodsReceiptCreated`) must execute real downstream integration (or throw unhandled exception if unsupported).
- **Why It Is Wrong:** Domain events that are not explicitly matched are silently discarded and marked successful without performing any action.
- **Required Change:** Implement handlers for all registered domain events or route to dedicated message handlers via MediatR/subscriber pattern.
- **Dependencies:** None.

---

# 3. WHAT IS PARTIAL

### [PARTIAL-01] Product Variants Disconnected from Warehouse Inventory & Order Items
- **Priority:** P1
- **Repository:** `Aadhi_API_live` & `Aadhi_UI_live`
- **File:** `src/AadhiCrackers.Domain/Entities/CatalogEntities.cs`, `src/AadhiCrackers.Domain/Entities/OrderEntities.cs`, `src/AadhiCrackers.Application/Services/OrderService.cs`
- **Class/Component:** `ProductVariant`, `OrderItem`, `StockItem`
- **Method:** `CreateOrderAsync`, `StockItem` mapping
- **Current Behavior:** `ProductVariant` entity exists in database with `ProductId`, `SKU`, `Name`, `Price`, `CostPrice`, `StockQuantity`. However:
  1. `StockItem` links to `ProductId` only (no `ProductVariantId`), so variants do not have multi-warehouse inventory tracking.
  2. `OrderItem` only captures `ProductId` (no `ProductVariantId`), so order placement cannot select and purchase a specific variant.
  3. `ProductVariant` lacks `MRP`, `Barcode`, and `WeightKg`.
- **Expected Behavior:** `ProductVariant` should support multi-warehouse stock balances, and `OrderItem` / `AddToCartRequest` must capture `ProductVariantId` when purchasing variant products.
- **Why It Is Wrong:** Variants exist as catalog display entities but cannot be fulfillment-tracked or ordered independently.
- **Required Change:** Add `ProductVariantId` to `OrderItem`, `CreateOrderItemRequest`, and create `StockItem` variant linkage.
- **Dependencies:** Cart and Order contracts.

### [PARTIAL-02] Notification Service Console-Only Mock Handlers
- **Priority:** P2
- **Repository:** `Aadhi_API_live`
- **File:** `src/AadhiCrackers.Infrastructure/Services/InfrastructureServices.cs`
- **Class/Component:** `NotificationService`
- **Method:** `SendOrderConfirmationAsync`, `SendOrderStatusUpdatedAsync`, `SendLowStockAlertAsync`
- **Current Behavior:** Methods log messages to Serilog (`_logger.LogInformation(...)`) and return `Task.CompletedTask`. No SMS gateway (e.g. Fast2SMS/Twilio) or SMTP/SendGrid email integration exists.
- **Expected Behavior:** Real email and SMS dispatches must be triggered with configurable provider credentials.
- **Why It Is Wrong:** Customers and admin staff do not receive real transactional emails or SMS notifications.
- **Required Change:** Implement SMTP/SendGrid provider and SMS provider behind `INotificationService`.
- **Dependencies:** Configuration secrets.

---

# 4. WHAT IS INCORRECT

### [INCORRECT-01] Search Service Hardcoded Product Ratings and Reviews Count
- **Priority:** P2
- **Repository:** `Aadhi_API_live`
- **File:** `src/AadhiCrackers.Infrastructure/Services/InfrastructureServices.cs`
- **Class/Component:** `SearchService`
- **Method:** `SearchProductsAsync` (lines 163-164)
- **Current Behavior:** `SearchService` projects search results with hardcoded `Rating = 4.8` and `ReviewCount = 86` for every product returned.
- **Expected Behavior:** `SearchService` must calculate `Rating = p.Reviews.Any(r => r.Status == "Approved") ? p.Reviews.Where(r => r.Status == "Approved").Average(r => r.Rating) : 0` and `ReviewCount = p.Reviews.Count(r => r.Status == "Approved")`.
- **Why It Is Wrong:** All searched products show fake rating data (4.8 stars, 86 reviews) regardless of actual customer reviews.
- **Required Change:** Compute real average rating and review count from `Product.Reviews` collection in EF Core query.
- **Dependencies:** None.

---

# 5. WHAT IS MOCKED / UI-ONLY

### [UI_ONLY-01] Admin ERP Quotes & Homepage Banner Management
- **Priority:** P3
- **Repository:** `Aadhi_UI_live`
- **File:** `admin-web/src/services/api.ts`
- **Class/Component:** `api`
- **Method:** `getQuotes`, `convertQuoteToOrder`, `getHomepageBanners`
- **Current Behavior:** `getQuotes` returns `[] as Quote[]`, `convertQuoteToOrder` returns mock fake object `ORD-${Date.now()}`, and `getHomepageBanners` returns `[] as HomepageBanner[]`. No backend controllers or database entities exist for Quotes or Homepage Banners.
- **Expected Behavior:** Either backend entities and CRUD endpoints must be created, or unused Quote/Banner UI tabs should be hidden.
- **Why It Is Wrong:** Admin UI presents tabs and buttons that operate entirely on dummy memory arrays without persistence.
- **Required Change:** Implement backend `Quotes` / `Banners` endpoints or remove unused stub views.
- **Dependencies:** None.

---

# 6. WHAT HAS CONTRACT MISMATCH

### [CONTRACT_MISMATCH-01] Customer Portal Orders Query Mismatch & Missing Auth Headers
- **Priority:** P1
- **Repository:** `Aadhi_UI_live` & `Aadhi_API_live`
- **File:** `customer-web/src/pages/customer/AccountPage.tsx`, `customer-web/src/services/api.ts`, `AadhiCrackers.Api/Controllers/ErpAndOperationsControllers.cs`
- **Class/Component:** `AccountPage`, `api.getCustomerOrders`, `OrdersController.GetCustomerOrders`
- **Current Behavior:** `AccountPage.tsx` calls `api.getCustomerOrders(user.id)`. `user.id` is `'usr-cust-1'`. `OrdersController.GetCustomerOrders` requires `[Authorize]` and expects a Guid `customerId`. It attempts `Guid.TryParse("usr-cust-1", out _)` which fails and returns an empty array. Moreover, `customer-web` sends no `Authorization: Bearer` header.
- **Expected Behavior:** `customer-web` should call `GET /api/v1/orders/my-orders` or `GET /api/v1/customers/me/orders` with authenticated JWT Bearer token, and the backend must resolve the customer from JWT claims.
- **Why It Is Wrong:** Logged-in customers cannot view their historical orders in the customer portal.
- **Required Change:** Create `GET /api/v1/orders/my-orders` endpoint in backend resolving `_currentUser.UserId`, and update `customer-web` to attach JWT tokens.
- **Dependencies:** [MISSING-01].

---

# 7. WHAT IS NOT PERSISTED

### [NOT_PERSISTED-01] Rate Limit Violation Logging to Database
- **Priority:** P2
- **Repository:** `Aadhi_API_live`
- **File:** `src/AadhiCrackers.Api/Middleware/RateLimitingPolicies.cs`, `src/AadhiCrackers.Infrastructure/Identity/IdentityService.cs`
- **Class/Component:** `RateLimitingPolicies`, `IdentityService`
- **Method:** `AddAppRateLimiting` (`options.OnRejected`), `GetRateLimitLogsAsync`
- **Current Behavior:** `RateLimitLog` entity and table exist in DB, and `GET /api/v1/auth/rate-limit-logs` queries `_context.RateLimitLogs`. However, `options.OnRejected` in `RateLimitingPolicies.cs:27-49` never instantiates or saves a `RateLimitLog` record to `_context.RateLimitLogs`.
- **Expected Behavior:** When a request is rejected with HTTP 429, `OnRejected` must persist a `RateLimitLog` with `IpAddress`, `Endpoint`, `TimestampUtc`, and `ViolationCount`.
- **Why It Is Wrong:** Rate limit violation audits are permanently empty in the admin security dashboard.
- **Required Change:** Inject `IServiceScopeFactory` into `OnRejected` handler and save `RateLimitLog` record asynchronously.
- **Dependencies:** None.

### [NOT_PERSISTED-02] Login History IP Address & User Agent Fields
- **Priority:** P3
- **Repository:** `Aadhi_API_live`
- **File:** `src/AadhiCrackers.Infrastructure/Identity/IdentityService.cs`
- **Class/Component:** `IdentityService`
- **Method:** `AuthenticateAsync` (lines 54-61)
- **Current Behavior:** When `LoginHistory` is inserted, `IpAddress` and `UserAgent` properties are omitted, leaving them `NULL` in the database.
- **Expected Behavior:** `ICurrentUserService` / `IHttpContextAccessor` should capture client IP and User-Agent header and store them on `LoginHistory`.
- **Why It Is Wrong:** Admin security audit logs show login timestamps without device or IP traceability.
- **Required Change:** Populate `IpAddress = _currentUser.IpAddress` and `UserAgent = _currentUser.UserAgent` on `LoginHistory`.
- **Dependencies:** None.

---

# 8. WHAT IS A SECURITY RISK

### [SECURITY_RISK-01] Unrestricted File Upload Types in Storage Service
- **Priority:** P1
- **Repository:** `Aadhi_API_live`
- **File:** `src/AadhiCrackers.Infrastructure/Services/InfrastructureServices.cs`
- **Class/Component:** `LocalFileStorageService`
- **Method:** `SaveFileAsync`
- **Current Behavior:** `SaveFileAsync` takes any file extension from `Path.GetExtension(fileName)` and writes it directly to `wwwroot/storage/`. There is no check against an extension allowlist (`.jpg`, `.jpeg`, `.png`, `.webp`), no MIME type inspection, and no magic header validation.
- **Expected Behavior:** Strict allowlist validation (`.jpg`, `.jpeg`, `.png`, `.webp`), MIME type verification, maximum size enforcement (e.g. 5MB), and rejection of executable or script extensions.
- **Why It Is Wrong:** If an upload endpoint is exposed or authenticated, a malicious actor could upload dangerous files (e.g. `.html`, `.svg` with XSS, `.exe`) into `wwwroot`.
- **Required Change:** Add file extension allowlist and byte signature validation in `LocalFileStorageService.SaveFileAsync`.
- **Dependencies:** None.

---

# 9. WHAT IS A DATA INTEGRITY RISK

### [DATA_INTEGRITY_RISK-01] Product Category Circular Parent Loop Edge Case
- **Priority:** P2
- **Repository:** `Aadhi_API_live`
- **File:** `src/AadhiCrackers.Application/Services/CatalogService.cs`
- **Class/Component:** `CatalogService`
- **Method:** `UpdateCategoryAsync`
- **Current Behavior:** While basic circular checks exist, if multiple hierarchy updates occur concurrently, a circular reference ($A \rightarrow B \rightarrow C \rightarrow A$) could cause infinite recursion during hierarchical tree queries.
- **Expected Behavior:** Database query should validate entire ancestor chain up to root with cycle detection before saving parent category changes.
- **Why It Is Wrong:** Hierarchy navigation queries could suffer from stack overflow or infinite loops.
- **Required Change:** Add ancestor depth traversal guard (max depth 5) and cycle detection set in `UpdateCategoryAsync`.
- **Dependencies:** None.

---

# 10. FINAL MODULE STATUS TABLE

| Module | Backend | Database | API | UI | Business Logic | End-to-End | Status |
|---|---|---|---|---|---|---|---|
| **Customer Authentication** | COMPLETE | COMPLETE | COMPLETE | MOCKED | COMPLETE | BROKEN | **MOCKED / BROKEN** |
| **Admin ERP Authentication** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **RBAC / Permissions** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | PARTIAL (IDOR) | PARTIAL | **SECURITY_RISK** |
| **Product Catalog** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Category Flow & Hierarchy** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Product Variants** | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | **PARTIAL** |
| **Gift Box / Bundle BOM** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Inventory Source of Truth** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Stock Movements & Ledger** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Stock Reservation Lifecycle** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Stock Concurrency Protection** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Order Placement & State Machine** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Order Cancellation & Rollback** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Payment UPI Proof & UTR** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Payment Idempotency** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Refunds Workflow** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Return Orders & Inspection** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Purchase Orders & Approval** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Goods Receipt & Inspection Breakdown** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Supplier Bills & AP Payables** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Customer Invoices & AR Receivables** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **COGS & Real Profit & Loss** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Promotions Lifecycle & Redemptions** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Dashboard Live KPIs** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Reports Center & CSV Export** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Dashboard & Reports Reconciliation** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Customer Cart & Live Calculation** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Customer Live Order Tracking** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Audit Log with Diffs** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | **COMPLETE** |
| **Transactional Outbox & Worker** | COMPLETE | COMPLETE | COMPLETE | N/A | PARTIAL (Event Types) | PARTIAL | **PARTIAL** |
| **Search & Elasticsearch** | PARTIAL | COMPLETE | COMPLETE | COMPLETE | MOCKED (SQL Fallback) | PARTIAL | **MOCKED** |
| **Rate Limiting Policies** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | PARTIAL (No Log Insert) | PARTIAL | **NOT_PERSISTED** |
| **FluentValidation Execution** | COMPLETE | N/A | BROKEN | N/A | BROKEN | BROKEN | **BROKEN** |
| **File Upload Security** | PARTIAL | N/A | PARTIAL | COMPLETE | PARTIAL | PARTIAL | **SECURITY_RISK** |

---

# 11. FINAL VERDICT & STRATEGIC RECOMMENDATIONS

### 1. Is the current application production-ready?
**No.** While the core financial, inventory, purchase order, return inspection, and promotion business rules are fully verified in EF Core and backend domain models, there are **3 critical blockers** (FluentValidation pipeline execution bypass, Customer IDOR type mismatch vulnerability, and simulated customer storefront authentication) that must be addressed before production deployment.

### 2. What are the top 10 blockers?
1. **[BROKEN-01]** FluentValidation filters are not wired into the ASP.NET Core controller pipeline.
2. **[BROKEN-02]** Customer order authorization check in `OrdersController` compares `IdentityUser.Id` against `Customer.Id` and fails open on non-Guid user IDs (IDOR risk).
3. **[MISSING-01]** `customer-web` storefront uses a hardcoded mock user in `AuthContext.tsx` without connecting to `POST /api/v1/auth/login` or passing JWT Bearer tokens.
4. **[CONTRACT_MISMATCH-01]** Customer order history in `AccountPage.tsx` sends unauthenticated requests with dummy ID `'usr-cust-1'` resulting in empty lists.
5. **[NOT_PERSISTED-01]** Rate limit rejections in `RateLimitingPolicies.cs` do not write `RateLimitLog` records to the database.
6. **[SECURITY_RISK-01]** `LocalFileStorageService.SaveFileAsync` lacks file extension allowlists and magic byte validation.
7. **[BROKEN-03]** Outbox processor silently marks unhandled domain event types as `Processed`.
8. **[PARTIAL-01]** Product variants lack independent multi-warehouse inventory linkage in `StockItem` and cannot be ordered directly in `OrderItem`.
9. **[INCORRECT-01]** `SearchService` hardcodes fake rating statistics (`Rating = 4.8, ReviewCount = 86`).
10. **[MISSING-02]** Missing unauthenticated `forgot-password` and `reset-password` API endpoints and screens.

### 3. What is already correctly implemented?
- **Inventory Ledger:** `StockItem.QuantityOnHand` and `QuantityReserved` are the sole authority. Dual-update hazards and stock drift are completely eliminated.
- **Reservation & Deduction Lifecycle:** Orders reserve stock (`StockMovementType.StockReserved`), cancellations release reserved stock (`StockMovementType.StockReservationReleased`), shipments deduct on-hand and reserved with a single `Sale` movement, and deliveries never double-deduct.
- **Concurrency Protection:** EF Core `RowVersion` concurrency tokens prevent overselling race conditions across products, stock items, and promotions.
- **Atomic Transactions:** `BeginTransactionAsync()` guarantees that business updates, audit diff logs, and outbox messages commit atomically.
- **Return & Inspection Workflow:** `ReturnOrder` lifecycle (`Requested -> Approved -> Received -> Inspected -> Closed`) with 2-step physical inspection where sellable units restock via `StockMovementType.Return` and damaged units log via `StockMovementType.Damage`.
- **Purchase Order & Goods Receipt:** Strict state machine; Goods Receipts require approved POs; accepted stock is calculated as $\text{Received} - \text{Rejected} - \text{Damaged}$; automatic `SupplierBill` generation.
- **True COGS & P&L:** Historical `CostPriceSnapshot` on `OrderItem`; zero fabricated revenue or dashboard constants; 100% live EF Core aggregations.
- **Promotion Lifecycle & Redemptions:** `PromotionStatus` lifecycle, per-customer redemption tracking via `PromotionRedemption` table, and automatic redemption rollback on cancellation/rejection.
- **Customer Storefront Live Tracking & Cart Calculation:** Authoritative backend calculation via `/cart/calculate` and live tracking timeline from `OrderStatusHistory`.

### 4. What must NOT be changed?
- **Domain Entities & Value Objects:** `Money`, `Address`, `StockItem`, `StockMovement`, `ReturnOrder`, `GoodsReceipt`, `SupplierBill`, `PromotionRedemption`.
- **Authoritative Stock Logic:** The single source of truth in `StockItem` and movement audit logging in `OrderService` and `InventoryService`.
- **Pricing & Calculation Engine:** Authoritative cart calculation in `CartService.CalculateCartAsync`.
- **Existing EF Core Migrations:** `InitialCreate` and `AddPromotionRedemptions`.

### 5. What is still missing?
- Real storefront customer JWT login/register/logout flow in `customer-web`.
- Forgot password / reset password endpoints and UI.
- Real Elasticsearch indexing pipeline and cluster client.
- Dedicated `GET /api/v1/inventory/transfers` query endpoint.

### 6. What business flows are currently unsafe?
- **Customer Order Access:** Due to `Guid.TryParse(_currentUser.UserId, out ...)` comparing Identity ID against Customer ID in `OrdersController`, customer authorization can fail open or fail to resolve.
- **Incoming Request Validation:** Request DTO validation rules in FluentValidation are not executed automatically by ASP.NET Core controllers.
- **File Uploads:** `SaveFileAsync` does not reject executable file extensions.

### 7. What API changes are required?
1. Add `GET /api/v1/orders/my-orders` for authenticated customers.
2. Add `GET /api/v1/inventory/transfers` for warehouse staff.
3. Add `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password`.
4. Fix `OrdersController` to resolve `Customer` via `_context.Customers.FirstOrDefaultAsync(c => c.UserId == _currentUser.UserId)`.

### 8. What database changes are required?
1. Add `ProductVariantId` nullable foreign key column to `OrderItems` and `StockItems` to support full variant inventory and ordering.
2. Add `Barcode`, `MRP`, and `WeightKg` columns to `ProductVariants`.

### 9. What UI changes are required?
1. Update `customer-web/src/context/AuthContext.tsx` to execute real `POST /api/v1/auth/login` and `POST /api/v1/auth/register`, storing the JWT token in `localStorage`.
2. Add Axios request interceptor in `customer-web/src/services/api.ts` to attach `Authorization: Bearer <token>`.
3. Update `AccountPage.tsx` to call `api.getMyOrders()` with the authenticated token.

### 10. What tests are required?
1. **Automated Validation Tests:** Verify that submitting invalid DTOs (negative quantities, empty SKUs) to controllers returns HTTP 400 Bad Request.
2. **Customer IDOR Integration Tests:** Verify that Customer A cannot view Customer B's orders or all company orders.
3. **Storefront Auth E2E Tests:** Verify registration, login, token persistence, and order placement with JWT.
