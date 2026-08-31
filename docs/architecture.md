# Aadhi Crackers Enterprise Architecture Document

## Overview
**Aadhi Crackers ERP** is a high-performance modular monolith built with **.NET 10 LTS (C#)** on the backend and **React 19 + TypeScript + Vite + Tailwind CSS** on the frontend.

## Architecture Diagram
```
Frontend (React 19 + TypeScript + Vite + Tailwind CSS + Lucide + Recharts)
    │
    ▼ (HTTP JSON REST / JWT Bearer / X-Correlation-ID)
ASP.NET Core 10 Web API
    ├── Rate Limiting Middleware (9 Granular Policies)
    ├── Authentication & Authorization Policies (Claims-based)
    ├── Serilog Structured Logging & Correlation Enrichment
    └── RFC ProblemDetails Error Formatter
    │
    ▼
Application Layer
    ├── Commands, Queries & Business Logic
    ├── FluentValidation Pipeline
    ├── Outbox Pattern Event Dispatcher
    └── Service Interfaces (ICatalogService, IOrderService, IInventoryService, etc.)
    │
    ▼
Domain Layer
    ├── Entities (Product, Category, Order, StockMovement, Supplier, etc.)
    ├── Enums & Value Objects (Money, Address, OrderStatus, PaymentStatus)
    └── Business State Machines & Invariant Validation
    │
    ▼
Infrastructure Layer
    ├── EF Core SQLite Provider (PostgreSQL Migration-Ready)
    ├── ASP.NET Core Identity (HMAC-SHA256 JWT Generator)
    ├── AuditLog Persistence (Append-Only with JSON Diffs)
    └── System Health Checks & Background Jobs
```

## Key Technical Decisions
1. **Integer Minor Unit Representation for Currency**: Financial values are stored as integers/exact decimals (INR minor units) to avoid IEEE 754 floating-point inaccuracies.
2. **Deterministic Server-Side Calculation**: Frontend never performs critical financial calculations. Prices, discounts, GST tax (18%), and delivery charges are calculated authoritatively by the .NET backend.
3. **Outbox Pattern for External Integrations**: All asynchronous operations (audit search indexing, email alerts, background reports) utilize an outbox queue to guarantee transactional consistency even if external network dependencies fail.
