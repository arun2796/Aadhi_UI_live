import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Search,
  Truck
} from 'lucide-react';
import { api } from '../../services/api';
import { inrExact } from '../../utils/checkoutQuote';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import {
  CarrierTrackingCard,
  InvoiceActions,
  OrderNumberKeepsake,
  OrderUpdates,
  PaymentProofUpdateCard,
  RecentDeviceOrders,
  triggerFireworksConfetti,
  useEstimateOrder
} from '../../components/common/CommonComponents';
import { rememberOrderNumber } from '../../utils/guestOrders';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const fmtOrderDate = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ── Desktop design 10: HORIZONTAL 5-node timeline ── */
const TRACKING_STEPS: Array<{ label: string; statuses: string[] }> = [
  { label: 'Order Placed', statuses: ['pending', 'placed'] },
  { label: 'Confirmed', statuses: ['confirmed', 'processing', 'packed'] },
  { label: 'Shipped', statuses: ['shipped'] },
  { label: 'Out for Delivery', statuses: ['outfordelivery'] },
  { label: 'Delivered', statuses: ['delivered'] }
];

/** Map an order status string to the last completed timeline node index. */
const statusToStepIndex = (status: string): number => {
  const s = (status || '').toLowerCase().replace(/\s+/g, '');
  if (s === 'delivered') return 4;
  if (s === 'outfordelivery') return 3;
  if (s === 'shipped') return 2;
  if (s === 'confirmed' || s === 'processing' || s === 'packed') return 1;
  return 0; // Pending → Order Placed
};

/* ── Desktop design 9 handoff: CheckoutPage sets this right before navigating ── */
interface JustPlacedInfo {
  /** Order GUID — needed to re-submit payment proof for this order. */
  orderId?: string;
  orderNumber?: string;
  grandTotal?: number;
  /** Server-calculated packing charges on the created order. */
  packingCharges?: number;
  /** Percentage the server used for `packingCharges`. */
  packingChargePercent?: number;
  paymentMethod?: string;
  utrNumber?: string;
  /** True when the order was placed without signing in. */
  isGuest?: boolean;
}

const readJustPlacedFlag = (): JustPlacedInfo | null => {
  try {
    const raw = sessionStorage.getItem('aadhi_just_placed');
    if (!raw) return null;
    sessionStorage.removeItem('aadhi_just_placed');
    try {
      return JSON.parse(raw) as JustPlacedInfo;
    } catch {
      return {};
    }
  } catch {
    return null;
  }
};

interface TrackOrderPageProps {
  initialOrderNumber?: string;
  /** Order GUID, present only right after checkout (navigation params). */
  initialOrderId?: string;
  onNavigate: (page: string, params?: any) => void;
}

export const TrackOrderPage: React.FC<TrackOrderPageProps> = ({
  initialOrderNumber,
  initialOrderId,
  onNavigate
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { thankYouMessage } = useSettings();

  const [query, setQuery] = useState<string>(initialOrderNumber || '');
  const [order, setOrder] = useState<any | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Fresh order + session flag ⇒ show the design-9 success card first.
  const [justPlaced] = useState<JustPlacedInfo | null>(() =>
    initialOrderNumber ? readJustPlacedFlag() : null
  );
  const [showSuccess, setShowSuccess] = useState<boolean>(Boolean(justPlaced));

  useEffect(() => {
    if (justPlaced) {
      triggerFireworksConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialOrderNumber) {
      handleSearch(initialOrderNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderNumber]);

  const handleSearch = async (searchStr?: string) => {
    const q = searchStr || query;
    if (!q.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await api.trackOrder(q.trim());
      setOrder(res);
      // A number the API resolved is worth keeping on this device so a guest can
      // reach it again without retyping. Convenience only — see utils/guestOrders.
      if (res?.orderNumber) rememberOrderNumber(res.orderNumber);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  /* ── Normalized fields (tolerant to the tracking DTO variants) ── */
  const status: string = order?.orderStatus ?? order?.status ?? 'Pending';
  const placedAt: string | undefined = order?.placedAtUtc ?? order?.placedAt ?? order?.createdAt;
  const historyEntries: any[] = Array.isArray(order?.timeline)
    ? order.timeline
    : Array.isArray(order?.statusHistories)
    ? order.statusHistories
    : [];
  const shippingAddress = order?.shippingAddress;
  const orderItems: any[] = Array.isArray(order?.items) ? order.items : [];
  const totalAmount = Number(order?.grandTotal ?? order?.totalAmount ?? order?.total) || 0;
  const isCancelled = ['cancelled', 'returned'].includes((status || '').toLowerCase());
  const progressIdx = statusToStepIndex(status);
  const packingCharges = Number(order?.packingCharges ?? order?.packingCharge) || 0;
  const packingChargePercent = Number(order?.packingChargePercent) || 0;
  const carrierName: string = order?.carrierName ?? order?.carrier ?? '';
  const trackingNumber: string = order?.trackingNumber ?? order?.lrNumber ?? '';
  // Transport office contact — the anonymous tracking DTO carries these too, and a
  // guest has no My Orders, so this screen is their only route to them.
  const carrierPhone: string = order?.carrierPhone ?? '';
  const carrierAddress: string = order?.carrierAddress ?? '';

  /** Date a given timeline node was reached, from the status history. */
  const dateForStep = (stepIdx: number): string => {
    const step = TRACKING_STEPS[stepIdx];
    for (const h of historyEntries) {
      const to = String(h?.toStatus ?? h?.status ?? '').toLowerCase().replace(/\s+/g, '');
      if (step.statuses.includes(to)) {
        const dt = fmtOrderDate(h?.changedAtUtc ?? h?.date ?? h?.changedAt);
        if (dt) return dt;
      }
    }
    if (stepIdx === 0) return fmtOrderDate(placedAt);
    return '';
  };

  const successOrderNumber = justPlaced?.orderNumber || initialOrderNumber || order?.orderNumber || '';
  const successOrderId = justPlaced?.orderId || initialOrderId || '';
  // Guests have no My Orders, so the confirmation screen has to carry more weight.
  const placedAsGuest = justPlaced?.isGuest ?? !user;
  const successIsUpi = (justPlaced?.paymentMethod || '') === 'UPI' || Boolean(justPlaced?.utrNumber);
  const successTotal = justPlaced?.grandTotal || totalAmount;
  // Packing charges as the SERVER calculated them on the created order.
  const successPacking = Number(justPlaced?.packingCharges ?? packingCharges) || 0;
  const successPackingPercent = Number(justPlaced?.packingChargePercent ?? packingChargePercent) || 0;
  const rewardPoints = Math.floor(successTotal / 100);

  /* The ESTIMATE, for both states of this page: the confirmation card (so a guest
     can keep their invoice the moment they have paid) and the tracking view (their
     only route back to it afterwards).

     Sources, best first: the tracking payload already loaded here, the checkout
     snapshot this device kept, then a one-off tracking fetch. On the confirmation
     card the charges the SERVER confirmed on the created order win. It all resolves
     during render — nothing is awaited inside the click, which is what keeps the
     print window from being blocked. */
  const estimateOrder = useEstimateOrder(
    order?.orderNumber || successOrderNumber || initialOrderNumber,
    order,
    showSuccess
      ? {
          grandTotal: justPlaced?.grandTotal || undefined,
          packingCharges: justPlaced?.packingCharges || undefined,
          packingChargePercent: justPlaced?.packingChargePercent || undefined
        }
      : undefined
  );

  /* ═══════════ Desktop design 9: ORDER SUCCESS ═══════════ */
  if (showSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-14">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center shadow-card space-y-6 animate-scale-up">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <Check className="w-10 h-10 stroke-[3]" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-3xl font-black text-navy">Thank You!</h1>
            <p className="text-sm text-slate-500">
              {thankYouMessage || 'Your order has been placed successfully.'}
            </p>
          </div>

          {/* The order number, large and copyable. For a guest it is the ONLY
              handle on this order, so it carries the "save this" instruction. */}
          <OrderNumberKeepsake
            orderNumber={successOrderNumber}
            isGuest={placedAsGuest}
            className="max-w-md mx-auto"
          />

          {/* The customer's copy of the ESTIMATE, offered the moment they have paid.
              A guest has no My Orders to fetch it from later, so this is where they
              keep it. */}
          <InvoiceActions
            order={estimateOrder}
            layout="row"
            className="max-w-md mx-auto text-left"
            hint="Your estimate for this order — print it or save a copy now."
          />

          {/* Server-confirmed amounts for the placed order */}
          {successTotal > 0 && (
            <div className="max-w-md mx-auto text-left rounded-2xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
              {successPacking > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>
                    Packing Charges
                    {successPackingPercent > 0 ? ` (${successPackingPercent}%)` : ''}
                  </span>
                  <span className="font-bold text-slate-800">{inr(successPacking)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span className="font-black text-navy text-sm">Order Total</span>
                <span className="font-black text-purple text-sm">{inrExact(successTotal)}</span>
              </div>
            </div>
          )}

          <div className="max-w-md mx-auto text-left space-y-2.5">
            <div className="flex items-start space-x-2 text-xs text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                {placedAsGuest ? (
                  <>
                    We will call or message you on the mobile number on your delivery address with
                    updates.
                  </>
                ) : (
                  <>
                    A confirmation has been sent to{' '}
                    <strong className="text-navy">{user?.email || 'your registered contact'}</strong>.
                  </>
                )}
              </span>
            </div>
            {rewardPoints > 0 && !placedAsGuest && (
              <div className="flex items-start space-x-2 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  You will earn <strong className="text-navy">{rewardPoints} reward points</strong> once the order is delivered.
                </span>
              </div>
            )}
          </div>

          {/* UPI proof can be corrected without an account — the API accepts an
              anonymous submission that carries the matching order number. */}
          {successIsUpi && successOrderId && successOrderNumber && (
            <div className="max-w-md mx-auto">
              <PaymentProofUpdateCard
                orderId={successOrderId}
                orderNumber={successOrderNumber}
                currentUtr={justPlaced?.utrNumber}
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() =>
                successOrderNumber
                  ? onNavigate('track-order', { orderNumber: successOrderNumber })
                  : setShowSuccess(false)
              }
              className="px-8 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs uppercase tracking-wider shadow-glow-purple transition-colors flex items-center justify-center space-x-1.5"
            >
              <Truck className="w-4 h-4" />
              <span>Track This Order</span>
            </button>
            <button
              onClick={() => onNavigate('shop')}
              className="px-8 py-3 rounded-xl border border-slate-300 bg-white text-slate-600 hover:text-navy hover:border-navy font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Continue Shopping
            </button>
          </div>

          {placedAsGuest && successOrderNumber && (
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-md mx-auto">
              Bookmark <span className="font-mono text-slate-500">/track/{successOrderNumber}</span> to
              come straight back to this order.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════ Desktop design 10: ORDER TRACKING ═══════════ */
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Title + search prompt (shown until an order is loaded) */}
      {!order && (
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1 text-xs font-bold text-orange uppercase tracking-wider">
            <Truck className="w-4 h-4" />
            <span>Live Tracking Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy">Track Your Order</h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Enter your Order Number (e.g. <strong>ORD-2026-001248</strong>) or your registered 10-digit mobile number.
          </p>
        </div>
      )}

      {/* Search input */}
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-2.5 shadow-sm">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Order ID (e.g. ORD-2026-001248) or Mobile"
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-glow"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? 'Searching...' : 'Track'}</span>
          </button>
        </form>
      </div>

      {/* Orders placed from this browser — the only "order list" a guest has.
          Renders nothing when storage is unavailable or empty. */}
      {!order && (
        <div className="max-w-xl mx-auto">
          <RecentDeviceOrders
            onTrack={(orderNumber) => {
              setQuery(orderNumber);
              handleSearch(orderNumber);
            }}
          />
        </div>
      )}

      {order ? (
        <div className="space-y-6 animate-fade-in">
          {/* ── Order header + horizontal timeline ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-5 border-b border-slate-100">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-navy">
                  Order ID: {order.orderNumber || query.trim()}
                </h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  Placed on {fmtOrderDate(placedAt) || 'Recently'}
                </div>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-3">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                    isCancelled
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {status}
                </span>
                {/* Invoice — a guest's only route back to their estimate is this screen. */}
                <InvoiceActions order={estimateOrder} layout="row" />
              </div>
            </div>

            {isCancelled && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>This order was {status.toLowerCase()}.</span>
              </div>
            )}

            {/* Horizontal 5-node timeline: green completed nodes + connectors, gray pending */}
            <div className="overflow-x-auto pb-1">
              <div className="flex items-start min-w-[560px]">
                {TRACKING_STEPS.map((stepDef, idx) => {
                  const completed = !isCancelled && idx <= progressIdx;
                  const prevCompleted = !isCancelled && idx - 1 <= progressIdx && idx > 0;
                  const stepDate = dateForStep(idx);

                  return (
                    <React.Fragment key={stepDef.label}>
                      {idx > 0 && (
                        <div
                          className={`flex-1 h-1 rounded mt-[14px] ${
                            completed && prevCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        />
                      )}
                      <div className="flex flex-col items-center w-24 flex-shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            completed
                              ? 'bg-emerald-500 text-white ring-4 ring-emerald-100'
                              : 'bg-white border-2 border-slate-300 text-slate-300'
                          }`}
                        >
                          {completed ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                          )}
                        </div>
                        <div
                          className={`text-[11px] font-bold mt-2 text-center leading-tight ${
                            completed ? 'text-navy' : 'text-slate-400'
                          }`}
                        >
                          {stepDef.label}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 text-center min-h-[14px]">
                          {stepDate}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Carrier + LR / waybill: how the customer collects the parcel ── */}
          <CarrierTrackingCard
            carrierName={carrierName}
            trackingNumber={trackingNumber}
            carrierPhone={carrierPhone}
            carrierAddress={carrierAddress}
          />

          {/* ── This order's updates, read anonymously by order number ──
              A guest has no account and no bell, so this is how they learn what
              has happened — above all which transport office to collect from.
              The shipment card is suppressed when the order above already shows
              it, so the transport details are stated once, not twice. */}
          <OrderUpdates
            orderNumber={order.orderNumber || query.trim()}
            showCarrierDetails={!carrierName && !trackingNumber}
          />

          {/* ── Delivery Address + Need Help ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-black text-navy text-sm flex items-center space-x-1.5">
                  <MapPin className="w-4 h-4 text-orange" />
                  <span>Delivery Address</span>
                </div>
                <button
                  onClick={() => showToast('Map view coming soon', 'info')}
                  className="text-xs font-bold text-purple hover:text-purple-dark"
                >
                  View on Map
                </button>
              </div>
              {shippingAddress ? (
                <div className="text-slate-600 leading-relaxed">
                  <div className="font-bold text-slate-800">{shippingAddress.fullName}</div>
                  <div>
                    {[shippingAddress.addressLine1, shippingAddress.addressLine2].filter(Boolean).join(', ')}
                  </div>
                  <div>
                    {[shippingAddress.city, shippingAddress.state].filter(Boolean).join(', ')}
                    {shippingAddress.postalCode ? ` - ${shippingAddress.postalCode}` : ''}
                  </div>
                  {shippingAddress.phone && <div className="mt-1">Ph: {shippingAddress.phone}</div>}
                </div>
              ) : (
                <div className="text-slate-600 leading-relaxed">
                  {order.deliveryAddressSummary || 'Delivery to your registered address'}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
              <div className="font-black text-navy text-sm">Need Help?</div>
              <p className="text-slate-500 leading-relaxed">
                Questions about your order, delivery, or payment? Our support team is happy to help.
              </p>
              <button
                onClick={() => onNavigate('contact')}
                className="px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs flex items-center space-x-1.5 shadow-glow-purple transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>Contact Support</span>
              </button>
            </div>
          </div>

          {/* ── Items in this order ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-black text-navy text-sm">Items in this order</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {orderItems.length > 0 ? (
                orderItems.map((i: any, idx: number) => {
                  const name = i.productName || i.productNameSnapshot || i.name || 'Item';
                  const qty = Number(i.quantity) || 1;
                  const unit = Number(i.unitPrice ?? i.price) || 0;
                  const line = Number(i.lineTotal) || unit * qty;
                  return (
                    <div key={i.id || i.productId || idx} className="px-5 py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3 min-w-0">
                        {i.imageUrl && (
                          <img
                            src={i.imageUrl}
                            alt={name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-100 flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-navy truncate">{name}</div>
                          <div className="text-[10px] text-slate-400">
                            Qty: {qty}{unit > 0 ? ` × ${inr(unit)}` : ''}
                          </div>
                        </div>
                      </div>
                      {line > 0 && <div className="font-bold text-navy flex-shrink-0 ml-3">{inr(line)}</div>}
                    </div>
                  );
                })
              ) : (
                <div className="px-5 py-4 text-xs text-slate-500">
                  Festive assorted fireworks pack
                </div>
              )}
            </div>
            {packingCharges > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  Packing Charges
                  {packingChargePercent > 0 ? ` (${packingChargePercent}%)` : ''}
                </span>
                <span className="font-bold text-navy">{inrExact(packingCharges)}</span>
              </div>
            )}
            {totalAmount > 0 && (
              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-black text-navy">Total Amount</span>
                <span className="text-base font-black text-navy">{inrExact(totalAmount)}</span>
              </div>
            )}
          </div>
        </div>
      ) : hasSearched && !loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-orange mx-auto" />
          <h3 className="font-bold text-base text-navy">No order found for "{query}"</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Please verify your Order Number (e.g. ORD-2026-001248) or phone number and try again.
          </p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3">
          <Clock className="w-6 h-6 text-purple animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Fetching your order status...</p>
        </div>
      ) : null}
    </div>
  );
};
