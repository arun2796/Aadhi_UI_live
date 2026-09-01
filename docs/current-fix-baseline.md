# AADHI CRACKERS — CURRENT FIX BASELINE REPORT
**Date:** 2026-09-01  
**Auditor / Principal Software Architect:** Principal Software Architect  
**Objective:** Record pre-modification build, test, and typecheck baseline across backend and frontend repositories.

---

## 1. Backend Baseline (`Aadhi_API_live`)

- **Command Executed:** `dotnet test AadhiCrackers.slnx`
- **Build Status:** SUCCESS (0 errors, 1 nullable warning in `InventoryService.cs:51`)
- **Automated Test Results:**
  - `AadhiCrackers.Domain.Tests.dll`: **9 Passed**, 0 Failed (132ms)
  - `AadhiCrackers.Application.Tests.dll`: **5 Passed**, 0 Failed (439ms)
  - `AadhiCrackers.Api.Tests.dll`: **3 Passed**, 0 Failed (103ms)
  - `AadhiCrackers.Infrastructure.Tests.dll`: **35 Passed**, 0 Failed (6.0s)
  - **Total:** **52 Passed, 0 Failed, 0 Skipped**

---

## 2. Frontend Baseline (`Aadhi_UI_live`)

- **Admin Web (`admin-web`):**
  - **Command Executed:** `npm run build` (`tsc -b && vite build`)
  - **Result:** SUCCESS (0 compilation/typecheck errors, build completed in ~925ms).
- **Customer Storefront (`customer-web`):**
  - **Command Executed:** `npm run build` (`tsc -b && vite build`)
  - **Result:** SUCCESS (0 compilation/typecheck errors, build completed in ~924ms).

---

## 3. Verified Defects to Fix

1. **FluentValidation Pipeline Bypass:** FluentValidation classes are in DI but `AddFluentValidationAutoValidation()` is missing from controller pipeline.
2. **Customer IDOR & Type Mismatch:** `OrdersController` compares `IdentityUser.Id` with `Customer.Id` and falls through if `Guid.TryParse` fails.
3. **Customer Storefront Mock Auth:** `customer-web` uses local in-memory user and does not call backend login/register APIs or attach JWT tokens.
4. **Rate Limit Rejection Logging:** `RateLimitingPolicies.cs` does not save `RateLimitLog` records on HTTP 429.
5. **Login History Metadata:** `IdentityService` omits `IpAddress` and `UserAgent` on `LoginHistory`.
6. **Search Product Ratings:** `SearchService` hardcodes `Rating = 4.8` and `ReviewCount = 86`.
7. **Storage File Upload Validation:** `LocalFileStorageService.SaveFileAsync` lacks extension allowlists.
8. **Outbox Event Dispatching:** `OutboxProcessorBackgroundService` silently ignores unhandled event types.
