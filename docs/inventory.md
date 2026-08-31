# Inventory, Warehouse & Stock Ledger Architecture

## 1. Authoritative Inventory Source: `StockItem`
- `StockItem` represents warehouse-specific inventory state.
- **Formula for Available Stock:**
  $$\text{QuantityAvailable} = \text{QuantityOnHand} - \text{QuantityReserved}$$
- Never permit negative available inventory ($\text{Stock} < 0$).

## 2. Stock Reservation Lifecycle
1. **Checkout / Order Placement:**
   - Validate that $\text{QuantityAvailable} \ge \text{RequestedQuantity}$.
   - Atomically increment `QuantityReserved += requestedQty`.
   - Record `StockMovement` with type `StockReserved`.
2. **Order Cancellation:**
   - Decrement `QuantityReserved -= requestedQty`.
   - Record `StockMovement` with type `StockReservationReleased`.
3. **Order Shipment / Fulfillment:**
   - Decrement `QuantityOnHand -= requestedQty` and `QuantityReserved -= requestedQty`.
   - Record `StockMovement` with type `Sale`.

## 3. Stock Movement Ledger Types
- `OpeningStock`
- `Purchase` (via Goods Receipt Note)
- `Sale`
- `StockReserved`
- `StockReservationReleased`
- `Return` (Sellable vs Damaged)
- `Damage`
- `Adjustment` (Physical inventory count correction)
- `TransferIn` / `TransferOut` (Inter-warehouse transfers)

## 4. Concurrency Protection
- Enforced via EF Core optimistic concurrency tokens and database transactions during multi-line checkout.
