# Search Architecture & Elasticsearch Resilience

## 1. Primary Source of Truth vs Search Index
- **SQLite** is the authoritative source of truth for all business state.
- **Elasticsearch** serves as an asynchronous read accelerator and full-text indexing engine.

## 2. Fault-Tolerant Outbox Indexing
```mermaid
sequenceDiagram
    participant API as API Controller
    participant DB as SQLite DB
    participant Outbox as Outbox Queue
    participant Worker as Background Worker
    participant ES as Elasticsearch

    API->>DB: Mutate Product/Order (Atomic Commit)
    API->>Outbox: Enqueue Indexing Message
    Worker->>Outbox: Poll Pending Messages
    alt Elasticsearch is ONLINE
        Worker->>ES: Index Document
        Worker->>Outbox: Mark Processed
    else Elasticsearch is OFFLINE / Unreachable
        Worker->>Outbox: Increment RetryCount (Exponential Backoff)
        Note over API,DB: Primary business operations succeed uninterrupted
    end
```

## 3. Graceful Search Fallback
- If Elasticsearch is offline, `IProductSearchService` falls back gracefully to SQLite database `LIKE` / `Contains` querying so storefront customers never experience outages.
