# Financial Accounting, COGS & Profit / Loss Architecture

## 1. Authoritative Formulas

$$\text{Gross Sales} - \text{Discounts} - \text{Returns} = \text{Net Revenue}$$

$$\text{Net Revenue} - \text{Cost of Goods Sold (COGS)} = \text{Gross Profit}$$

$$\text{Gross Profit} - \text{Operating Expenses} = \text{Net Operating Profit}$$

$$\text{Gross Margin \%} = \frac{\text{Gross Profit}}{\text{Net Revenue}} \times 100$$

$$\text{Net Margin \%} = \frac{\text{Net Operating Profit}}{\text{Net Revenue}} \times 100$$

## 2. Cost Basis (COGS Snapshot)
- When orders are placed, each `OrderItem` captures the snapshot cost price of goods at the time of purchase.
- Historical P&L reports never recalculate historical margins using today's volatile product cost prices.

## 3. Expense Categorization
- `Transport`, `Packaging`, `Electricity`, `Rent`, `Salary`, `Marketing`, `Warehouse`, `Office`, `Other`.
