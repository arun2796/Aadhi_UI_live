# Purchasing, Goods Receipt (GRN) & Supplier Bills

## 1. Procurement Lifecycle

```mermaid
sequenceDiagram
    participant Admin as Purchase Manager
    participant PO as Purchase Order
    participant Supplier as Factory / Vendor
    participant GRN as Goods Receipt Note
    participant Stock as Warehouse Stock
    participant Bill as Supplier Bill

    Admin->>PO: Create PO (Draft/Submitted)
    Admin->>PO: Approve PO
    Supplier->>GRN: Dispatch Fireworks Shipment
    Admin->>GRN: Inspect Delivery (Ordered, Received, Damaged, Rejected)
    GRN->>Stock: Increase Sellable Stock for Received Qty
    GRN->>Bill: Generate Supplier Bill for Verified Received Goods
```

## 2. Goods Receiving Inspection
- `quantityOrdered`: Original quantity requested on PO.
- `quantityReceived`: Verified sellable quantity added to `StockItem.QuantityOnHand`.
- `quantityRejected` / `quantityDamaged`: Logged in GRN with rejection reasons; excluded from sellable inventory.
- Generates `StockMovement` of type `Purchase`.
