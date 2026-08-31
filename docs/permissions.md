# Role-Based Access Control (RBAC) & Policy Matrix

## 1. Enterprise Roles
- `SuperAdmin`: Full platform governance, user management, hot backups, and system settings.
- `Admin`: Full operations, catalog, orders, inventory, purchases, and finance management.
- `Manager`: Storefront supervisor, order fulfillment, and stock monitoring.
- `InventoryManager`: Warehouses, physical adjustments, transfers, and low-stock alerts.
- `PurchaseManager`: Suppliers directory, purchase orders, and goods receiving inspection (GRN).
- `Accountant`: Invoices, expense ledgers, payments, and profit & loss accounting.
- `SalesExecutive`: Orders tracking, B2B quotes generation, and customer management.
- `SupportAgent`: Read-only order tracking and customer support assistance.
- `Customer`: Storefront browsing, cart checkout, order tracking, and UPI proof upload.

## 2. Policy Authorization Matrix

| Policy | Allowed Roles |
|---|---|
| `RequireSuperAdmin` | `SuperAdmin` |
| `RequireAdmin` | `SuperAdmin`, `Admin` |
| `RequireInventoryManager` | `SuperAdmin`, `Admin`, `InventoryManager` |
| `RequirePurchaseManager` | `SuperAdmin`, `Admin`, `PurchaseManager` |
| `RequireAccountant` | `SuperAdmin`, `Admin`, `Accountant` |
| `RequireSalesExecutive` | `SuperAdmin`, `Admin`, `SalesExecutive` |
| `RequireSupportAgent` | `SuperAdmin`, `Admin`, `SupportAgent` |
| `RequireStaff` | All internal staff roles |
