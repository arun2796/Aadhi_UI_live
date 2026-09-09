import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  FileText,
  Package,
  PackageSearch,
  Truck
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { CarrierTrackingCard } from '../common/CommonComponents';
import { buildEstimateHtml, buildInvoiceBranding } from '../../utils/invoiceTemplate';
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
              <div key={o.id || o.orderNumber}>
                <button
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
                {/* Carrier + LR / waybill once the parcel has been handed over */}
                {(o.carrierName || o.trackingNumber) && (
                  <div className="px-4 pb-4 -mt-1">
                    <CarrierTrackingCard
                      carrierName={o.carrierName}
                      trackingNumber={o.trackingNumber}
                      compact
                    />
                  </div>
                )}
              </div>
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
  sku?: string;
  code?: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  /** Catalogue rate before discount, when the API carries one (printed as Rate/Qty on the estimate). */
  mrp?: number;
  /** Line-level discount in ₹, when the API carries one. */
  discount?: number;
  lineTotal: number;
}

interface OrderView {
  id?: string;
  orderNumber: string;
  status: string;
  placedAt?: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: any;
  paymentMethod?: string | number;
  paymentStatus?: string;
  items: OrderItemView[];
  subtotal: number;
  discount: number;
  /** Server-calculated packing charges (₹); 0 when the order carries none. */
  packingCharges: number;
  /** Percentage the server used for `packingCharges`; 0 when absent. */
  packingChargePercent: number;
  /** GST / tax amount (₹); 0 when the order carries none. */
  tax: number;
  /** Transport company the parcel was handed to. */
  carrierName?: string;
  /** LR / waybill number for parcel collection. */
  trackingNumber?: string;
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
      // Real MRP / discount when the API sends them — the estimate falls back to the
      // shop's 80%-off catalogue convention only when both are absent.
      mrp: Number(it?.mrp ?? it?.compareAtPrice ?? it?.originalPrice) || undefined,
      discount: Number(it?.discount) || undefined,
      lineTotal: Number(it?.lineTotal) || unit * qty
    };
  });
  const subtotal =
    Number(raw?.itemsSubtotal ?? raw?.subtotal) ||
    items.reduce((sum, it) => sum + it.lineTotal, 0);
  const discount = Number(raw?.discount) || 0;
  // Packing charges come from the server; percent is shown next to the amount.
  const packingCharges = Number(raw?.packingCharges ?? raw?.packingCharge) || 0;
  const packingChargePercent = Number(raw?.packingChargePercent) || 0;
  const tax = Number(raw?.tax) || 0;
  // The server's grandTotal already includes packing charges — prefer it.
  const serverTotal = Number(raw?.grandTotal ?? raw?.totalAmount) || 0;
  const total =
    serverTotal > 0 ? serverTotal : Math.max(0, subtotal - discount + tax + packingCharges);
  return {
    id: raw?.id ?? raw?.orderId,
    orderNumber: raw?.orderNumber ?? fallbackNumber ?? '',
    status: raw?.orderStatus ?? raw?.status ?? 'Pending',
    placedAt: raw?.placedAtUtc ?? raw?.placedAt ?? raw?.createdAt,
    customerName: raw?.customerName || raw?.shippingAddress?.fullName || 'Valued Customer',
    customerPhone: raw?.customerPhone || raw?.shippingAddress?.phone || '',
    shippingAddress: raw?.shippingAddress,
    paymentMethod: raw?.paymentMethod,
    paymentStatus: raw?.paymentStatus,
    items,
    subtotal,
    discount,
    packingCharges,
    packingChargePercent,
    tax,
    carrierName: raw?.carrierName ?? raw?.carrier ?? undefined,
    trackingNumber: raw?.trackingNumber ?? raw?.lrNumber ?? undefined,
    total
  };
};

export const ScreenOrderDetails: React.FC<NavProps & { orderId?: string; orderNumber?: string }> = ({
  onNavigate,
  orderId,
  orderNumber
}) => {
  const { showToast } = useToast();
  const settings = useSettings();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);

  /** Live letterhead + bank block from Store.* / Payment.* settings (constants until loaded). */
  const branding = useMemo(() => buildInvoiceBranding(settings), [settings]);

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

  const handleDownloadInvoice = () => {
    if (!order) return;
    const w = window.open('', '_blank', 'width=820,height=940');
    if (!w) {
      showToast('Please allow pop-ups to download the invoice.', 'warning');
      return;
    }
    w.document.write(buildEstimateHtml(order, branding));
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

          {/* Carrier + LR / waybill — how the customer collects the parcel */}
          {(order.carrierName || order.trackingNumber) && (
            <CarrierTrackingCard
              carrierName={order.carrierName}
              trackingNumber={order.trackingNumber}
              compact
            />
          )}

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
            {order.packingCharges > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">
                  Packing Charges
                  {order.packingChargePercent > 0 ? ` (${order.packingChargePercent}%)` : ''}
                </span>
                <span className="font-bold text-navy">{inr(order.packingCharges)}</span>
              </div>
            )}
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
        </div>
      )}
    </div>
  );
};
