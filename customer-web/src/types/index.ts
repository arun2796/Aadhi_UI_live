export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'OutForDelivery'
  | 'Delivered'
  | 'Cancelled'
  | 'Returned';

export type PaymentStatus =
  | 'Pending'
  | 'Authorized'
  | 'Paid'
  | 'Failed'
  | 'RefundPending'
  | 'Refunded'
  | 'Cancelled';

export type PaymentMethod =
  | 'Cash'
  | 'UPI'
  | 'CreditCard'
  | 'DebitCard'
  | 'NetBanking'
  | 'Wallet'
  | 'BankTransfer'
  | 'COD';

export type FulfillmentStatus =
  | 'Unfulfilled'
  | 'PartiallyPacked'
  | 'Packed'
  | 'Shipped'
  | 'Delivered'
  | 'Returned';

export type StockMovementType =
  | 'OpeningStock'
  | 'Purchase'
  | 'Sale'
  | 'Return'
  | 'Adjustment'
  | 'TransferIn'
  | 'TransferOut'
  | 'Damage';

export type InvoiceStatus =
  | 'Draft'
  | 'Issued'
  | 'PartiallyPaid'
  | 'Paid'
  | 'Cancelled'
  | 'Overdue';

export type ExpenseCategory =
  | 'Transport'
  | 'Packaging'
  | 'Electricity'
  | 'Rent'
  | 'Salary'
  | 'Marketing'
  | 'Warehouse'
  | 'Office'
  | 'Other';

export interface ProductImage {
  id: string;
  url: string;
  altText?: string;
  sortOrder: number;
  isPrimary: boolean;
}

/** One component product inside a combo / gift box (ProductDetailDto.comboItems).
 *  Optional everywhere on the storefront — the API may not expose it yet. */
export interface ComboItem {
  componentProductId: string;
  productName: string;
  sku: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  categoryId: string;
  categoryName: string;
  brandId?: string;
  brandName?: string;
  price: number;
  compareAtPrice?: number;
  costPrice: number;
  taxRate: number;
  discountType: string;
  discountValue: number;
  discountPercentage?: number;
  stockQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  unit: string;
  weightKg: number;
  isActive: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  primaryImageUrl?: string;
  images?: ProductImage[];
  safetyInformation?: string;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  rating?: number;
  reviewCount?: number;
  relatedProducts?: Product[];
  /** ProductDto.isCombo — true when this product is a combo / gift box. */
  isCombo?: boolean;
  /** ProductDto.comboItemCount — how many component products the combo contains. */
  comboItemCount?: number;
  /** ProductDetailDto.comboItems — the component products, detail endpoint only. */
  comboItems?: ComboItem[];
  /** ProductDetailDto.comboItemsTotal — sum of the component line totals. */
  comboItemsTotal?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentCategoryId?: string;
  parentCategoryName?: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
  subCategories?: Category[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  productCount: number;
}

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  imageUrl?: string;
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
  maxStock: number;
  lineTotal: number;
}

export interface Address {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface OrderStatusHistory {
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  reason?: string;
  changedBy?: string;
  changedAtUtc: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  fulfillmentStatus: FulfillmentStatus;
  itemsSubtotal: number;
  discount: number;
  tax: number;
  /** Server-calculated packing charges (₹) for this order. */
  packingCharges?: number;
  /** Percentage the server used to calculate `packingCharges`. */
  packingChargePercent?: number;
  grandTotal: number;
  couponCode?: string;
  notes?: string;
  /** Delivery method code; 'transport' is the only method the store offers. */
  deliveryMethod?: string;
  /** Human-readable delivery method name supplied by the API. */
  deliveryMethodName?: string;
  /** Transport company / parcel service the parcel was handed to. */
  carrierName?: string;
  /** LR / waybill number used to collect the parcel. */
  trackingNumber?: string;
  placedAtUtc: string;
  utrNumber?: string;
  paymentScreenshotUrl?: string;
  paymentSubmittedAtUtc?: string;
  paymentVerifiedAtUtc?: string;
  paymentVerifiedBy?: string;
  paymentVerificationNotes?: string;
  shippingAddress: Address;
  items: OrderItem[];
  statusHistories: OrderStatusHistory[];
}

export interface StockItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl?: string;
  warehouseId: string;
  warehouseName: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderLevel: number;
  status: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  movementType: StockMovementType;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType: string;
  referenceId?: string;
  reason: string;
  createdBy?: string;
  createdAtUtc: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  isPrimary: boolean;
  totalProducts: number;
  totalStock: number;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone: string;
  address?: string;
  gstNumber?: string;
  isActive: boolean;
  totalPurchaseOrders: number;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantityOrdered: number;
  quantityReceived: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'PartiallyReceived' | 'Received' | 'Cancelled';
  subtotal: number;
  tax: number;
  grandTotal: number;
  orderDateUtc: string;
  expectedDeliveryDateUtc?: string;
  notes?: string;
  items: PurchaseOrderItem[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  issuedAtUtc: string;
  dueDateUtc: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  orderId?: string;
  orderNumber?: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionReference?: string;
  notes?: string;
  paidAtUtc: string;
}

export interface Expense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  tax: number;
  paymentMethod: PaymentMethod;
  expenseDateUtc: string;
  reference?: string;
  createdBy?: string;
}

export interface DashboardKpis {
  totalSales: number;
  salesChangePercentage: string;
  totalOrders: number;
  ordersChangePercentage: string;
  totalCustomers: number;
  customersChangePercentage: string;
  totalProfit: number;
  profitChangePercentage: string;
  lowStockItems: number;
  pendingOrders: number;
  stockValue: number;
  outstandingAmount: number;
  outstandingInvoicesCount: number;
  todaySales: number;
  todayOrders: number;
  bestSellingBrand: string;
  bestSellingBrandShare: number;
}

export interface SalesTrendPoint {
  date: string;
  sales: number;
  orders: number;
}

export interface CategorySales {
  categoryName: string;
  revenue: number;
  percentage: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  imageUrl?: string;
  unitsSold: number;
  revenue: number;
}

export interface PaymentMethodReport {
  method: string;
  totalAmount: number;
  percentage: number;
}

export interface AuditLog {
  id: string;
  timestampUtc: string;
  userId?: string;
  userName?: string;
  role?: string;
  action: string;
  actionName: string;
  module: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  httpMethod: string;
  requestPath: string;
  correlationId: string;
  traceId?: string;
  ipAddress?: string;
  severity: 'Info' | 'Warning' | 'Error' | 'Critical';
  success: boolean;
  failureReason?: string;
  beforeJson?: string;
  afterJson?: string;
  changedFieldsJson?: string;
  metadataJson?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  permissions: string[];
  isActive: boolean;
}
