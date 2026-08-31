# Database Schema & Entity Relationships Document

## Database Technology
- **Primary Engine**: SQLite 3 (configured with Write-Ahead Logging `WAL` mode for high-throughput concurrent reads and serialized writes).
- **PostgreSQL Migration Readiness**: Clean EF Core configuration with zero database-engine-specific SQL queries.

## Core Entity Relationships

```
Categories (1) ───< Products (N)
                      │
                      ├───< ProductImages (N)
                      ├───< ProductVariants (N)
                      └───< OrderItems (N) >─── Orders (1)
                                                  │
                                                  ├───< OrderStatusHistories (N)
                                                  ├───< Payments (1..N)
                                                  └───< Invoices (1)

Warehouses (1) ───< StockMovements (N) >─── Products (1)

Suppliers (1) ───< PurchaseOrders (1) ───< PurchaseOrderItems (N)
                      │
                      ├───< GoodsReceivedNotes (1)
                      └───< SupplierBills (1)
```

## Immutable Audit Trail
- Table: `AuditLogs`
- Columns: `Id`, `TimestampUtc`, `UserId`, `UserName`, `Role`, `Action`, `Module`, `EntityType`, `EntityId`, `HttpMethod`, `RequestPath`, `CorrelationId`, `Severity`, `Success`, `BeforeJson`, `AfterJson`, `ChangedFieldsJson`, `MetadataJson`.
- Strict append-only policy with zero update or delete privileges for application users.
