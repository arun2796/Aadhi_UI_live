# AADHI CRACKERS — PHASE 0 IMPLEMENTATION BASELINE & CHECKLIST

**Date:** 2026-09-01  
**Primary Source:** Phase 0 Business Logic & Architecture Gap Analysis  
**Repositories:**
- **Backend:** `Aadhi_API_live` (ASP.NET Core 10 LTS Clean Architecture)
- **Frontend:** `Aadhi_UI_live` (React 19 + TypeScript + Vite + Tailwind CSS)

---

## 1. Finding & Implementation Checklist

| ID | Domain | Current Problem | Affected Files | Required Fix | Dependency | Status |
|---|---|---|---|---|---|---|
| **GAP-01** | Database | Dependence on EnsureCreatedAsync without evolvable EF migrations. | `AadhiDbContext.cs`, `Program.cs` | Add migration infrastructure, evolvable schema. | None | `IMPLEMENTED` |
| **GAP-02** | Transactions | `IApplicationDbContext` cannot open explicit database transactions. | `IApplicationInterfaces.cs`, `AadhiDbContext.cs` | Add `BeginTransactionAsync()` with `IDbContextTransaction`. | GAP-01 | `IMPLEMENTED` |
| **GAP-03** | Inventory Authority | Competing stock counts in `Product.StockQuantity` and `StockItem.QuantityOnHand`. | `InventoryService.cs`, `StockItem.cs`, `Product.cs` | Make `StockItem` sole authoritative source ($\text{Available} = \text{OnHand} - \text{Reserved}$). | None | `IMPLEMENTED` |
| **GAP-04** | Stock Ledger | Ledger movements missing intermediate reservation states. | `StockMovement.cs`, `InventoryService.cs` | Implement 10 movement types (`OpeningStock`, `Purchase`, `StockReserved`, `StockReservationReleased`, `Sale`, etc.). | GAP-03 | `IMPLEMENTED` |
| **GAP-05** | Order Stock Lifecycle | Potential for double deductions on delivery. | `OrderService.cs`, `OrderEntities.cs` | Reserve on checkout, release on cancel, single deduction on shipment. | GAP-04 | `IMPLEMENTED` |
| **GAP-06** | Order State Machine | Potential illegal state jumps. | `OrderEntities.cs`, `OrderService.cs` | Enforce legal state transitions; throw HTTP 409 on invalid jumps. | None | `IMPLEMENTED` |
| **GAP-07** | Payments & Idempotency | Duplicate payment submissions possible. | `OrderService.cs`, `PaymentsController.cs`, `Payment.cs` | Add `IdempotencyKey` and unique UTR indexes; verify state. | GAP-06 | `IMPLEMENTED` |
| **GAP-08** | Returns & Inspections | Returned orders automatically restocked without inspection. | `ReturnEntities.cs`, `ReturnService.cs` | Add `ReturnOrder`, `ReturnOrderItem`, `ReturnInspection` (Sellable vs Damaged). | GAP-04 | `IMPLEMENTED` |
| **GAP-09** | Refunds | Duplicate refund requests possible. | `FinanceEntities.cs`, `FinanceService.cs` | Add `Refund` model; restrict refund amount $\le$ paid amount. | GAP-07 | `IMPLEMENTED` |
| **GAP-10** | Purchasing & GRN | GRN lacks ordered vs received vs damaged split. | `PurchaseEntities.cs`, `PurchaseService.cs` | Add `GoodsReceiptItem` inspection formula ($\text{Accepted} = \text{Received} - \text{Rejected} - \text{Damaged}$). | GAP-03 | `IMPLEMENTED` |
| **GAP-11** | Supplier Bills | Hardcoded payables without real bills. | `PurchaseEntities.cs`, `FinanceService.cs` | Add `SupplierBill` model with paid and balance tracking. | GAP-10 | `IMPLEMENTED` |
| **GAP-12** | COGS Accounting | Historical COGS calculated from volatile current cost. | `OrderItem.cs`, `OrderService.cs`, `FinanceService.cs` | Add immutable `OrderItem.CostPriceAtSale` snapshot. | GAP-05 | `IMPLEMENTED` |
| **GAP-13** | Finance P&L | Revenue treated as grand total without returns/discounts subtraction. | `FinanceService.cs`, `ReportService.cs` | Server-side formula ($\text{Net Sales} - \text{COGS} - \text{OPEX} = \text{Net Profit}$). | GAP-12 | `IMPLEMENTED` |
| **GAP-14** | Fabricated Data | Frontend catch blocks and services containing hardcoded mock numbers. | Frontend API services & ERP pages | Eliminate all mock numbers; display real API data or error state. | None | `IMPLEMENTED` |
| **GAP-15** | Outbox Worker | Worker marked messages processed without executing handlers. | `BackgroundServices.cs` | Implement typed outbox dispatch with exponential backoff & dead-letter queue. | GAP-02 | `IMPLEMENTED` |
| **GAP-16** | Low Stock Alerts | Background worker sending duplicate alerts every cycle. | `BackgroundServices.cs` | Add state cache (`_alertedProductIds`) for deduplicated threshold alerts. | None | `IMPLEMENTED` |
| **GAP-17** | Authorization & RBAC | Internal ERP endpoints lacked policy enforcement. | Controllers, `Program.cs` | Apply 8 granular policies (`RequireAdmin`, `RequireInventoryManager`, etc.). | None | `IMPLEMENTED` |
| **GAP-18** | UI Data Tables | Unpaginated full collection rendering and mock fallbacks. | Admin ERP Module pages | Standardize on server-side paging, search, filtering, and sort. | GAP-14 | `IMPLEMENTED` |
| **GAP-19** | Customer Checkout | Pricing calculated in browser. | Customer Cart/Checkout | Authoritative calculation via backend calculation endpoint. | GAP-05 | `IMPLEMENTED` |
| **GAP-20** | API Standard & Errors | Inconsistent pagination DTOs and stack traces exposed. | `ProblemDetailsExceptionHandler.cs`, `apiClient.ts` | ProblemDetails with Correlation IDs and standard `PagedResult<T>`. | None | `IMPLEMENTED` |
