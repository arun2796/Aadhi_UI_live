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
  // Must match the backend ProductType enum (Simple = 1, Variant = 2, Bundle = 3).
  productType?: 'Simple' | 'Variant' | 'Bundle';
  primaryImageUrl?: string;
  images?: ProductImage[];
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

export interface LowStockAlert {
  id: string;
  name: string;
  productName?: string;
  sku: string;
  stockQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  primaryImageUrl?: string;
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

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export type LoginHistory = LoginHistoryItem;
export type RateLimitLog = RateLimitLogItem;
export type AuditLogDetail = AuditLog;

export interface SalesReport {
  period: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  grossProfit: number;
  salesByDate: Array<{ date: string; revenue: number; orders: number }>;
}

export interface ProfitLoss {
  fromDate?: string;
  toDate?: string;
  grossSales: number;
  totalRevenue?: number;
  discounts: number;
  returnsTotal?: number;
  netRevenue: number;
  netSales?: number;
  cogs: number;
  costOfGoodsSold?: number;
  grossProfit: number;
  grossMarginPercentage: number;
  operatingExpenses: number;
  totalExpenses?: number;
  operatingExpensesBreakdown?: {
    transport: number;
    packaging: number;
    rentAndUtilities: number;
    salaries: number;
    marketing: number;
    officeAndAdmin: number;
    total: number;
  };
  netProfit: number;
  netOperatingProfit?: number;
  netMarginPercentage: number;
  netProfitMarginPercentage?: number;
  expensesByCategory?: Array<{ category: string; amount: number }>;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  group: string;
  description?: string;
  isPublic: boolean;
  updatedAtUtc?: string;
}
