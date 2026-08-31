# Automated Testing & Quality Assurance Plan

## 1. Test Suite Architecture
- **Unit & Domain Tests (`AadhiCrackers.Domain.Tests`):**
  - Money value object arithmetic & rounding.
  - Order state machine legal and illegal transitions.
  - Stock item reservation and available inventory formulas.
  - Promotional discount and coupon threshold calculations.
- **Application & Service Tests (`AadhiCrackers.Application.Tests`):**
  - Order creation transaction integrity.
  - Stock movement ledger generation.
  - Supplier bill calculations.
- **API & Integration Tests (`AadhiCrackers.Api.Tests`):**
  - Public and protected endpoint authorization checks.
  - Rate limiting middleware responses (HTTP 429).
  - Health check endpoint verification.

## 2. Test Execution Commands
```bash
# Backend Test Suite
dotnet test Aadhi_API_live/AadhiCrackers.slnx

# Frontend Typecheck & Build
npm --prefix Aadhi_UI_live/admin-web run build
npm --prefix Aadhi_UI_live/customer-web run build
```
