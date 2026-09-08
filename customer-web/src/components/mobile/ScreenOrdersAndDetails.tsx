import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  FileText,
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

/* ── Shared helpers ────────────────────────────────────────────── */

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
  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap ${pillClass(status)}`}>
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
   Design 11: MY ORDERS — status tab bar + order rows
   ═══════════════════════════════════════════════════════════════ */

const TABS = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;
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

export const ScreenMyOrders: React.FC<NavProps> = ({ onNavigate }) => {
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

  const filtered = useMemo(
    () => (activeTab === 'All' ? orders : orders.filter(o => bucketOf(o.orderStatus) === activeTab)),
    [orders, activeTab]
  );

  return (
    <div className="font-sans bg-[#fbfbfb] pb-6 min-h-full">
      {/* Status tab bar (purple underline on active tab) */}
      <div className="sticky top-12 z-10 bg-[#fbfbfb] border-b border-slate-200/70">
        <div className="flex items-center overflow-x-auto px-4 space-x-5 [scrollbar-width:none]">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors ${
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

      <div className="px-4 pt-3">
        {loading ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-slate-100 shadow-card">
            <Clock className="w-6 h-6 text-purple animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading your orders...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-card space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-xs text-slate-600 font-medium">{error}</p>
            <button
              onClick={loadOrders}
              className="px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-slate-100 shadow-card space-y-3 animate-fade-in">
            <PackageSearch className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <p className="text-sm font-bold text-navy">
                {activeTab === 'All' ? 'No orders yet' : `No ${activeTab.toLowerCase()} orders`}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {activeTab === 'All'
                  ? 'Light up your celebrations — your orders will appear here.'
                  : 'Orders with this status will appear here.'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('home')}
              className="px-6 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold uppercase tracking-wider shadow-glow-purple transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card divide-y divide-slate-100 overflow-hidden animate-fade-in">
            {filtered.map(o => (
              <button
                key={o.id || o.orderNumber}
                onClick={() => onNavigate('order-details', { orderId: o.id, orderNumber: o.orderNumber })}
                className="w-full px-4 py-4 flex items-center justify-between text-left active:bg-slate-50 transition-colors"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-[13px] font-black text-navy tracking-tight truncate">
                    {o.orderNumber}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">{fmtDate(o.placedAtUtc) || '—'}</div>
                </div>
                <div className="flex items-center space-x-3 flex-shrink-0">
                  <StatusPill status={o.orderStatus} />
                  <span className="text-[13px] font-black text-navy min-w-[52px] text-right">
                    {inr(o.grandTotal)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Design 12: ORDER DETAILS — summary, items, totals, actions
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
  const shipping = 0; // Sivakasi cracker deliveries are strictly Transport To-Pay on delivery
  const total = Math.max(0, subtotal - discount);
  return {
    id: raw?.id ?? raw?.orderId,
    orderNumber: raw?.orderNumber ?? fallbackNumber ?? '',
    status: raw?.orderStatus ?? raw?.status ?? 'Pending',
    placedAt: raw?.placedAtUtc ?? raw?.placedAt ?? raw?.createdAt,
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

export const ScreenOrderDetails: React.FC<NavProps & { orderId?: string; orderNumber?: string }> = ({
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
    <div className="font-sans bg-[#fbfbfb] p-4 pb-8 min-h-full">
      {loading ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-100 shadow-card">
          <Clock className="w-6 h-6 text-purple animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading order details...</p>
        </div>
      ) : !order ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-card space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <div>
            <p className="text-sm font-bold text-navy">Order not found</p>
            <p className="text-xs text-slate-500 mt-1">
              We could not load this order right now. Please try again from My Orders.
            </p>
          </div>
          <button
            onClick={() => onNavigate('my-orders')}
            className="px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold transition-colors"
          >
            Back to My Orders
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4 animate-fade-in">
          {/* Header: Order ID + status pill */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-black text-navy leading-snug break-all">
                Order ID: {order.orderNumber || '—'}
              </h2>
              <StatusPill status={order.status} />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Placed on {fmtDate(order.placedAt) || '—'}
            </p>
          </div>

          {/* Order Summary */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <h3 className="text-xs font-black text-navy">Order Summary</h3>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Payment Method</span>
              <span className="font-bold text-navy">{paymentMethodLabel(order.paymentMethod)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Payment Status</span>
              <StatusPill status={order.paymentStatus || 'Pending'} />
            </div>
          </div>

          {/* Items */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-black text-navy">Items</h3>
            {order.items.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                Item details are not available for this order.
              </p>
            ) : (
              order.items.map((it, idx) => (
                <div key={it.id || idx} className="flex items-center space-x-3">
                  {it.imageUrl ? (
                    <img
                      src={it.imageUrl}
                      alt={it.name}
                      className="w-11 h-11 rounded-lg object-cover border border-slate-100 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-purple/5 border border-purple/10 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-purple/60" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-navy truncate">{it.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Qty: {it.quantity}</div>
                  </div>
                  <div className="text-xs font-black text-navy flex-shrink-0">{inr(it.lineTotal)}</div>
                </div>
              ))
            )}
          </div>

          {/* Price summary */}
          <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Subtotal</span>
              <span className="font-bold text-navy">{inr(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Discount</span>
              <span className={`font-bold ${order.discount > 0 ? 'text-emerald-600' : 'text-navy'}`}>
                {order.discount > 0 ? `-${inr(order.discount)}` : inr(0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Delivery Charges</span>
              <span className="font-bold text-navy">
                {order.shipping > 0 ? inr(order.shipping) : 'FREE'}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-100 text-sm">
              <span className="font-black text-navy">Total Amount</span>
              <span className="font-black text-navy">{inr(order.total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 grid grid-cols-2 gap-3">
            <button
              onClick={handleDownloadInvoice}
              className="py-3 rounded-xl border border-slate-200 bg-white text-navy font-bold text-xs flex items-center justify-center space-x-1.5 hover:bg-slate-50 active:scale-98 transition-all"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Download Invoice</span>
            </button>
            <button
              onClick={() => onNavigate('track-order', { orderNumber: order.orderNumber })}
              className="py-3 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-glow-purple active:scale-98 transition-all"
            >
              <Truck className="w-4 h-4" />
              <span>Track Order</span>
            </button>
          </div>

          {/* Delivered orders: request a return, or jump to the existing one */}
          {order.status === 'Delivered' &&
            (existingReturn ? (
              <button
                onClick={() =>
                  onNavigate('return-status', {
                    returnId: existingReturn.id ?? existingReturn.returnNumber
                  })
                }
                className="w-full py-3 rounded-xl bg-purple/5 border border-purple/20 text-purple font-bold text-xs flex items-center justify-center space-x-1.5 active:scale-98 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Return in progress — View Return Status</span>
              </button>
            ) : (
              <button
                onClick={() =>
                  onNavigate('return-request', {
                    orderId: order.id ?? orderId,
                    orderNumber: order.orderNumber
                  })
                }
                className="w-full py-3 rounded-xl border border-purple/40 text-purple font-bold text-xs flex items-center justify-center space-x-1.5 hover:bg-purple/5 active:scale-98 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Request Return</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
