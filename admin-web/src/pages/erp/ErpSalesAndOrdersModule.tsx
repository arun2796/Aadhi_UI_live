import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  Printer,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Check,
  Clock,
  ArrowLeft,
  Filter,
  Plus
} from 'lucide-react';
import { Order, Customer, Invoice, Payment, OrderStatus, OrderStatusHistory } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import { orderApi } from '../../services/orderApi';
import { customerApi, CustomerDetail } from '../../services/customerApi';
import { useToast } from '../../context/ToastContext';
import { Pagination } from '../../components/common/Pagination';
import { StatusBadge } from '../../components/common/CommonComponents';
import { ErpConfirmDialog } from './ErpConfirmDialog';

type SalesSubTab = 'orders' | 'customers' | 'invoices' | 'payments';

interface ErpSalesAndOrdersModuleProps {
  initialSubTab?: SalesSubTab;
  initialSelectedOrderId?: string;
  initialSelectedCustomerId?: string;
}

/** Each sidebar item is its own screen — per-screen page title/subtitle shown instead of the old
    shared "Sales & Order Fulfillment" header + cross-screen pill tab bar. The header follows the
    currently shown section, so programmatic cross-navigation (e.g. an order opening customer detail) updates it too. */
const SCREEN_HEADERS: Record<SalesSubTab, { title: string; subtitle: string }> = {
  orders: { title: 'Orders', subtitle: 'Manage and fulfil customer orders.' },
  customers: { title: 'Customers', subtitle: 'Customer directory and purchase history.' },
  invoices: { title: 'Tax Invoices', subtitle: 'GST tax invoices issued for customer orders.' },
  payments: { title: 'Payments', subtitle: 'Payment records and verification.' }
};

const PAGE_SIZE = 10;

type OrderStatusTab = 'all' | 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'confirm';
type PaymentTab = 'all' | 'Received' | 'Pending';

/** Valid next statuses per current status — mirrors Order.CanTransitionTo on the backend,
    so only transitions the API will accept are offered (prevents 409 Conflict). */
const NEXT_TRANSITIONS: Record<string, OrderStatus[]> = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Processing', 'Cancelled'],
  Processing: ['Packed', 'Cancelled'],
  Packed: ['Shipped', 'Cancelled'],
  Shipped: ['OutForDelivery', 'Delivered'],
  OutForDelivery: ['Delivered'],
  Delivered: [],
  Cancelled: []
};

/** Client-side list filters shared by the Filters popovers (design: every list page has one). */
interface ListFilterState {
  method: string; // 'all' | 'UPI' | 'COD'
  fromDate: string;
  toDate: string;
}

const EMPTY_LIST_FILTERS: ListFilterState = { method: 'all', fromDate: '', toDate: '' };

const matchesDateRange = (iso: string | undefined, f: ListFilterState): boolean => {
  if (!f.fromDate && !f.toDate) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (f.fromDate && t < new Date(f.fromDate).getTime()) return false;
  if (f.toDate) {
    const end = new Date(f.toDate);
    end.setHours(23, 59, 59, 999);
    if (t > end.getTime()) return false;
  }
  return true;
};

/** Outline "Filters" button + simple popover (payment method + date range, client-side). */
const FiltersButton: React.FC<{
  filters: ListFilterState;
  onChange: (f: ListFilterState) => void;
  showMethod?: boolean;
}> = ({ filters, onChange, showMethod = true }) => {
  const [open, setOpen] = useState(false);
  const isActive = (showMethod && filters.method !== 'all') || !!filters.fromDate || !!filters.toDate;
  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold shadow-2xs transition-colors ${
          isActive
            ? 'border-purple bg-purple/5 text-purple'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Filter className="w-3.5 h-3.5" />
        <span>Filters</span>
        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-purple" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 space-y-3 text-xs">
            {showMethod && (
              <div>
                <label className="font-bold text-slate-500">Payment Method</label>
                <select
                  value={filters.method}
                  onChange={(e) => onChange({ ...filters, method: e.target.value })}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-navy font-bold outline-none"
                >
                  <option value="all">All Methods</option>
                  <option value="UPI">UPI</option>
                  <option value="COD">COD</option>
                </select>
              </div>
            )}
            <div>
              <label className="font-bold text-slate-500">From Date</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => onChange({ ...filters, fromDate: e.target.value })}
                className="w-full mt-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-500">To Date</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => onChange({ ...filters, toDate: e.target.value })}
                className="w-full mt-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none"
              />
            </div>
            <div className="pt-1 flex items-center justify-between">
              <button
                onClick={() => onChange(EMPTY_LIST_FILTERS)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold shadow-xs"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const formatINR = (n?: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    : '—';

/** Payment column label per design 02: Paid | COD | Refunded (falls back to raw payment status). */
const paymentLabel = (o: Order) =>
  o.paymentStatus === 'Refunded' || o.paymentStatus === 'RefundPending'
    ? 'Refunded'
    : o.paymentStatus === 'Paid'
    ? 'Paid'
    : o.paymentMethod === 'COD'
    ? 'COD'
    : o.paymentStatus;

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<string, string>)[c]
  );

/** Clean printable HTML invoice for an order — opened in a new window, then window.print()
    (mirrors the customer-web invoice pattern). */
const buildOrderInvoiceHtml = (o: Order): string => {
  const rows = (o.items || [])
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(it.productName)}</td>
        <td class="num">${it.quantity}</td>
        <td class="num">${formatINR(it.unitPrice)}</td>
        <td class="num">${formatINR(it.lineTotal)}</td>
      </tr>`
    )
    .join('');

  const addr = o.shippingAddress;
  const addressLines = addr
    ? [addr.addressLine1, addr.addressLine2, [addr.city, addr.state].filter(Boolean).join(', '), addr.postalCode]
        .filter(Boolean)
        .map((l) => escapeHtml(l))
        .join('<br />')
    : '&mdash;';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${escapeHtml(o.orderNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 36px; font-size: 13px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4F2ACB; padding-bottom: 16px; }
  .brand { font-size: 24px; font-weight: 800; color: #111238; letter-spacing: 1px; }
  .brand small { display: block; font-size: 10px; color: #64748b; font-weight: 600; letter-spacing: 2px; margin-top: 4px; }
  .inv-label { text-align: right; }
  .inv-label h2 { margin: 0; color: #4F2ACB; font-size: 20px; letter-spacing: 3px; }
  .inv-label div { margin-top: 6px; color: #64748b; }
  .meta { display: flex; justify-content: space-between; margin: 20px 0; gap: 24px; }
  .meta div { line-height: 1.8; }
  .label { color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #111238; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 12px; }
  th.num { text-align: right; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin-top: 16px; margin-left: auto; width: 280px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #111238; margin-top: 6px; padding-top: 8px; font-weight: 800; font-size: 15px; color: #111238; }
  .discount { color: #059669; }
  .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 14px; line-height: 1.7; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">AADHI CRACKERS<small>PREMIUM SIVAKASI FIREWORKS &middot; TAX INVOICE</small></div>
    <div class="inv-label">
      <h2>INVOICE</h2>
      <div>${escapeHtml(o.orderNumber || '—')}</div>
    </div>
  </div>
  <div class="meta">
    <div>
      <div class="label">Billed To</div>
      <div><strong>${escapeHtml(o.customerName)}</strong></div>
      <div>${addressLines}</div>
      <div>Ph. ${escapeHtml(o.customerPhone || '—')}</div>
    </div>
    <div>
      <div><span class="label">Order No:</span> <strong>${escapeHtml(o.orderNumber || '—')}</strong></div>
      <div><span class="label">Order Date:</span> ${escapeHtml(formatDate(o.placedAtUtc))}</div>
      <div><span class="label">Payment Method:</span> ${escapeHtml(o.paymentMethod)}</div>
      <div><span class="label">Payment Status:</span> ${escapeHtml(o.paymentStatus)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:32px;">#</th>
        <th>Item</th>
        <th class="num">Qty</th>
        <th class="num">Unit Price</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">No item details available</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatINR(o.itemsSubtotal)}</span></div>
    <div class="row"><span>Discount</span><span class="discount">${o.discount > 0 ? '-' + formatINR(o.discount) : formatINR(0)}</span></div>
    ${o.tax > 0 ? `<div class="row"><span>Tax (GST)</span><span>${formatINR(o.tax)}</span></div>` : ''}
    <div class="row"><span>Delivery Charges</span><span>${formatINR(o.shippingCharge)}</span></div>
    <div class="row grand"><span>Total Amount</span><span>${formatINR(o.grandTotal)}</span></div>
  </div>
  <div class="footer">
    This is a computer-generated invoice from AADHI CRACKERS and does not require a signature.<br />
    GSTIN: 33ABCDE1234F1Z5 &middot; Sivakasi, Tamil Nadu
  </div>
</body>
</html>`;
};

/** Payments status pill per design 15: Paid green, Pending amber, Refunded orange. */
const PaymentStatusPill: React.FC<{ status: string }> = ({ status }) => {
  const cls =
    status === 'Paid'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : status === 'Pending' || status === 'Authorized'
      ? 'bg-amber-50 text-amber-700 border border-amber-200'
      : status === 'Refunded' || status === 'RefundPending' || status === 'Completed'
      ? 'bg-orange-50 text-orange-600 border border-orange-200'
      : status === 'Failed' || status === 'Cancelled'
      ? 'bg-red-50 text-red-700 border border-red-200'
      : 'bg-slate-50 text-slate-600 border border-slate-200';
  const label = status === 'RefundPending' ? 'Refunded' : status === 'Completed' ? 'Refunded' : status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{label}</span>
  );
};

/** Maps granular fulfillment statuses onto the design's timeline/tab buckets. */
const STATUS_RANK: Record<string, number> = {
  Pending: 0,
  Confirmed: 1,
  Processing: 2,
  Packed: 2,
  Shipped: 3,
  OutForDelivery: 3,
  Delivered: 4
};

interface TimelineStep {
  label: string;
  timestamp?: string;
  done: boolean;
}

const buildTimeline = (order: Order): { steps: TimelineStep[]; cancelled?: OrderStatusHistory } => {
  const histories = order.statusHistories || [];
  const findTime = (statuses: OrderStatus[]) =>
    histories.find((h) => statuses.includes(h.toStatus))?.changedAtUtc;

  let currentRank = STATUS_RANK[order.orderStatus];
  if (currentRank === undefined) {
    // Cancelled / Returned — show progress reached before the terminal state
    currentRank = histories.reduce((max, h) => Math.max(max, STATUS_RANK[h.toStatus] ?? 0), 0);
  }

  const steps: TimelineStep[] = [
    { label: 'Order Placed', timestamp: order.placedAtUtc, done: true },
    { label: 'Confirmed', timestamp: findTime(['Confirmed']), done: currentRank >= 1 },
    { label: 'Processing', timestamp: findTime(['Processing', 'Packed']), done: currentRank >= 2 },
    { label: 'Shipped', timestamp: findTime(['Shipped', 'OutForDelivery']), done: currentRank >= 3 },
    { label: 'Delivered', timestamp: findTime(['Delivered']), done: currentRank >= 4 }
  ];

  const cancelled =
    order.orderStatus === 'Cancelled'
      ? histories.find((h) => h.toStatus === 'Cancelled') || {
          fromStatus: 'Pending' as OrderStatus,
          toStatus: 'Cancelled' as OrderStatus,
          changedAtUtc: ''
        }
      : undefined;

  return { steps, cancelled };
};

export const ErpSalesAndOrdersModule: React.FC<ErpSalesAndOrdersModuleProps> = ({
  initialSubTab = 'orders',
  initialSelectedOrderId,
  initialSelectedCustomerId
}) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const routeParams = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [subTab, setSubTab] = useState<SalesSubTab>(initialSubTab);

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  // ORDERS — list filters + detail
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusTab, setOrderStatusTab] = useState<OrderStatusTab>('all');
  const [orderPage, setOrderPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [utrInput, setUtrInput] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectPaymentTarget, setRejectPaymentTarget] = useState<Order | null>(null);
  const [orderFilters, setOrderFilters] = useState<ListFilterState>(EMPTY_LIST_FILTERS);
  const [statusDraft, setStatusDraft] = useState<OrderStatus | ''>('');
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null);
  // Order Confirm queue sub-filter chips (design 06 split)
  const [confirmChip, setConfirmChip] = useState<'pending' | 'confirmed' | 'rejected'>('pending');

  // CUSTOMERS — list + detail
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // PAYMENTS — tabs, search, filters (design 15)
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentTab, setPaymentTab] = useState<PaymentTab>('all');
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentFilters, setPaymentFilters] = useState<ListFilterState>(EMPTY_LIST_FILTERS);

  // Selected Invoice for Printable View Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ords, custs, invs, pays] = await Promise.all([
        api.getOrders({ pageSize: 200 }),
        api.getCustomers({ pageSize: 200 }),
        api.getInvoices(),
        api.getPayments()
      ]);
      setOrders(ords);
      setCustomers(custs);
      setInvoices(invs);
      setPayments(pays);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load sales data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Each sidebar item is its own screen: when the route swaps the initialSubTab prop on this
  // already-mounted component, follow it and land on that screen's list view (clearing detail
  // views that belong to OTHER screens — deep-linked details of the target screen are opened
  // by their own effects below).
  useEffect(() => {
    setSubTab(initialSubTab);
    if (initialSubTab !== 'orders') setSelectedOrder(null);
    if (initialSubTab !== 'customers') {
      setSelectedCustomer(null);
      setCustomerOrders([]);
    }
  }, [initialSubTab]);

  // ?tab=confirm deep link (sidebar "Order Confirm") — reacts to in-app navigation too
  useEffect(() => {
    if (searchParams.get('tab') === 'confirm') {
      setSubTab('orders');
      setOrderStatusTab('confirm');
      setConfirmChip('pending');
      setSelectedOrder(null);
    } else {
      setOrderStatusTab((prev) => (prev === 'confirm' ? 'all' : prev));
    }
  }, [searchParams]);

  // /admin/orders/:id deep link — open the order detail directly
  useEffect(() => {
    if (initialSelectedOrderId) {
      openOrderById(initialSelectedOrderId);
    }
  }, [initialSelectedOrderId]);

  // /admin/customers/:id deep link — open the customer detail directly
  const routeCustomerId = initialSelectedCustomerId ?? (initialSubTab === 'customers' ? routeParams.id : undefined);
  useEffect(() => {
    if (routeCustomerId) {
      openCustomer(routeCustomerId);
    }
  }, [routeCustomerId]);

  // Reset pagination when filters change
  useEffect(() => {
    setOrderPage(1);
  }, [searchQuery, orderStatusTab, orderFilters]);
  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch]);
  useEffect(() => {
    setPaymentPage(1);
  }, [paymentSearch, paymentTab, paymentFilters]);

  // Reset the status-dropdown draft whenever a different order (or a new status) is shown
  useEffect(() => {
    setStatusDraft('');
  }, [selectedOrder?.id, selectedOrder?.orderStatus]);

  // ===================== ORDERS: derived data =====================

  const matchesOrderSearch = (o: Order) =>
    o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.customerPhone || '').includes(searchQuery);

  const matchesStatusTab = (o: Order, tab: OrderStatusTab) => {
    switch (tab) {
      case 'all':
      case 'confirm':
        return true;
      case 'Processing':
        return o.orderStatus === 'Processing' || o.orderStatus === 'Packed';
      case 'Shipped':
        return o.orderStatus === 'Shipped' || o.orderStatus === 'OutForDelivery';
      default:
        return o.orderStatus === tab;
    }
  };

  const matchesOrderFilters = (o: Order) =>
    (orderFilters.method === 'all' || o.paymentMethod === orderFilters.method) &&
    matchesDateRange(o.placedAtUtc, orderFilters);

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesOrderSearch(o) && matchesStatusTab(o, orderStatusTab) && matchesOrderFilters(o)),
    [orders, searchQuery, orderStatusTab, orderFilters]
  );

  const pagedOrders = filteredOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);

  /** Orders awaiting payment verification / confirmation (design 06). */
  const awaitingConfirmation = useMemo(
    () => orders.filter((o) => o.orderStatus === 'Pending' && o.paymentStatus !== 'Paid' && matchesOrderSearch(o)),
    [orders, searchQuery]
  );

  /** Confirm queue chip: orders whose payment was verified (paymentStatus Paid), most recent first. */
  const verifiedPaymentOrders = useMemo(
    () =>
      orders
        .filter((o) => o.paymentStatus === 'Paid' && matchesOrderSearch(o))
        .sort(
          (a, b) =>
            new Date(b.paymentVerifiedAtUtc || b.placedAtUtc).getTime() -
            new Date(a.paymentVerifiedAtUtc || a.placedAtUtc).getTime()
        ),
    [orders, searchQuery]
  );

  /** Confirm queue chip: cancelled orders whose payment was rejected / never verified, most recent first. */
  const rejectedPaymentOrders = useMemo(
    () =>
      orders
        .filter((o) => o.orderStatus === 'Cancelled' && o.paymentStatus !== 'Paid' && matchesOrderSearch(o))
        .sort((a, b) => new Date(b.placedAtUtc).getTime() - new Date(a.placedAtUtc).getTime()),
    [orders, searchQuery]
  );

  const confirmQueueOrders =
    confirmChip === 'pending'
      ? awaitingConfirmation
      : confirmChip === 'confirmed'
      ? verifiedPaymentOrders
      : rejectedPaymentOrders;

  const orderTabs: { id: OrderStatusTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Orders', count: orders.length },
    { id: 'Pending', label: 'Pending', count: orders.filter((o) => o.orderStatus === 'Pending').length },
    { id: 'Confirmed', label: 'Confirmed', count: orders.filter((o) => o.orderStatus === 'Confirmed').length },
    { id: 'Processing', label: 'Processing', count: orders.filter((o) => matchesStatusTab(o, 'Processing') && o.orderStatus !== 'Pending').length },
    { id: 'Shipped', label: 'Shipped', count: orders.filter((o) => o.orderStatus === 'Shipped' || o.orderStatus === 'OutForDelivery').length },
    { id: 'Delivered', label: 'Delivered', count: orders.filter((o) => o.orderStatus === 'Delivered').length },
    { id: 'Cancelled', label: 'Cancelled', count: orders.filter((o) => o.orderStatus === 'Cancelled').length },
    {
      id: 'confirm',
      label: 'Order Confirm',
      count: orders.filter((o) => o.orderStatus === 'Pending' && o.paymentStatus !== 'Paid').length
    }
  ];

  // ===================== CUSTOMERS: derived data =====================

  const filteredCustomers = useMemo(
    () =>
      customers.filter((c) => {
        const q = customerSearch.toLowerCase();
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(customerSearch)
        );
      }),
    [customers, customerSearch]
  );

  const pagedCustomers = filteredCustomers.slice((customerPage - 1) * PAGE_SIZE, customerPage * PAGE_SIZE);

  // ===================== PAYMENTS: derived data (design 15) =====================

  const filteredPayments = useMemo(
    () =>
      payments.filter((p) => {
        const q = paymentSearch.toLowerCase();
        const matchesSearch =
          (p.paymentNumber || '').toLowerCase().includes(q) ||
          (p.orderNumber || '').toLowerCase().includes(q) ||
          (p.customerName || '').toLowerCase().includes(q);
        const matchesTab =
          paymentTab === 'all' ||
          (paymentTab === 'Received' && p.paymentStatus === 'Paid') ||
          (paymentTab === 'Pending' && (p.paymentStatus === 'Pending' || p.paymentStatus === 'Authorized'));
        const matchesFilters =
          (paymentFilters.method === 'all' || p.paymentMethod === paymentFilters.method) &&
          matchesDateRange(p.paidAtUtc, paymentFilters);
        return matchesSearch && matchesTab && matchesFilters;
      }),
    [payments, paymentSearch, paymentTab, paymentFilters]
  );

  const pagedPayments = filteredPayments.slice((paymentPage - 1) * PAGE_SIZE, paymentPage * PAGE_SIZE);

  const paymentTabs: { id: PaymentTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: payments.length },
    { id: 'Received', label: 'Received', count: payments.filter((p) => p.paymentStatus === 'Paid').length },
    {
      id: 'Pending',
      label: 'Pending',
      count: payments.filter((p) => p.paymentStatus === 'Pending' || p.paymentStatus === 'Authorized').length
    }
  ];

  // ===================== Handlers =====================

  /** Print Invoice (design 03) — opens a clean invoice window and triggers window.print(). */
  const handlePrintInvoice = (order: Order) => {
    const w = window.open('', '_blank', 'width=820,height=940');
    if (!w) {
      showToast('Please allow pop-ups to print the invoice.', 'warning');
      return;
    }
    w.document.write(buildOrderInvoiceHtml(order));
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {
        /* the opened window can be printed manually */
      }
    }, 400);
  };

  /** Add Customer (design 08) — POST /customers with { firstName, lastName, phone, email }. */
  const handleCreateCustomer = async () => {
    const name = newCustomer.name.trim();
    const phone = newCustomer.phone.trim();
    if (!name || !phone) {
      showToast('Customer name and phone are required', 'warning');
      return;
    }
    const [firstName, ...rest] = name.split(/\s+/);
    setIsSavingCustomer(true);
    try {
      await customerApi.createCustomer({
        firstName,
        lastName: rest.join(' '),
        phone,
        email: newCustomer.email.trim()
      });
      showToast(`Customer "${name}" created`, 'success');
      setShowAddCustomer(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      loadData();
    } catch {
      showToast('Could not create customer', 'error');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const openOrder = (o: Order) => {
    setSelectedOrder(o);
    setUtrInput(o.utrNumber || '');
    setVerificationNotes('');
    // Hydrate with the full detail (items, status history) in the background
    api
      .getOrderById(o.id)
      .then((full) => {
        if (full) {
          setSelectedOrder((prev) => (prev && prev.id === o.id ? full : prev));
          setUtrInput(full.utrNumber || '');
        }
      })
      .catch(() => {});
  };

  const openOrderById = async (id: string) => {
    try {
      const full = await api.getOrderById(id);
      if (full) {
        setSubTab('orders');
        setSelectedOrder(full);
        setUtrInput(full.utrNumber || '');
        setVerificationNotes('');
      } else {
        showToast('Order not found', 'warning');
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load order details', 'error');
    }
  };

  const closeOrderDetail = () => {
    setSelectedOrder(null);
    if (initialSelectedOrderId) {
      navigate('/admin/orders');
    }
  };

  const openCustomer = async (id: string) => {
    setSubTab('customers');
    setIsCustomerLoading(true);
    try {
      const [profileRes, ordersRes] = await Promise.allSettled([
        customerApi.getCustomerById(id),
        customerApi.getCustomerOrders(id)
      ]);
      if (profileRes.status === 'fulfilled' && profileRes.value) {
        setSelectedCustomer(profileRes.value);
      } else {
        throw profileRes.status === 'rejected' ? profileRes.reason : new Error('Customer not found');
      }
      setCustomerOrders(ordersRes.status === 'fulfilled' ? ordersRes.value : []);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load customer profile', 'error');
    } finally {
      setIsCustomerLoading(false);
    }
  };

  const closeCustomerDetail = () => {
    setSelectedCustomer(null);
    setCustomerOrders([]);
    if (routeCustomerId) {
      navigate('/admin/customers');
    }
  };

  // Handle Order Status Transition
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const updated = await api.updateOrderStatus(orderId, newStatus, `Updated via Admin ERP to ${newStatus}`);
      showToast(`Order status updated to ${newStatus}`, 'success');
      if (updated) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(updated);
        }
      } else {
        loadData();
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Status transition failed', 'error');
    }
  };

  // Handle Verify Payment & Move to Packing (order detail view)
  const handleConfirmPayment = async () => {
    if (!selectedOrder) return;
    try {
      const updated = await api.verifyPayment(selectedOrder.id, {
        verifiedUtrNumber: utrInput || selectedOrder.utrNumber || 'MANUAL-CONFIRM',
        verificationNotes: verificationNotes || 'UPI payment confirmed by Admin',
        autoMoveToPacking: true
      });
      showToast('Payment verified & Order moved to Packing screen!', 'success');
      setSelectedOrder(updated);
      loadData();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Payment verification failed', 'error');
    }
  };

  // Verify & Confirm from the Order Confirm queue (design 06)
  const handleQueueVerify = async (order: Order) => {
    try {
      if (order.paymentMethod === 'COD') {
        const updated = await api.updateOrderStatus(order.id, 'Confirmed', 'COD order confirmed via Order Confirm queue');
        if (updated) {
          setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        } else {
          loadData();
        }
        showToast(`Order ${order.orderNumber} confirmed`, 'success');
      } else {
        await api.verifyPayment(order.id, {
          verifiedUtrNumber: order.utrNumber || 'MANUAL-CONFIRM',
          verificationNotes: 'UPI payment confirmed by Admin',
          autoMoveToPacking: true
        });
        showToast(`Payment verified — ${order.orderNumber} moved to Packing!`, 'success');
        loadData();
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Payment verification failed', 'error');
    }
  };

  // Reject Payment (order detail + confirm queue) — cancels the order
  const handleRejectPayment = async (order: Order) => {
    try {
      const updated = await api.rejectPayment(order.id, verificationNotes || 'Payment proof could not be verified');
      showToast(`Payment rejected — order ${order.orderNumber} cancelled`, 'info');
      setRejectPaymentTarget(null);
      if (updated) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        if (selectedOrder?.id === order.id) {
          setSelectedOrder(updated);
        }
      } else {
        loadData();
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Payment rejection failed', 'error');
      setRejectPaymentTarget(null);
    }
  };

  // ===================== Render =====================

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Per-screen header — each sidebar item is its own standalone screen (no cross-screen
          tab bar); the title follows the currently shown section during cross-navigation. */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>{SCREEN_HEADERS[subTab].title}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{SCREEN_HEADERS[subTab].subtitle}</p>
        </div>

        <div className="flex items-center space-x-2">
          {subTab === 'customers' && !selectedCustomer && (
            <button
              onClick={() => setShowAddCustomer(true)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Customer</span>
            </button>
          )}
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ============ 1. ORDERS TAB ============ */}
      {subTab === 'orders' && !selectedOrder && (
        <div className="space-y-4">
          {/* Status Tab Bar (design 02) — internal to the Orders screen */}
          <div className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto">
            {orderTabs.map((t) => {
              const isActive = orderStatusTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setOrderStatusTab(t.id)}
                  className={`pb-2.5 pt-1 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    isActive
                      ? 'border-purple text-purple'
                      : 'border-transparent text-slate-500 hover:text-navy'
                  } ${t.id === 'confirm' ? 'ml-auto' : ''}`}
                >
                  {t.label} {t.count > 0 && <span className={isActive ? 'text-purple' : 'text-slate-400'}>({t.count})</span>}
                </button>
              );
            })}
          </div>

          {/* Search bar + Filters (design 02) */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2">
            <div className="flex items-center space-x-2 flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search order ID, customer or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>
            <FiltersButton filters={orderFilters} onChange={setOrderFilters} />
          </div>

          {orderStatusTab !== 'confirm' ? (
            /* ORDERS LIST (design 02) */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Payment</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {pagedOrders.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => openOrder(o)}
                        className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-navy text-xs">{o.orderNumber}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-navy text-xs">{o.customerName}</div>
                          <div className="text-[10px] text-slate-400">{o.customerPhone}</div>
                        </td>
                        <td className="py-3 px-3 font-black text-navy">{formatINR(o.grandTotal)}</td>
                        <td className="py-3 px-3">
                          <StatusBadge status={o.orderStatus} />
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-bold ${
                              paymentLabel(o) === 'Paid' ? 'text-emerald-600' : 'text-slate-600'
                            }`}
                          >
                            {paymentLabel(o)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">{formatDate(o.placedAtUtc)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openOrder(o);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-purple hover:bg-purple/5"
                            title="View order details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pagedOrders.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 text-xs font-bold">
                          No orders match this view.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-4">
                <Pagination
                  page={orderPage}
                  pageSize={PAGE_SIZE}
                  total={filteredOrders.length}
                  onPageChange={setOrderPage}
                />
              </div>
            </div>
          ) : (
            /* ORDER CONFIRM QUEUE (design 06) */
            <div className="space-y-3">
              {/* Sub-filter chips: Pending Confirmation | Confirmed | Rejected */}
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    { id: 'pending', label: 'Pending Confirmation', count: awaitingConfirmation.length },
                    { id: 'confirmed', label: 'Confirmed', count: verifiedPaymentOrders.length },
                    { id: 'rejected', label: 'Rejected', count: rejectedPaymentOrders.length }
                  ] as { id: 'pending' | 'confirmed' | 'rejected'; label: string; count: number }[]
                ).map((chip) => {
                  const isActive = confirmChip === chip.id;
                  return (
                    <button
                      key={chip.id}
                      onClick={() => setConfirmChip(chip.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-navy text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {chip.label}{' '}
                      <span className={isActive ? 'text-white/70' : 'text-slate-400'}>({chip.count})</span>
                    </button>
                  );
                })}
              </div>

              {confirmQueueOrders.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-10 text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <div className="font-black text-sm text-navy">
                    {confirmChip === 'pending' ? 'All caught up!' : 'Nothing here yet'}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {confirmChip === 'pending'
                      ? 'No orders are awaiting payment verification right now.'
                      : confirmChip === 'confirmed'
                      ? 'No orders with verified payments match your search.'
                      : 'No cancelled orders with rejected payments match your search.'}
                  </p>
                </div>
              )}

              {confirmQueueOrders.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Order summary */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <button
                          onClick={() => openOrder(o)}
                          className="font-mono font-bold text-purple text-xs hover:underline"
                        >
                          {o.orderNumber}
                        </button>
                        <StatusBadge status={o.orderStatus} />
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.paymentMethod === 'COD'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-purple/10 text-purple'
                          }`}
                        >
                          {o.paymentMethod}
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs font-bold text-navy">{o.customerName}</div>
                      <div className="text-[10px] text-slate-400">
                        {o.customerPhone} • {formatDate(o.placedAtUtc)} • {o.items?.length || 1} item(s)
                      </div>
                      <div className="mt-1 font-black text-navy text-sm">{formatINR(o.grandTotal)}</div>
                    </div>

                    {/* UPI proof */}
                    {o.paymentMethod !== 'COD' && (
                      <div className="flex items-center gap-3 lg:w-72">
                        {o.paymentScreenshotUrl ? (
                          <a
                            href={o.paymentScreenshotUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex-shrink-0"
                            title="Open payment screenshot"
                          >
                            <img
                              src={o.paymentScreenshotUrl}
                              alt="UPI payment proof"
                              className="w-full h-full object-cover hover:opacity-90"
                            />
                          </a>
                        ) : (
                          <div className="w-16 h-16 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0">
                            <CreditCard className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                        <div className="text-xs min-w-0">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">UPI Proof</div>
                          <div className="font-mono text-navy truncate">{o.utrNumber || 'UTR not submitted'}</div>
                          <div className="text-[10px] text-slate-400">
                            {o.paymentSubmittedAtUtc ? `Submitted ${formatDateTime(o.paymentSubmittedAtUtc)}` : 'Awaiting proof'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions (verify/reject only for the pending queue) */}
                    {confirmChip === 'pending' ? (
                      <div className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:w-44">
                        <button
                          onClick={() => handleQueueVerify(o)}
                          className="flex-1 px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Verify & Confirm</span>
                        </button>
                        <button
                          onClick={() => setRejectPaymentTarget(o)}
                          className="flex-1 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs font-bold flex items-center justify-center space-x-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject Payment</span>
                        </button>
                      </div>
                    ) : confirmChip === 'confirmed' ? (
                      <div className="lg:w-44 text-right lg:text-left">
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Payment Verified</span>
                        </span>
                        {o.paymentVerifiedAtUtc && (
                          <div className="text-[10px] text-slate-400 mt-1.5">
                            {formatDateTime(o.paymentVerifiedAtUtc)}
                            {o.paymentVerifiedBy ? ` by ${o.paymentVerifiedBy}` : ''}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="lg:w-44 text-right lg:text-left">
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Payment Rejected</span>
                        </span>
                        {o.paymentVerificationNotes && (
                          <div className="text-[10px] text-slate-400 mt-1.5 line-clamp-2">
                            "{o.paymentVerificationNotes}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {confirmQueueOrders.length > 0 && (
                <p className="text-sm text-slate-500">
                  Showing 1 to {confirmQueueOrders.length} of {confirmQueueOrders.length} entries
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ ORDER DETAIL VIEW (design 03) ============ */}
      {subTab === 'orders' && selectedOrder && (
        <div className="space-y-4">
          <div className="flex items-center flex-wrap gap-3">
            <h2 className="text-lg font-black text-navy">Order ID: {selectedOrder.orderNumber}</h2>
            <StatusBadge status={selectedOrder.orderStatus} />
            <span className="text-[10px] text-slate-400">
              Placed on {new Date(selectedOrder.placedAtUtc).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Left: Customer Information + Delivery Address cards | Right: Order Summary (design 03) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-1.5">
                <div className="font-black text-xs text-navy">Customer Information</div>
                <div className="font-bold text-navy text-xs">{selectedOrder.customerName}</div>
                <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                  <Phone className="w-3 h-3 text-orange" />
                  <span>{selectedOrder.customerPhone}</span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                  <Mail className="w-3 h-3 text-purple" />
                  <span>{selectedOrder.customerEmail}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-1.5">
                <div className="font-black text-xs text-navy">Delivery Address</div>
                <div className="flex items-start space-x-1.5 text-xs text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-navy">{selectedOrder.customerName}</div>
                    <div>{selectedOrder.shippingAddress?.addressLine1}</div>
                    {selectedOrder.shippingAddress?.addressLine2 && <div>{selectedOrder.shippingAddress.addressLine2}</div>}
                    <div>
                      {selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.state} -{' '}
                      {selectedOrder.shippingAddress?.postalCode}
                    </div>
                    <div>Ph. {selectedOrder.customerPhone}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 h-fit">
              <div className="font-black text-xs text-navy mb-3">Order Summary</div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Order Date</span>
                  <span className="font-bold text-navy">{formatDate(selectedOrder.placedAtUtc)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Payment Method</span>
                  <span className="font-bold text-navy">
                    {selectedOrder.paymentMethod === 'UPI' ? 'UPI / Google Pay' : selectedOrder.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Payment Status</span>
                  <StatusBadge status={selectedOrder.paymentStatus} type="payment" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Delivery Method</span>
                  <span className="font-bold text-navy">Standard Delivery</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Order Status</span>
                  {(NEXT_TRANSITIONS[selectedOrder.orderStatus] ?? []).length > 0 ? (
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value as OrderStatus | '')}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-navy text-xs font-bold outline-none focus:border-purple"
                    >
                      <option value="">{selectedOrder.orderStatus} (current)</option>
                      {(NEXT_TRANSITIONS[selectedOrder.orderStatus] ?? []).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={selectedOrder.orderStatus} />
                  )}
                </div>
                {selectedOrder.trackingNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Tracking #</span>
                    <span className="font-mono font-bold text-navy">{selectedOrder.trackingNumber}</span>
                  </div>
                )}
                {selectedOrder.utrNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">UTR / Reference</span>
                    <span className="font-mono font-bold text-navy">{selectedOrder.utrNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* UPI Payment Verification (kept from existing flow) */}
          {(selectedOrder.paymentStatus !== 'Paid' || selectedOrder.paymentScreenshotUrl) && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-black text-xs text-amber-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <span>UPI Payment Verification</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedOrder.paymentStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Payment: {selectedOrder.paymentStatus}
                </span>
              </div>

              {selectedOrder.paymentScreenshotUrl && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-amber-800">Submitted Payment Screenshot:</div>
                  <a
                    href={selectedOrder.paymentScreenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block relative rounded-xl overflow-hidden border border-amber-200 max-h-48 group cursor-zoom-in"
                  >
                    <img
                      src={selectedOrder.paymentScreenshotUrl}
                      alt="Payment Screenshot"
                      className="w-full h-44 object-contain bg-slate-900 group-hover:opacity-90"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-navy/40 opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-xs space-x-1">
                      <ExternalLink className="w-4 h-4" />
                      <span>Click to Expand Full Screenshot</span>
                    </div>
                  </a>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                <div>
                  <label className="font-bold text-amber-900">UTR / Reference Number</label>
                  <input
                    type="text"
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    placeholder="e.g. 423588991204"
                    className="w-full mt-1 p-2 rounded-xl bg-white border border-amber-300 font-mono text-navy outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-amber-900">Verification Notes</label>
                  <input
                    type="text"
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="e.g. Verified in GPay business statement"
                    className="w-full mt-1 p-2 rounded-xl bg-white border border-amber-300 text-navy outline-none"
                  />
                </div>
              </div>

              {selectedOrder.paymentStatus !== 'Paid' && selectedOrder.orderStatus !== 'Cancelled' && (
                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    onClick={() => setRejectPaymentTarget(selectedOrder)}
                    className="px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Payment</span>
                  </button>
                  <button
                    onClick={handleConfirmPayment}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm Payment & Move to Packing</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Items + Totals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 pt-4 pb-2 font-black text-xs text-navy">Items</div>
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-5">Product</th>
                    <th className="py-2 px-3">Price</th>
                    <th className="py-2 px-3">Qty</th>
                    <th className="py-2 px-5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(selectedOrder.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-5">
                        <div className="flex items-center space-x-2.5">
                          {it.imageUrl ? (
                            <img src={it.imageUrl} alt={it.productName} className="w-8 h-8 rounded-lg object-cover border border-slate-100" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-orange/10 flex items-center justify-center flex-shrink-0">
                              <ShoppingBag className="w-3.5 h-3.5 text-orange" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-navy">{it.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">SKU: {it.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">{formatINR(it.unitPrice)}</td>
                      <td className="py-3 px-3">{it.quantity}</td>
                      <td className="py-3 px-5 text-right font-black text-navy">{formatINR(it.lineTotal)}</td>
                    </tr>
                  ))}
                  {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 font-bold">
                        Line items unavailable for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 h-fit">
              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-navy">{formatINR(selectedOrder.itemsSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span className={`font-bold ${selectedOrder.discount > 0 ? 'text-emerald-600' : 'text-navy'}`}>
                    {selectedOrder.discount > 0 ? `-${formatINR(selectedOrder.discount)}` : formatINR(0)}
                  </span>
                </div>
                {selectedOrder.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Tax (GST)</span>
                    <span className="font-bold text-navy">{formatINR(selectedOrder.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery Charges</span>
                  <span className="font-bold text-navy">{formatINR(selectedOrder.shippingCharge)}</span>
                </div>
                <div className="pt-2.5 border-t border-slate-200 flex justify-between font-black text-sm text-navy">
                  <span>Total Amount</span>
                  <span className="text-orange">{formatINR(selectedOrder.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Timeline (design 03) */}
          {(() => {
            const { steps, cancelled } = buildTimeline(selectedOrder);
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                <div className="font-black text-xs text-navy mb-5">Order Timeline</div>
                {cancelled && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center space-x-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Order Cancelled
                      {cancelled.changedAtUtc ? ` on ${formatDateTime(cancelled.changedAtUtc)}` : ''}
                      {cancelled.reason ? ` — ${cancelled.reason}` : ''}
                    </span>
                  </div>
                )}
                <div className="flex overflow-x-auto">
                  {steps.map((s, i) => (
                    <div key={s.label} className="flex-1 min-w-24 relative flex flex-col items-center text-center">
                      {i > 0 && (
                        <div
                          className={`absolute top-[11px] right-1/2 w-full h-0.5 ${
                            s.done && !cancelled ? 'bg-emerald-300' : 'bg-slate-200'
                          }`}
                        />
                      )}
                      <div
                        className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                          s.done && !cancelled
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : s.done
                            ? 'bg-slate-400 border-slate-400 text-white'
                            : 'bg-white border-slate-300 text-slate-300'
                        }`}
                      >
                        {s.done ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
                      </div>
                      <div className={`mt-2 text-xs font-bold ${s.done ? 'text-navy' : 'text-slate-400'}`}>{s.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {s.timestamp ? formatDateTime(s.timestamp) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Footer buttons (design 03): Back | Print Invoice | Cancel Order | Update Status */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              onClick={closeOrderDetail}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              onClick={() => handlePrintInvoice(selectedOrder)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-navy text-xs font-bold hover:bg-slate-50 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-purple" />
              <span>Print Invoice</span>
            </button>
            {(NEXT_TRANSITIONS[selectedOrder.orderStatus] ?? []).includes('Cancelled') && (
              <button
                onClick={() => setCancelOrderTarget(selectedOrder)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-md shadow-red-500/20"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Order</span>
              </button>
            )}
            {(NEXT_TRANSITIONS[selectedOrder.orderStatus] ?? []).length > 0 && (
              <button
                onClick={() => statusDraft && handleUpdateStatus(selectedOrder.id, statusDraft)}
                disabled={!statusDraft}
                className={`flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold shadow-xs ${
                  statusDraft
                    ? 'bg-purple hover:bg-purple-dark text-white'
                    : 'bg-purple/40 text-white cursor-not-allowed'
                }`}
                title={statusDraft ? `Set status to ${statusDraft}` : 'Select a new status in Order Summary first'}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Update Status</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============ 2. CUSTOMERS CRM TAB (design 11) ============ */}
      {subTab === 'customers' && !selectedCustomer && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center space-x-2 w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search customer name, phone or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Orders</th>
                    <th className="py-3 px-3">Total Spent</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedCustomers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openCustomer(c.id)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple/10 text-purple flex items-center justify-center font-black text-[10px] flex-shrink-0">
                            {(c.name || 'C')
                              .split(' ')
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <span className="font-bold text-navy text-xs">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">{c.phone}</td>
                      <td className="py-3 px-3 text-slate-500">{c.email}</td>
                      <td className="py-3 px-3 font-bold text-purple">{c.totalOrders}</td>
                      <td className="py-3 px-3 font-black text-navy">{formatINR(c.lifetimeValue)}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-300 inline-block" />
                      </td>
                    </tr>
                  ))}
                  {pagedCustomers.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 text-xs font-bold">
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={customerPage}
                pageSize={PAGE_SIZE}
                total={filteredCustomers.length}
                onPageChange={setCustomerPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* ============ CUSTOMER DETAIL VIEW ============ */}
      {subTab === 'customers' && selectedCustomer && (
        <div className="space-y-4">
          <button
            onClick={closeCustomerDetail}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-purple text-xs font-bold hover:bg-purple/5 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customers</span>
          </button>

          {isCustomerLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-10 text-center text-xs font-bold text-slate-400">
              Loading customer profile...
            </div>
          ) : (
            <>
              {/* Profile header */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple/10 text-purple flex items-center justify-center font-black text-lg flex-shrink-0">
                  {(selectedCustomer.name || 'C')
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h2 className="text-base font-black text-navy">{selectedCustomer.name}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedCustomer.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {selectedCustomer.status}
                    </span>
                    {selectedCustomer.customerCode && (
                      <span className="text-[10px] font-mono text-slate-400">{selectedCustomer.customerCode}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center space-x-1.5">
                      <Phone className="w-3 h-3 text-orange" />
                      <span>{selectedCustomer.phone || '—'}</span>
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <Mail className="w-3 h-3 text-purple" />
                      <span>{selectedCustomer.email || '—'}</span>
                    </span>
                    <span className="text-slate-400">Member since {formatDate(selectedCustomer.createdAtUtc)}</span>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Orders</div>
                  <div className="text-2xl font-black text-purple mt-1">
                    {selectedCustomer.totalOrders || customerOrders.length}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Spent</div>
                  <div className="text-2xl font-black text-navy mt-1">{formatINR(selectedCustomer.lifetimeValue)}</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Reward Points</div>
                  <div className="text-2xl font-black text-orange mt-1">{selectedCustomer.rewardPoints ?? 0}</div>
                </div>
              </div>

              {/* Addresses + Order history */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                  <div className="font-black text-xs text-navy mb-3">Saved Addresses</div>
                  {(selectedCustomer.addresses || []).length === 0 ? (
                    <p className="text-xs text-slate-400 font-bold">No saved addresses.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {(selectedCustomer.addresses || []).map((addr, idx) => (
                        <div key={addr.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-navy">{addr.label || addr.fullName || `Address ${idx + 1}`}</span>
                            {addr.isDefault && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple/10 text-purple">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-slate-600 leading-relaxed">
                            <div>{addr.addressLine1}</div>
                            {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                            <div>
                              {addr.city}
                              {addr.state ? `, ${addr.state}` : ''} - {addr.postalCode || addr.pincode || ''}
                            </div>
                            {addr.phone && <div className="text-slate-400">Ph. {addr.phone}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-5 pt-4 pb-2 font-black text-xs text-navy">Order History</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-5">Order ID</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Amount</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-5">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {customerOrders.map((o) => (
                          <tr
                            key={o.id}
                            onClick={() => openOrderById(o.id)}
                            className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-5 font-mono font-bold text-purple">{o.orderNumber}</td>
                            <td className="py-3 px-3 text-slate-500">{formatDate(o.placedAtUtc)}</td>
                            <td className="py-3 px-3 font-black text-navy">{formatINR(o.grandTotal)}</td>
                            <td className="py-3 px-3">
                              <StatusBadge status={o.orderStatus} />
                            </td>
                            <td className="py-3 px-5 font-bold text-slate-600">{paymentLabel(o)}</td>
                          </tr>
                        ))}
                        {customerOrders.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                              No orders placed yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ 3. TAX INVOICES TAB ============ */}
      {subTab === 'invoices' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Order Ref</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Subtotal</th>
                  <th className="py-3 px-3">GST Tax (18%)</th>
                  <th className="py-3 px-3">Grand Total</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-navy">{inv.invoiceNumber}</td>
                    <td className="py-3 px-3 font-mono text-purple">{inv.orderNumber}</td>
                    <td className="py-3 px-3 font-bold text-slate-800">{inv.customerName}</td>
                    <td className="py-3 px-3">{formatINR(inv.subtotal)}</td>
                    <td className="py-3 px-3">{formatINR(inv.tax)}</td>
                    <td className="py-3 px-3 font-black text-navy">{formatINR(inv.grandTotal)}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        title="Print / View Invoice"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ 5. PAYMENTS TAB (design 15) ============ */}
      {subTab === 'payments' && (
        <div className="space-y-4">
          {/* Status tab bar: All | Received | Pending — internal to the Payments screen */}
          <div className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto">
            {paymentTabs.map((t) => {
              const isActive = paymentTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setPaymentTab(t.id)}
                  className={`pb-2.5 pt-1 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    isActive ? 'border-purple text-purple' : 'border-transparent text-slate-500 hover:text-navy'
                  }`}
                >
                  {t.label}{' '}
                  {t.count > 0 && <span className={isActive ? 'text-purple' : 'text-slate-400'}>({t.count})</span>}
                </button>
              );
            })}
          </div>

          {/* Search + Filters */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2">
            <div className="flex items-center space-x-2 flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search payment ID or order ID..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>
            <FiltersButton filters={paymentFilters} onChange={setPaymentFilters} />
          </div>

          {/* Payments table: Payment ID / Order ID / Customer / Amount / Method / Status / Date */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Payment ID</th>
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-navy">{pay.paymentNumber}</td>
                      <td className="py-3 px-3 font-mono text-purple">{pay.orderNumber || '—'}</td>
                      <td className="py-3 px-3 font-bold">{pay.customerName}</td>
                      <td className="py-3 px-3 font-black text-navy">{formatINR(pay.amount)}</td>
                      <td className="py-3 px-3 font-bold text-slate-600">{pay.paymentMethod}</td>
                      <td className="py-3 px-3">
                        <PaymentStatusPill status={pay.paymentStatus} />
                      </td>
                      <td className="py-3 px-3 text-slate-500">{formatDate(pay.paidAtUtc)}</td>
                    </tr>
                  ))}
                  {pagedPayments.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 text-xs font-bold">
                        No payments match this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={paymentPage}
                pageSize={PAGE_SIZE}
                total={filteredPayments.length}
                onPageChange={setPaymentPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* REJECT PAYMENT CONFIRM DIALOG */}
      <ErpConfirmDialog
        open={!!rejectPaymentTarget}
        title="Reject Payment?"
        message={
          rejectPaymentTarget ? (
            <>
              This will reject the submitted payment proof for order{' '}
              <span className="font-mono font-bold text-navy">{rejectPaymentTarget.orderNumber}</span> and cancel the
              order. The customer will need to place a fresh order.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Reject Payment"
        onConfirm={() => rejectPaymentTarget && handleRejectPayment(rejectPaymentTarget)}
        onCancel={() => setRejectPaymentTarget(null)}
      />

      {/* CANCEL ORDER CONFIRM DIALOG (design 03 footer) */}
      <ErpConfirmDialog
        open={!!cancelOrderTarget}
        title="Cancel Order?"
        message={
          cancelOrderTarget ? (
            <>
              Order <span className="font-mono font-bold text-navy">{cancelOrderTarget.orderNumber}</span> will be
              cancelled and any reserved stock released. This action cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Cancel Order"
        cancelLabel="Keep Order"
        onConfirm={() => {
          if (cancelOrderTarget) {
            handleUpdateStatus(cancelOrderTarget.id, 'Cancelled');
            setCancelOrderTarget(null);
          }
        }}
        onCancel={() => setCancelOrderTarget(null)}
      />

      {/* ADD CUSTOMER MODAL (design 08) */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-black text-sm text-navy">Add Customer</h3>
              <button
                onClick={() => setShowAddCustomer(false)}
                className="text-slate-400 hover:text-slate-600"
                title="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-500">Full Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
                  placeholder="e.g. Arun Kumar"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none focus:border-purple"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500">Phone *</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none focus:border-purple"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                  placeholder="e.g. arun@example.com"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none focus:border-purple"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setShowAddCustomer(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomer}
                disabled={isSavingCustomer}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs ${
                  isSavingCustomer ? 'bg-purple/50 cursor-not-allowed' : 'bg-purple hover:bg-purple-dark'
                }`}
              >
                {isSavingCustomer ? 'Saving...' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE TAX INVOICE MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="font-black text-base text-navy">AADHI CRACKERS</div>
                <span className="text-[10px] font-mono bg-purple/10 text-purple px-2 py-0.2 rounded font-bold">
                  ORIGINAL TAX INVOICE
                </span>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Invoice To:</div>
                <div className="font-bold text-navy">{selectedInvoice.customerName}</div>
                <div className="text-slate-500">Order: {selectedInvoice.orderNumber}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Invoice Number:</div>
                <div className="font-mono font-bold text-navy">{selectedInvoice.invoiceNumber}</div>
                <div className="text-slate-500">{new Date(selectedInvoice.issuedAtUtc).toLocaleDateString('en-IN')}</div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="font-bold">{formatINR(selectedInvoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST (9%) + SGST (9%):</span>
                <span className="font-bold">{formatINR(selectedInvoice.tax)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery & Handling:</span>
                <span className="font-bold">{formatINR(selectedInvoice.shipping)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-navy">
                <span>Total Amount Paid:</span>
                <span className="text-orange">{formatINR(selectedInvoice.grandTotal)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">GSTIN: 33ABCDE1234F1Z5 • Sivakasi, Tamil Nadu</span>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
