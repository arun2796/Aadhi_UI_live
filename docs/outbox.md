# Transactional Outbox Pattern & Background Workers

## 1. Outbox Architecture
- Enforces reliable event delivery without dual-write inconsistencies.
- **Message Fields:**
  - `Id` (Guid)
  - `EventType` (e.g. `OrderPlaced`, `ProductCreated`, `StockAdjusted`)
  - `Payload` (JSON payload)
  - `OccurredAtUtc`
  - `ProcessedAtUtc` (nullable)
  - `RetryCount`
  - `Status` (`Pending`, `Processing`, `Processed`, `Failed`, `DeadLetter`)
  - `LastError`

## 2. Background Processor
- Background worker polls every 5 seconds for `Pending` messages.
- Dispatches messages to consumers (email notifications, indexing, analytics).
- Implements exponential backoff on transient errors:
  $$\text{Delay} = 2^{\text{RetryCount}} \times 1\text{s}$$
- Moves to `DeadLetter` status after 5 failed attempts.
