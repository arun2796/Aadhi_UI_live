# Aadhi Crackers Core Business Rules & Invariants

## 1. Inventory & Stock Rules
- **Available Stock Formula**:
  $$\text{Available Stock} = \text{Quantity On Hand} - \text{Quantity Reserved}$$
- **Stock Reservation**: When a customer places an order, available stock is immediately reserved.
- **Stock Deduction**: Upon moving to `Packed` or `Shipped`, reserved stock is committed and quantity on hand is deducted.
- **Stock Restoration**: If an order or payment is cancelled/rejected, reserved stock is released back into available inventory.
- **Immutable Movement Ledger**: Stock cannot be modified silently. Every addition, sale, transfer, adjustment, or damage creates a new `StockMovement` entry and `AuditLog`.

## 2. Order State Machine
Valid forward transitions:
`Pending` $\rightarrow$ `Confirmed` $\rightarrow$ `Processing` $\rightarrow$ `Packed` $\rightarrow$ `Shipped` $\rightarrow$ `OutForDelivery` $\rightarrow$ `Delivered`

Allowed exceptional transitions:
- Cancellation: Allowed only from `Pending`, `Confirmed`, or `Processing`.
- Returns: Allowed only after `Delivered`.

## 3. Financial & Invoicing Invariants
- Historical invoices are immutable and preserve the original prices and tax rates at time of issuance.
- Tax is calculated at 18% GST (9% CGST + 9% SGST).
- Operating profit is calculated authoritatively on the server:
  $$\text{Net Operating Profit} = \text{Gross Revenue} - \text{Discounts} - \text{Returns} - \text{COGS} - \text{Operating Expenses}$$
