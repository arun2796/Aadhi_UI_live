# Enterprise Deployment & Hosting Guide

## 1. Multi-Tier Production Architecture
- **Backend API:** ASP.NET Core 10 LTS Web API running on Kestrel / Linux Docker / IIS reverse-proxied behind Nginx or Cloudflare.
- **Admin ERP Frontend:** React + Vite Single Page Application served statically on Port 5174 or subdomain (`admin.aadhicrackers.com`).
- **Customer Storefront:** React + Vite Single Page Application served statically on Port 5173 or apex domain (`aadhicrackers.com`).

## 2. Environment Variables Configuration
- Backend:
  - `ConnectionStrings__DefaultConnection`: Database connection path.
  - `JwtSettings__SecretKey`: Production HMAC-SHA256 secret (minimum 32 characters).
  - `JwtSettings__Issuer`: `AadhiCrackersApi`.
  - `JwtSettings__Audience`: `AadhiCrackersClients`.
  - `Cors__AllowedOrigins__0`: `https://admin.aadhicrackers.com`.
  - `Cors__AllowedOrigins__1`: `https://aadhicrackers.com`.
- Frontend:
  - `VITE_API_BASE_URL`: Production API gateway URL (e.g. `https://api.aadhicrackers.com/api/v1`).
