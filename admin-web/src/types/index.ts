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

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  costPrice: number;
  weightKg: number;
  stockQuantity: number;
  barcode?: string;
  isActive: boolean;
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
  productType?: 'Standard' | 'GiftBox' | 'Combo' | 'VariantProduct' | 'Accessory';
  primaryImageUrl?: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
  safetyInformation?: string;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  rating?: number;
  reviewCount?: number;
  relatedProducts?: Product[];
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
  isFeatured?: boolean;
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

export interface GiftBoxBundleItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
}

export interface GiftBox {
  id: string;
  name: string;
  sku: string;
  theme: string;
  occasion: string;
  price: number;
  mrp: number;
  itemCount: number;
  description: string;
  imageUrl: string;
  isActive: boolean;
  components: GiftBoxBundleItem[];
}

export interface ComboOffer {
  id: string;
  name: string;
  slug: string;
  normalValue: number;
  comboPrice: number;
  savings: number;
  discountPercentage: number;
  description: string;
  imageUrl: string;
  isActive: boolean;
  items: GiftBoxBundleItem[];
}

export interface ProductReview {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  rating: number;
  title?: string;
  comment: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Hidden';
  createdAtUtc: string;
}

export interface HomepageBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  targetUrl: string;
  ctaText: string;
  displayOrder: number;
  isActive: boolean;
  startDateUtc?: string;
  endDateUtc?: string;
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
  shippingCharge: number;
  grandTotal: number;
  couponCode?: string;
  notes?: string;
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

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  lifetimeValue: number;
  outstandingBalance: number;
  lastOrderDateUtc?: string;
  status: 'Active' | 'Suspended' | 'Pending';
  city?: string;
  createdAtUtc: string;
}

export interface QuoteItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  lineTotal: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  subtotal: number;
  tax: number;
  grandTotal: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted';
  expiryDateUtc: string;
  notes?: string;
  createdAtUtc: string;
  items: QuoteItem[];
}

export interface ReturnItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  reason: string;
  condition: 'Unopened' | 'Damaged' | 'Defective';
  refundAmount: number;
}

export interface ReturnRequest {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: 'Requested' | 'Approved' | 'Rejected' | 'Received' | 'Refunded' | 'Closed';
  totalRefundAmount: number;
  requestedAtUtc: string;
  items: ReturnItem[];
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
  managerName?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  isPrimary: boolean;
  totalProducts: number;
  totalStock: number;
  stockValue?: number;
}

export interface StockTransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'InTransit' | 'Received' | 'Completed' | 'Cancelled';
  reason: string;
  requestedBy: string;
  createdAtUtc: string;
  items: StockTransferItem[];
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  companyName?: string;
  contactPerson?: string;
  email?: string;
  phone: string;
  address?: string;
  gstNumber?: string;
  paymentTerms?: string;
  creditLimit?: number;
  outstandingBalance?: number;
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

export interface GoodsReceivedItem {
  productId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  receivedQty: number;
  rejectedQty: number;
  damagedQty: number;
  remarks?: string;
}

export interface GoodsReceivedNote {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string;
  warehouseName: string;
  receivedDateUtc: string;
  receivedBy: string;
  items: GoodsReceivedItem[];
}

export interface SupplierBill {
  id: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  poNumber?: string;
  subtotal: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDateUtc: string;
  status: 'Draft' | 'Issued' | 'PartiallyPaid' | 'Paid' | 'Cancelled' | 'Overdue';
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

export interface ProfitAndLossStatement {
  totalRevenue: number;
  discountsTotal: number;
  returnsTotal: number;
  netSales: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMarginPercentage: number;
  operatingExpenses: {
    transport: number;
    packaging: number;
    rentAndUtilities: number;
    salaries: number;
    marketing: number;
    officeAndAdmin: number;
    total: number;
  };
  netOperatingProfit: number;
  netProfitMarginPercentage: number;
}

export interface ReceivableItem {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  invoiceNumber: string;
  invoiceAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDateUtc: string;
  daysOverdue: number;
  status: 'Current' | 'Overdue30' | 'Overdue60' | 'Overdue90Plus';
}

export interface PayableItem {
  id: string;
  supplierId: string;
  supplierName: string;
  billNumber: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDateUtc: string;
  daysOverdue: number;
  status: 'Current' | 'Overdue30' | 'Overdue60';
}

export interface Coupon {
  id: string;
  code: string;
  name: string;
  type: 'Percentage' | 'Flat';
  value: number;
  minimumOrderAmount: number;
  maximumDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  perCustomerLimit: number;
  startDateUtc: string;
  endDateUtc: string;
  isActive: boolean;
}

export interface Promotion {
  id: string;
  title: string;
  discountPercentage: number;
  targetType: 'All' | 'Category' | 'Product' | 'Festival';
  targetValue?: string;
  startDateUtc: string;
  endDateUtc: string;
  isActive: boolean;
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
  fullName?: string;
  phone: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLoginUtc?: string;
  createdAtUtc?: string;
}

export interface LoginHistoryItem {
  id: string;
  userId?: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  timestampUtc: string;
  success: boolean;
  failureReason?: string;
}

export interface RateLimitLogItem {
  id: string;
  timestampUtc: string;
  endpoint: string;
  policy: string;
  ipAddress: string;
  userId?: string;
  requestsCount: number;
  blockedCount: number;
  reason: string;
}

export interface SystemHealthReport {
  status: 'Healthy' | 'Degraded' | 'Unhealthy';
  apiLatencyMs: number;
  database: {
    status: 'Healthy' | 'Degraded' | 'Unhealthy';
    provider: string;
    latencyMs: number;
    openConnections: number;
  };
  elasticsearch: {
    status: 'Healthy' | 'Degraded' | 'Disabled';
    clusterName?: string;
    outboxBacklogCount: number;
  };
  backgroundWorkers: {
    status: 'Running' | 'Degraded' | 'Stopped';
    activeJobsCount: number;
    lastRunUtc: string;
  };
  rateLimiter: {
    status: 'Active';
    activePoliciesCount: number;
    blockedRequestsPast24h: number;
  };
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  supportPhone: string;
  supportEmail: string;
  gstNumber: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  orderPrefix: string;
  invoicePrefix: string;
  minOrderAmount: number;
  freeShippingThreshold: number;
  standardShippingFee: number;
  cancellationWindowHours: number;
  upiId: string;
  upiQrCodeUrl: string;
  allowCashOnDelivery: boolean;
  allowUpiPayments: boolean;
  lowStockThresholdDefault: number;
}
