# Enterprise Audit Logging & Security Compliance

## 1. Immutable Audit Records
- Every sensitive mutation (Order status change, stock adjustment, user role update, coupon creation) writes an immutable `AuditLog` row.
- **Fields Captured:**
  - `TimestampUtc`, `UserId`, `UserName`, `Role`, `Action`, `Module`, `EntityType`, `EntityId`, `HttpMethod`, `RequestPath`, `CorrelationId`, `IpAddress`, `Severity`, `Success`, `FailureReason`, `BeforeJson`, `AfterJson`, `ChangedFieldsJson`.

## 2. Redaction & Privacy Safeguards
- Sensitive keys (`password`, `token`, `secret`, `cvv`, `authorization`) are sanitized prior to JSON serialization.
- Admin UI includes an interactive visual diff inspector comparing `beforeJson` vs `afterJson`.
