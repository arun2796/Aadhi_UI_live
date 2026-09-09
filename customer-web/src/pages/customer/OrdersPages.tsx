import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Download,
  Package,
  PackageSearch,
  RotateCcw,
  Truck
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Order } from '../../types';

interface NavProps {
  onNavigate: (page: string, params?: any) => void;
}

/* ── Shared helpers (kept in sync with components/mobile/ScreenOrdersAndDetails.tsx) ── */

const inr = (n?: number) =>
  '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const fmtDate = (d?: string) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusLabel = (s?: string) => {
  if (!s) return '—';
  return s === 'OutForDelivery' ? 'Out for Delivery' : s;
};

const pillClass = (s?: string): string => {
  const v = (s || '').toLowerCase();
  if (['delivered', 'completed', 'paid', 'refunded', 'approved'].includes(v))
    return 'bg-emerald-100 text-emerald-700';
  if (['processing', 'pending', 'confirmed', 'packed', 'refundpending', 'authorized'].includes(v))
    return 'bg-amber-100 text-amber-700';
  if (['shipped', 'outfordelivery'].includes(v)) return 'bg-indigo-100 text-indigo-700';
  if (['cancelled', 'failed', 'rejected'].includes(v)) return 'bg-red-100 text-red-600';
  return 'bg-slate-100 text-slate-600';
};

const StatusPill: React.FC<{ status?: string }> = ({ status }) => (
  <span
    className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${pillClass(status)}`}
  >
    {statusLabel(status)}
  </span>
);

const paymentMethodLabel = (m?: string | number): string => {
  if (m === undefined || m === null || m === '') return '—';
  const v = String(m).toLowerCase();
  if (v === 'upi' || v === '2') return 'UPI / QR';
  if (v === 'cod' || v === 'cash' || v === '1') return 'Cash on Delivery';
  return String(m);
};

/* ═══════════════════════════════════════════════════════════════
   Desktop design 14: MY ORDERS — status tab bar + order rows
   ═══════════════════════════════════════════════════════════════ */

const TABS = ['All', 'To Pay', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;
type OrderTab = (typeof TABS)[number];

const bucketOf = (status?: string): OrderTab | 'Other' => {
  switch (status) {
    case 'Pending':
    case 'Confirmed':
    case 'Processing':
    case 'Packed':
      return 'Processing';
    case 'Shipped':
    case 'OutForDelivery':
      return 'Shipped';
    case 'Delivered':
      return 'Delivered';
    case 'Cancelled':
      return 'Cancelled';
    default:
      return 'Other';
  }
};

/** "To Pay" = orders whose payment is still pending/unpaid (and not already cancelled). */
const isToPay = (o: Order): boolean => {
  const p = String(o.paymentStatus || '').toLowerCase();
  return (p === 'pending' || p === 'unpaid') && o.orderStatus !== 'Cancelled';
};

/** Desktop design 14: My Orders (tabs All | To Pay | Processing | Shipped | Delivered | Cancelled). */
export const MyOrdersPage: React.FC<NavProps> = ({ onNavigate }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OrderTab>('All');

  const loadOrders = () => {
    setLoading(true);
    setError(null);
    api
      .getMyOrders()
      .then(list => setOrders(Array.isArray(list) ? list : []))
      .catch(() => setError('We could not load your orders right now. Please try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadOrders, []);

  const filtered = useMemo(() => {
    if (activeTab === 'All') return orders;
    if (activeTab === 'To Pay') return orders.filter(isToPay);
    return orders.filter(o => bucketOf(o.orderStatus) === activeTab);
  }, [orders, activeTab]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-fade-in">
      <h1 className="text-2xl font-black text-navy mb-6">My Orders</h1>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        {/* Status tab bar (purple underline on active tab) */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex items-center gap-8 overflow-x-auto [scrollbar-width:none]">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? 'border-purple text-purple font-bold'
                    : 'border-transparent text-slate-500 font-semibold hover:text-navy'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-16 text-center">
            <Clock className="w-7 h-7 text-purple animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Loading your orders...</p>
          </div>
        ) : error ? (
          <div className="p-14 text-center space-y-4">
            <AlertCircle className="w-9 h-9 text-amber-500 mx-auto" />
            <p className="text-sm text-slate-600 font-medium">{error}</p>
            <button
              onClick={loadOrders}
              className="px-6 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-sm font-bold transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center space-y-4 animate-fade-in">
            <PackageSearch className="w-12 h-12 text-slate-300 mx-auto" />
            <div>
              <p className="text-base font-bold text-navy">
                {activeTab === 'All' ? 'No orders yet' : `No ${activeTab.toLowerCase()} orders`}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {activeTab === 'All'
                  ? 'Light up your celebrations — your orders will appear here.'
                  : activeTab === 'To Pay'
                    ? 'Orders awaiting payment will appear here.'
                    : 'Orders with this status will appear here.'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('shop')}
              className="px-8 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white text-sm font-bold uppercase tracking-wider shadow-glow-purple transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 animate-fade-in">
            {filtered.map(o => (
              <div
                key={o.id || o.orderNumber}
                className="px-6 py-4 grid grid-cols-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto_auto] items-center gap-x-4 gap-y-2 hover:bg-slate-50/70 transition-colors"
              >
                <div className="text-sm font-black text-navy truncate">{o.orderNumber}</div>
                <div className="text-xs text-slate-500 font-medium">
                  {fmtDate(o.placedAtUtc) || '—'}
                </div>
                <div className="text-sm font-black text-navy md:text-right">{inr(o.grandTotal)}</div>
                <div className="justify-self-start md:justify-self-end">
                  <StatusPill status={o.orderStatus} />
                </div>
                <button
                  onClick={() =>
                    onNavigate('order-details', { orderId: o.id, orderNumber: o.orderNumber })
                  }
                  className="justify-self-end text-sm font-bold text-purple hover:text-purple-dark whitespace-nowrap transition-colors"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Desktop design 15: ORDER DETAILS — summary, items, totals, actions
   ═══════════════════════════════════════════════════════════════ */

interface OrderItemView {
  id?: string;
  name: string;
  sku?: string;
  code?: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface OrderView {
  id?: string;
  orderNumber: string;
  status: string;
  placedAt?: string;
  deliveredAt?: string;
  updatedAt?: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: any;
  paymentMethod?: string | number;
  paymentStatus?: string;
  items: OrderItemView[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

const normalizeOrder = (raw: any, fallbackNumber?: string): OrderView => {
  const items: OrderItemView[] = (Array.isArray(raw?.items) ? raw.items : []).map((it: any) => {
    const qty = Number(it?.quantity) || 1;
    const unit = Number(it?.unitPrice ?? it?.price) || 0;
    return {
      id: it?.id ?? it?.orderItemId,
      name: it?.productName ?? it?.name ?? 'Item',
      sku: it?.sku || it?.code,
      code: it?.code || it?.sku,
      imageUrl: it?.imageUrl ?? it?.primaryImageUrl,
      quantity: qty,
      unitPrice: unit,
      lineTotal: Number(it?.lineTotal) || unit * qty
    };
  });
  const subtotal =
    Number(raw?.itemsSubtotal ?? raw?.subtotal) ||
    items.reduce((sum, it) => sum + it.lineTotal, 0);
  const discount = Number(raw?.discount) || 0;
  const shipping = Number(raw?.shippingCharge ?? raw?.shipping) || 0;
  const total = Math.max(0, subtotal - discount + (Number(raw?.tax) || 0));

  const histories: any[] = Array.isArray(raw?.statusHistories) ? raw.statusHistories : [];
  const deliveredAt =
    raw?.deliveredAtUtc ??
    histories.find((h: any) => h?.toStatus === 'Delivered')?.changedAtUtc;
  const updatedAt = histories.length ? histories[histories.length - 1]?.changedAtUtc : undefined;

  return {
    id: raw?.id ?? raw?.orderId,
    orderNumber: raw?.orderNumber ?? fallbackNumber ?? '',
    status: raw?.orderStatus ?? raw?.status ?? 'Pending',
    placedAt: raw?.placedAtUtc ?? raw?.placedAt ?? raw?.createdAt,
    deliveredAt,
    updatedAt,
    customerName: raw?.customerName || raw?.shippingAddress?.fullName || 'Valued Customer',
    customerPhone: raw?.customerPhone || raw?.shippingAddress?.phone || '',
    shippingAddress: raw?.shippingAddress,
    paymentMethod: raw?.paymentMethod,
    paymentStatus: raw?.paymentStatus,
    items,
    subtotal,
    discount,
    shipping,
    total
  };
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c =>
      (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<string, string>)[c]
  );

/** Clean printable HTML invoice matching Sivakasi fireworks bill reference */
const buildInvoiceHtml = (o: OrderView): string => {
  const formatNum = (n?: number): string =>
    (Number(n) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const formatInvoiceDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const items = o.items || [];
  const subTotal =
    Number(o.subtotal) > 0
      ? Number(o.subtotal)
      : items.reduce((sum, it) => sum + it.lineTotal, 0);

  const packingCharge =
    Number(o.shipping) > 0
      ? Number(o.shipping)
      : Math.round(subTotal * 0.015);

  const overallTotal =
    Number(o.total) > subTotal
      ? Number(o.total)
      : subTotal + packingCharge;

  const rows =
    items.length === 0
      ? '<tr><td colspan="8" style="text-align:center;padding:24px 12px;color:#64748b;font-weight:bold;border-bottom:1px solid #000;">No items found for this order.</td></tr>'
      : items
          .map((it, i) => {
            const qty = Number(it.quantity) || 1;
            const lineTotal = Number(it.lineTotal) || it.unitPrice * qty;
            const finalRate = qty > 0 ? it.unitPrice || lineTotal / qty : 0;

            // 80% discount model
            const rateQty = finalRate * 5;
            const discount = rateQty * 0.8;
            const code = it.sku || it.code || `AC-${String(i + 1).padStart(2, '0')}`;

            return `
            <tr>
              <td class="col-sno">${i + 1}</td>
              <td class="col-code">${escapeHtml(code)}</td>
              <td class="col-name">${escapeHtml(it.name)}</td>
              <td class="col-qty">${qty}</td>
              <td class="col-rate">${formatNum(rateQty)}</td>
              <td class="col-disc">${formatNum(discount)}</td>
              <td class="col-final">${formatNum(finalRate)}</td>
              <td class="col-amount">${formatNum(lineTotal)}</td>
            </tr>`;
          })
          .join('');

  const addr = o.shippingAddress;
  const addressLines = addr
    ? [
        addr.addressLine1,
        addr.addressLine2,
        [addr.city, addr.state].filter(Boolean).join(', '),
        addr.postalCode ? `${addr.state ? '' : 'Pincode: '}${addr.postalCode}` : null
      ]
        .filter(Boolean)
        .map((l: any) => escapeHtml(l))
        .join('<br />')
    : 'Sivakasi, Tamil Nadu';

  const orderNum = o.orderNumber || '—';
  const orderDate = formatInvoiceDate(o.placedAt) || new Date().toLocaleDateString('en-IN');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Estimate_${escapeHtml(orderNum)}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 12px; font-size: 11px; background: #fff; }
  .invoice-box { width: 100%; max-width: 820px; margin: 0 auto; border: 1.5px solid #000; background: #fff; }
  .top-bar { display: flex; border-bottom: 1.5px solid #000; font-size: 12px; }
  .top-bar-cell { padding: 6px 10px; display: flex; align-items: center; }
  .top-bar-left { width: 33.33%; border-right: 1.5px solid #000; font-weight: bold; }
  .top-bar-center { width: 33.34%; justify-content: center; font-size: 13.5px; font-weight: 800; letter-spacing: 1px; border-right: 1.5px solid #000; }
  .top-bar-right { width: 33.33%; justify-content: flex-end; font-weight: bold; }
  .company-header { padding: 6px 12px 8px; border-bottom: 1.5px solid #000; text-align: center; }
  .company-contacts { display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 2px; }
  .company-name { font-size: 17px; font-weight: 800; letter-spacing: 0.5px; margin: 2px 0 3px; }
  .company-address { font-size: 11px; color: #111; }
  .info-grid { display: flex; border-bottom: 1.5px solid #000; }
  .customer-col { width: 58%; border-right: 1.5px solid #000; padding: 6px 10px; line-height: 1.45; font-size: 11px; }
  .customer-col .title { font-weight: bold; margin-bottom: 2px; font-size: 11.5px; }
  .bank-col { width: 42%; padding: 6px 10px; line-height: 1.4; }
  .bank-table { width: 100%; border-collapse: collapse; }
  .bank-table td { padding: 1px 0; font-size: 10.5px; vertical-align: top; }
  .bank-table td.lbl { font-weight: bold; width: 82px; white-space: nowrap; }
  .bank-table td.colon { width: 14px; font-weight: bold; text-align: center; }
  .bank-table td.val { font-weight: bold; letter-spacing: 0.2px; }
  .ledger-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .ledger-table th { border-bottom: 1.5px solid #000; border-right: 1px solid #000; padding: 5px 3px; text-align: center; font-weight: bold; background: #fff; }
  .ledger-table th:last-child { border-right: none; }
  .cat-band td { background: #e2e8f0; font-weight: bold; padding: 3px 8px; font-size: 10.5px; border-bottom: 1px solid #000; text-align: left; }
  .ledger-table td { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 3.5px 5px; vertical-align: middle; }
  .ledger-table td:last-child { border-right: none; }
  .col-sno { width: 34px; text-align: center; }
  .col-code { width: 52px; text-align: center; font-weight: 500; }
  .col-name { text-align: left; padding-left: 8px !important; }
  .col-qty { width: 38px; text-align: center; font-weight: bold; }
  .col-rate { width: 72px; text-align: right; }
  .col-disc { width: 70px; text-align: right; }
  .col-final { width: 70px; text-align: right; font-weight: 600; }
  .col-amount { width: 80px; text-align: right; font-weight: bold; }
  .subtotal-row td { font-weight: bold; border-bottom: 1.5px solid #000; padding: 4px 6px; }
  .subtotal-label { text-align: right; font-weight: bold; padding-right: 8px !important; }
  .spacer-row td { height: 42px; border-bottom: 1px solid #000; }
  .packing-row td { font-weight: bold; border-bottom: 1.5px solid #000; padding: 4px 6px; }
  .overall-row td { font-weight: bold; padding: 4px 6px; background: #e2e8f0; font-size: 11px; }
  .total-items-cell { font-weight: bold; text-align: left; padding-left: 8px !important; }
  .overall-label { text-align: right; font-weight: bold; padding-right: 8px !important; }
  .invoice-footer { display: flex; justify-content: space-between; padding: 8px 10px; font-size: 9.5px; border-top: 1.5px solid #000; line-height: 1.45; }
  .terms-box { width: 65%; }
  .terms-box .terms-title { font-weight: bold; text-decoration: underline; margin-bottom: 2px; }
  .sign-box { width: 32%; text-align: right; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; }
  .sign-title { font-weight: bold; }
  .sign-space { height: 28px; }
  @media print {
    body { padding: 0; }
    .invoice-box { border: 1.5px solid #000; max-width: 100%; }
  }
</style>
</head>
<body>
  <div class="invoice-box">
    <!-- 1. Top Header Bar -->
    <div class="top-bar">
      <div class="top-bar-cell top-bar-left">Order No : ${escapeHtml(orderNum)}</div>
      <div class="top-bar-cell top-bar-center">ESTIMATE</div>
      <div class="top-bar-cell top-bar-right">Date : ${escapeHtml(orderDate)}</div>
    </div>

    <!-- 2. Company Header -->
    <div class="company-header">
      <div class="company-contacts">
        <span>Mobile : +91 94428 26566</span>
        <span>E-mail : support@aadhicrackers.com</span>
      </div>
      <div class="company-name">Aadhi Crackers</div>
      <div class="company-address">3/1233/A8, Naranapuram Main Road, Sivakasi - 626 189.</div>
    </div>

    <!-- 3. Customer & Bank Details -->
    <div class="info-grid">
      <div class="customer-col">
        <div class="title">Customer Details</div>
        <div><strong>${escapeHtml(o.customerName || 'Valued Customer')}</strong></div>
        ${o.customerPhone ? `<div>${escapeHtml(o.customerPhone)}</div>` : ''}
        ${addressLines ? `<div>${addressLines}</div>` : ''}
      </div>
      <div class="bank-col">
        <table class="bank-table">
          <tr><td class="lbl">A/C Name</td><td class="colon">:</td><td class="val">AADHI CRACKERS</td></tr>
          <tr><td class="lbl">A/C Number</td><td class="colon">:</td><td class="val">926020003006172</td></tr>
          <tr><td class="lbl">A/C Type</td><td class="colon">:</td><td class="val">Current</td></tr>
          <tr><td class="lbl">Bank Name</td><td class="colon">:</td><td class="val">AXIS BANK LTD</td></tr>
          <tr><td class="lbl">IFSC Code</td><td class="colon">:</td><td class="val">UTIB0000089</td></tr>
        </table>
      </div>
    </div>

    <!-- 4. Ledger Table -->
    <table class="ledger-table">
      <thead>
        <tr>
          <th class="col-sno">S.No</th>
          <th class="col-code">Code</th>
          <th class="col-name">Product Name</th>
          <th class="col-qty">Qty</th>
          <th class="col-rate">Rate / Qty</th>
          <th class="col-disc">Discount</th>
          <th class="col-final">Final Rate</th>
          <th class="col-amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr class="cat-band">
          <td colspan="8">80% Products</td>
        </tr>
        ${rows || '<tr><td colspan="8" style="text-align:center;padding:12px;color:#666;">No items found</td></tr>'}
        <!-- Sub Total Row -->
        <tr class="subtotal-row">
          <td colspan="7" class="subtotal-label">Sub Total</td>
          <td class="col-amount">${formatNum(subTotal)}</td>
        </tr>
        <!-- Spacer Row with vertical borders -->
        <tr class="spacer-row">
          <td class="col-sno">&nbsp;</td>
          <td class="col-code">&nbsp;</td>
          <td class="col-name">&nbsp;</td>
          <td class="col-qty">&nbsp;</td>
          <td class="col-rate">&nbsp;</td>
          <td class="col-disc">&nbsp;</td>
          <td class="col-final">&nbsp;</td>
          <td class="col-amount">&nbsp;</td>
        </tr>
        <!-- Packing Charges Row -->
        <tr class="packing-row">
          <td colspan="7" class="subtotal-label">Packing Charges ( 1.5% )</td>
          <td class="col-amount">${formatNum(packingCharge)}</td>
        </tr>
        <!-- Overall Total Row -->
        <tr class="overall-row">
          <td colspan="4" class="total-items-cell">Total Items : ${items.length}</td>
          <td colspan="3" class="overall-label">Overall Total</td>
          <td class="col-amount">${formatNum(overallTotal)}</td>
        </tr>
      </tbody>
    </table>

    <!-- 5. Footer & Terms -->
    <div class="invoice-footer">
      <div class="terms-box">
        <div class="terms-title">Terms &amp; Conditions:</div>
        <div>1. Goods once sold cannot be taken back or exchanged.</div>
        <div>2. Store fireworks in a cool, dry place away from heat and open flames.</div>
        <div>3. Subject to Sivakasi Jurisdiction.</div>
      </div>
      <div class="sign-box">
        <div class="sign-title">For AADHI CRACKERS</div>
        <div class="sign-space"></div>
        <div>Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/** Desktop design 15: Order Details (summary, items, totals, Download Invoice + Track Order). */
export const OrderDetailsPage: React.FC<NavProps & { orderId?: string; orderNumber?: string }> = ({
  onNavigate,
  orderId,
  orderNumber
}) => {
  const { showToast } = useToast();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingReturn, setExistingReturn] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let raw: any = null;
        if (orderId) raw = await api.getOrderById(orderId);
        if (!raw && orderNumber) raw = await api.trackOrder(orderNumber);
        if (!cancelled) setOrder(raw ? normalizeOrder(raw, orderNumber) : null);
      } catch {
        if (!cancelled) setOrder(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [orderId, orderNumber]);

  // For delivered orders: check whether a return already exists for this order.
  useEffect(() => {
    if (!order || (order.status !== 'Delivered' && order.status !== 'Returned')) return;
    let cancelled = false;
    api
      .getMyReturns()
      .then(returns => {
        if (cancelled) return;
        const match = (Array.isArray(returns) ? returns : []).find(
          (r: any) =>
            (order.id && r?.orderId === order.id) ||
            (order.orderNumber && r?.orderNumber === order.orderNumber)
        );
        setExistingReturn(match || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [order]);

  const handleDownloadInvoice = () => {
    if (!order) return;
    const w = window.open('', '_blank', 'width=820,height=940');
    if (!w) {
      showToast('Please allow pop-ups to download the invoice.', 'warning');
      return;
    }
    w.document.write(buildInvoiceHtml(order));
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {
        /* viewer can print manually from the opened window */
      }
    }, 400);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-fade-in">
      <h1 className="text-2xl font-black text-navy mb-6">Order Details</h1>

      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-card">
          <Clock className="w-7 h-7 text-purple animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Loading order details...</p>
        </div>
      ) : !order ? (
        <div className="p-14 text-center bg-white rounded-2xl border border-slate-200 shadow-card space-y-4">
          <AlertCircle className="w-9 h-9 text-amber-500 mx-auto" />
          <div>
            <p className="text-base font-bold text-navy">Order not found</p>
            <p className="text-sm text-slate-500 mt-1">
              We could not load this order right now. Please try again from My Orders.
            </p>
          </div>
          <button
            onClick={() => onNavigate('my-orders')}
            className="px-6 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-sm font-bold transition-colors"
          >
            Back to My Orders
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 md:p-8 space-y-6 animate-fade-in">
          {/* Header: Order ID + status pill */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-navy break-all">
              Order ID: {order.orderNumber || '—'}
            </h2>
            <StatusPill status={order.status} />
          </div>

          {/* Order Summary */}
          <div className="pt-5 border-t border-slate-100">
            <h3 className="text-sm font-black text-navy mb-4">Order Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">Placed on</span>
                <span className="font-bold text-navy">{fmtDate(order.placedAt) || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">Payment Method</span>
                <span className="font-bold text-navy">
                  {paymentMethodLabel(order.paymentMethod)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">Payment Status</span>
                <StatusPill status={order.paymentStatus || 'Pending'} />
              </div>
              {order.status === 'Delivered' ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Delivered on</span>
                  <span className="font-bold text-navy">
                    {fmtDate(order.deliveredAt || order.updatedAt) || '—'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Last updated</span>
                  <span className="font-bold text-navy">
                    {fmtDate(order.updatedAt || order.placedAt) || '—'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="pt-5 border-t border-slate-100">
            <h3 className="text-sm font-black text-navy mb-4">Items</h3>
            {order.items.length === 0 ? (
              <p className="text-sm text-slate-400">
                Item details are not available for this order.
              </p>
            ) : (
              <div className="space-y-4">
                {order.items.map((it, idx) => (
                  <div key={it.id || idx} className="flex items-center gap-4">
                    {it.imageUrl ? (
                      <img
                        src={it.imageUrl}
                        alt={it.name}
                        className="w-14 h-14 rounded-xl object-cover border border-slate-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-purple/5 border border-purple/10 flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-purple/60" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-navy truncate">{it.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {inr(it.unitPrice)} × {it.quantity}
                      </div>
                    </div>
                    <div className="text-sm font-black text-navy flex-shrink-0">
                      {inr(it.lineTotal)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Price summary */}
          <div className="pt-5 border-t border-slate-100">
            <div className="ml-auto w-full sm:max-w-xs space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Subtotal</span>
                <span className="font-bold text-navy">{inr(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Discount</span>
                <span
                  className={`font-bold ${order.discount > 0 ? 'text-emerald-600' : 'text-navy'}`}
                >
                  {order.discount > 0 ? `-${inr(order.discount)}` : inr(0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Delivery Charges</span>
                <span className="font-bold text-navy">
                  {order.shipping > 0 ? inr(order.shipping) : 'FREE'}
                </span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-slate-100 text-base">
                <span className="font-black text-navy">Total Amount</span>
                <span className="font-black text-navy">{inr(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-5 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadInvoice}
              className="px-6 py-3 rounded-xl border border-slate-200 bg-white text-navy font-bold text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Download Invoice</span>
            </button>
            <button
              onClick={() => onNavigate('track-order', { orderNumber: order.orderNumber })}
              className="px-6 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-sm flex items-center gap-2 shadow-glow-purple transition-colors"
            >
              <Truck className="w-4 h-4" />
              <span>Track Order</span>
            </button>

            {/* Delivered orders: request a return, or jump to the existing one */}
            {order.status === 'Delivered' &&
              (existingReturn ? (
                <button
                  onClick={() =>
                    onNavigate('return-status', {
                      returnId: existingReturn.id ?? existingReturn.returnNumber
                    })
                  }
                  className="px-6 py-3 rounded-xl bg-purple/5 border border-purple/20 text-purple font-bold text-sm flex items-center gap-2 hover:bg-purple/10 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Return in progress — View Status</span>
                </button>
              ) : (
                <button
                  onClick={() =>
                    onNavigate('return-request', {
                      orderId: order.id ?? orderId,
                      orderNumber: order.orderNumber
                    })
                  }
                  className="px-6 py-3 rounded-xl border border-purple/40 text-purple font-bold text-sm flex items-center gap-2 hover:bg-purple/5 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Request Return</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
