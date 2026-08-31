# Enterprise Security & Compliance Architecture

## 1. Authentication & Authorization
- **HMAC-SHA256 JWT Generation**: Tokens issued by ASP.NET Identity with user claims (`Id`, `Email`, `Role`, `Permissions`).
- **Policy-Based Authorization**: Every protected endpoint enforces fine-grained policies (`RequireAdmin`, `RequireSuperAdmin`, `RequireInventoryManager`) rather than hardcoded role strings in controllers.
- **Client Route Separation**: Customer storefront and Admin ERP are completely decoupled into separate standalone frontends (`customer-web` on port 5173, `admin-web` on port 5174).

## 2. Rate Limiting Policies
Configured via `Microsoft.AspNetCore.RateLimiting`:
- `PUBLIC`: 100 requests / minute / IP
- `LOGIN`: 5 attempts / minute / IP (brute force protection)
- `PASSWORD_RESET`: 3 requests / 15 minutes / IP
- `SEARCH`: 60 queries / minute / IP
- `CART`: 60 requests / minute / customer
- `CHECKOUT`: 10 requests / minute / customer
- `ORDER_CREATE`: 10 requests / 10 minutes / customer
- `ADMIN_API`: 120 requests / minute / user
- `REPORTS`: 30 exports / minute / user

## 3. Data Protection & Sensitive Data Masking
- Passwords, access tokens, UPI credentials, and session tokens are strictly masked in all Serilog logs and JSON diff audit records.
- Input validation on all incoming DTOs using **FluentValidation** on the backend and **Zod** on the frontend.
