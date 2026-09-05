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
  const shipping = Number(raw?.shippingCharge ?? raw?.deliveryCharge ?? raw?.shipping) || 0;
  const total =
    Number(raw?.grandTotal ?? raw?.totalAmount ?? raw?.total) || subtotal - discount + shipping;

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

/** Clean printable HTML invoice — opened in a new window, then window.print(). */
const buildInvoiceHtml = (o: OrderView): string => {
  const rows = o.items
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(it.name)}</td>
        <td class="num">${it.quantity}</td>
        <td class="num">${inr(it.unitPrice)}</td>
        <td class="num">${inr(it.lineTotal)}</td>
      </tr>`
    )
    .join('');

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
  .meta { display: flex; justify-content: space-between; margin: 20px 0; }
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
      <div><span class="label">Order No:</span> <strong>${escapeHtml(o.orderNumber || '—')}</strong></div>
      <div><span class="label">Order Date:</span> ${escapeHtml(fmtDate(o.placedAt) || '—')}</div>
    </div>
    <div>
      <div><span class="label">Payment Method:</span> ${escapeHtml(paymentMethodLabel(o.paymentMethod))}</div>
      <div><span class="label">Payment Status:</span> ${escapeHtml(statusLabel(o.paymentStatus || 'Pending'))}</div>
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
    <div class="row"><span>Subtotal</span><span>${inr(o.subtotal)}</span></div>
    <div class="row"><span>Discount</span><span class="discount">${o.discount > 0 ? '-' + inr(o.discount) : inr(0)}</span></div>
    <div class="row"><span>Delivery Charges</span><span>${inr(o.shipping)}</span></div>
    <div class="row grand"><span>Total Amount</span><span>${inr(o.total)}</span></div>
  </div>
  <div class="footer">
    This is a computer-generated invoice from AADHI CRACKERS and does not require a signature.<br />
    Thank you for celebrating with us!
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
