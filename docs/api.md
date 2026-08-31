# Aadhi Crackers API Contract & Endpoints Guide

## Base URL
- Production / Local Live: `http://localhost:5050/api/v1`

## Authentication
All admin and protected operations require an HTTP Bearer Header:
`Authorization: Bearer <jwt_token>`

## Global Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "errors": []
}
```

## Key API Endpoints
| HTTP Method | Route | Description | Policy Required |
|-------------|-------|-------------|-----------------|
| `GET` | `/api/v1/reports/dashboard` | Returns live KPIs and alerts | `RequireAdmin` |
| `GET` | `/api/v1/products` | Paginated product list | Public / Admin |
| `POST` | `/api/v1/products` | Create new catalog product | `RequireAdmin` |
| `GET` | `/api/v1/categories` | Hierarchical categories | Public / Admin |
| `POST` | `/api/v1/categories` | Create new category | `RequireAdmin` |
| `GET` | `/api/v1/orders` | Paginated orders ledger | `RequireAdmin` |
| `POST` | `/api/v1/orders/{id}/verify-payment` | Verify UPI payment & move to packing | `RequireAdmin` |
| `PUT` | `/api/v1/orders/{id}/status` | Move order along state machine | `RequireAdmin` |
| `GET` | `/api/v1/inventory/movements` | Immutable stock movement ledger | `RequireInventoryManager` |
| `POST` | `/api/v1/inventory/adjust` | Physical stock adjustment | `RequireInventoryManager` |
| `POST` | `/api/v1/inventory/transfer` | Warehouse stock transfer | `RequireInventoryManager` |
| `GET` | `/api/v1/purchases` | Purchase orders ledger | `RequireAdmin` |
| `GET` | `/api/v1/finance/invoices` | Tax invoices list | `RequireAdmin` |
| `GET` | `/api/v1/auditlogs` | Audit trail with JSON diffs | `RequireAdmin` |
| `GET` | `/api/v1/system-health` | Subsystem diagnostic health report | `RequireAdmin` |
