import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Clock, Minus, Plus, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface NavProps {
  onNavigate: (page: string, params?: any) => void;
}

/* ── Shared helpers (kept in sync with ScreenOrdersAndDetails.tsx) ── */

const inr = (n?: number) =>
  '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const fmtDate = (d?: string) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const pillClass = (s?: string): string => {
  const v = (s || '').toLowerCase();
  if (['completed', 'refunded', 'approved', 'success'].includes(v)) return 'bg-emerald-100 text-emerald-700';
  if (['pending', 'initiated', 'processing', 'refundpending'].includes(v)) return 'bg-amber-100 text-amber-700';
  if (['rejected', 'failed', 'cancelled'].includes(v)) return 'bg-red-100 text-red-600';
  return 'bg-slate-100 text-slate-600';
};

const StatusPill: React.FC<{ status?: string }> = ({ status }) => (
  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap ${pillClass(status)}`}>
    {status || '—'}
  </span>
);

/** Normalizes refund-record status strings into the design's pill labels. */
const refundStatusLabel = (s?: string): string => {
  const v = (s || '').toLowerCase();
  if (v.includes('complete') || v === 'refunded' || v.includes('success')) return 'Completed';
  if (v.includes('fail') || v.includes('reject') || v.includes('cancel')) return 'Failed';
  if (!s || v.includes('pending') || v.includes('initiat') || v.includes('process')) return 'Pending';
  return s || 'Pending';
};

/* ── Return picking / timeline synthesis (API_CONTRACTS_PHASE1.md §6) ── */

const RETURN_STEPS = [
  'Request Received',
  'Approved',
  'Product Picked Up',
  'Refund Initiated',
  'Refund Completed'
] as const;

/** Maps a backend return/timeline status string onto a canonical step index (-2 = rejected). */
const stepIndexFor = (raw?: string): number => {
  const v = (raw || '').toLowerCase();
  if (!v) return -1;
  if (v.includes('reject') || v.includes('cancel')) return -2;
  if (v.includes('refund')) {
    return v.includes('complete') || v === 'refunded' || v.includes('success') ? 4 : 3;
  }
  if (v.includes('approv')) return 1;
  if (v.includes('request') || v.includes('pending') || v.includes('created')) return 0;
  if (v.includes('pick') || v.includes('inspect') || v.includes('received') || v.includes('collect')) return 2;
  return -1;
};

const sortByNewest = (arr: any[]): any[] =>
  [...arr].sort(
    (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
  );

/** Finds the return matching returnId (by id or returnNumber), else the latest one. */
const pickReturn = (list: any[], returnId?: string): any | null => {
  const arr = Array.isArray(list) ? list : [];
  if (returnId) {
    const match = arr.find(r => r?.id === returnId || r?.returnNumber === returnId);
    if (match) return match;
  }
  return sortByNewest(arr)[0] ?? null;
};

interface TimelineView {
  doneIdx: number;
  dates: (string | undefined)[];
  rejected: boolean;
}

/** Builds the 5-step timeline from the API timeline array, falling back to status + refund. */
const buildTimeline = (ret: any): TimelineView => {
  const dates: (string | undefined)[] = [undefined, undefined, undefined, undefined, undefined];
  let doneIdx = -1;
  let rejected = false;
  if (!ret) return { doneIdx, dates, rejected };

  for (const e of Array.isArray(ret.timeline) ? ret.timeline : []) {
    const idx = stepIndexFor(e?.status);
    if (idx === -2) {
      rejected = true;
      continue;
    }
    if (idx < 0) continue;
    if (e?.date && !dates[idx]) dates[idx] = e.date;
    if (e?.completed !== false && idx > doneIdx) doneIdx = idx;
  }

  const statusIdx = stepIndexFor(ret.status);
  if (statusIdx === -2) rejected = true;
  else if (statusIdx > doneIdx) doneIdx = statusIdx;

  if (ret.refund) {
    const refundIdx = refundStatusLabel(ret.refund.status) === 'Completed' ? 4 : 3;
    if (refundIdx > doneIdx) doneIdx = refundIdx;
    if (ret.refund.processedAt && !dates[refundIdx]) dates[refundIdx] = ret.refund.processedAt;
  }

  // A return record exists, so the request was at least received.
  if (doneIdx < 0) doneIdx = 0;
  if (!dates[0] && ret.createdAt) dates[0] = ret.createdAt;
  return { doneIdx, dates, rejected };
};

/* ── Small shared UI states ── */

const LoadingCard: React.FC<{ text: string }> = ({ text }) => (
  <div className="p-10 text-center bg-white rounded-2xl border border-slate-100 shadow-card">
    <Clock className="w-6 h-6 text-purple animate-spin mx-auto mb-2" />
    <p className="text-xs text-slate-500 font-medium">{text}</p>
  </div>
);

const EmptyCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}> = ({ icon, title, message, actionLabel, onAction }) => (
  <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-card space-y-3 animate-fade-in">
    {icon}
    <div>
      <p className="text-sm font-bold text-navy">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{message}</p>
    </div>
    <button
      onClick={onAction}
      className="px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold transition-colors"
    >
      {actionLabel}
    </button>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   Design 23: RETURN REQUEST — select items, reason, submit
   ═══════════════════════════════════════════════════════════════ */

const RETURN_REASONS = ['Damaged product', 'Wrong item delivered', 'Quality issue', 'Other'];

interface ReturnableItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface ReturnOrderView {
  id?: string;
  orderNumber: string;
  items: ReturnableItem[];
}

const normalizeReturnOrder = (raw: any, fallbackNumber?: string): ReturnOrderView => ({
  id: raw?.id ?? raw?.orderId,
  orderNumber: raw?.orderNumber ?? fallbackNumber ?? '',
  items: (Array.isArray(raw?.items) ? raw.items : []).map((it: any) => {
    const qty = Number(it?.quantity) || 1;
    const unit = Number(it?.unitPrice ?? it?.price) || 0;
    return {
      id: it?.id ?? it?.orderItemId,
      name: it?.productName ?? it?.name ?? 'Item',
      quantity: qty,
      unitPrice: unit,
      lineTotal: Number(it?.lineTotal) || unit * qty
    };
  })
});

/** Design 23: Return Request — select items to return, reason dropdown, Submit Request. */
export const ScreenReturnRequest: React.FC<NavProps & { orderId?: string; orderNumber?: string }> = ({
  onNavigate,
  orderId,
  orderNumber
}) => {
  const { showToast } = useToast();
  const [order, setOrder] = useState<ReturnOrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Selected items: orderItemId → quantity to return.
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let raw: any = null;
        if (orderId) raw = await api.getOrderById(orderId);
        if (!raw && orderNumber) raw = await api.trackOrder(orderNumber);
        if (!cancelled) setOrder(raw ? normalizeReturnOrder(raw, orderNumber) : null);
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

  const toggleItem = (it: ReturnableItem) => {
    const id = it.id;
    if (!id) return;
    setSelections(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = it.quantity;
      return next;
    });
  };

  const stepQty = (id: string, delta: number, max: number) => {
    setSelections(prev => ({
      ...prev,
      [id]: Math.min(max, Math.max(1, (prev[id] ?? 1) + delta))
    }));
  };

  const handleSubmit = async () => {
    if (!order || submitting) return;
    const items = Object.entries(selections).map(([orderItemId, quantity]) => ({
      orderItemId,
      quantity
    }));
    if (items.length === 0) {
      showToast('Please select at least one item to return.', 'warning');
      return;
    }
    if (!reason) {
      showToast('Please select a reason for the return.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createReturn({
        orderId: order.id ?? orderId ?? '',
        reason,
        comments: comments.trim() || undefined,
        items
      });
      showToast('Return request submitted successfully.', 'success');
      const newReturnId = res?.id ?? res?.returnNumber;
      if (newReturnId) onNavigate('return-status', { returnId: newReturnId });
      else onNavigate('my-orders');
    } catch {
      showToast('Could not submit your return request. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="font-sans bg-[#fbfbfb] p-4 pb-8 min-h-full">
      {loading ? (
        <LoadingCard text="Loading order items..." />
      ) : !order || order.items.length === 0 ? (
        <EmptyCard
          icon={<AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />}
          title={!order ? 'Order not found' : 'No returnable items'}
          message={
            !order
              ? 'We could not load this order right now. Please try again from My Orders.'
              : 'Item details are not available for this order. Please contact support for help with your return.'
          }
          actionLabel="Back to My Orders"
          onAction={() => onNavigate('my-orders')}
        />
      ) : (
        <div className="space-y-4 animate-fade-in">
          {order.orderNumber && (
            <p className="text-[11px] text-slate-500 px-0.5">
              Order <span className="font-bold text-navy">{order.orderNumber}</span>
            </p>
          )}

          {/* Select items to return */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black text-navy px-0.5">Select items to return</h3>
            {order.items.map((it, idx) => {
              const selected = !!it.id && !!selections[it.id];
              const selQty = it.id ? (selections[it.id] ?? it.quantity) : it.quantity;
              return (
                <div
                  key={it.id || idx}
                  onClick={() => toggleItem(it)}
                  className={`flex items-center p-4 bg-white rounded-2xl border shadow-card transition-colors ${
                    it.id ? 'cursor-pointer active:bg-slate-50' : 'opacity-60'
                  } ${selected ? 'border-purple/40' : 'border-slate-100'}`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selected ? 'bg-purple border-purple' : 'bg-white border-slate-300'
                    }`}
                  >
                    {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </div>

                  <div className="flex-1 min-w-0 ml-3">
                    <div className="text-xs font-bold text-navy truncate">{it.name}</div>
                    {selected && it.quantity > 1 ? (
                      <div className="flex items-center mt-1.5 space-x-2">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            stepQty(it.id as string, -1, it.quantity);
                          }}
                          className="w-6 h-6 rounded-md border border-slate-200 bg-white flex items-center justify-center text-navy active:bg-slate-50"
                          aria-label="Decrease return quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] font-black text-navy w-4 text-center">{selQty}</span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            stepQty(it.id as string, 1, it.quantity);
                          }}
                          className="w-6 h-6 rounded-md border border-slate-200 bg-white flex items-center justify-center text-navy active:bg-slate-50"
                          aria-label="Increase return quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-slate-400 font-medium">of {it.quantity}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 mt-0.5">Qty: {it.quantity}</div>
                    )}
                  </div>

                  <div className="text-xs font-black text-navy ml-2 flex-shrink-0">
                    {inr(selected ? it.unitPrice * selQty : it.lineTotal)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reason for Return */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black text-navy px-0.5">Reason for Return</h3>
            <div className="relative">
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className={`w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-3.5 pr-10 text-xs font-semibold focus:outline-none focus:border-purple shadow-card transition-colors ${
                  reason ? 'text-navy' : 'text-slate-400'
                }`}
              >
                <option value="" disabled>
                  Select reason
                </option>
                {RETURN_REASONS.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder="Additional comments (optional)"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-navy placeholder:text-slate-400 focus:outline-none focus:border-purple shadow-card resize-none"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-sm shadow-glow-purple active:scale-98 transition-all disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Design 24: RETURN STATUS — RET id + green step timeline
   ═══════════════════════════════════════════════════════════════ */

/** Design 24: Return Status — RET id + green step timeline (Request Received → Approved → Product Picked Up → Refund Initiated → Refund Completed). */
export const ScreenReturnStatus: React.FC<NavProps & { returnId?: string }> = ({
  onNavigate,
  returnId
}) => {
  const [ret, setRet] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyReturns()
      .then(list => {
        if (!cancelled) setRet(pickReturn(list, returnId));
      })
      .catch(() => {
        if (!cancelled) setRet(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [returnId]);

  const { doneIdx, dates, rejected } = useMemo(() => buildTimeline(ret), [ret]);

  return (
    <div className="font-sans bg-[#fbfbfb] p-4 pb-8 min-h-full">
      {loading ? (
        <LoadingCard text="Loading return status..." />
      ) : !ret ? (
        <EmptyCard
          icon={<RotateCcw className="w-10 h-10 text-slate-300 mx-auto" />}
          title="No return found"
          message="You have no return requests yet. You can request a return from a delivered order."
          actionLabel="Go to My Orders"
          onAction={() => onNavigate('my-orders')}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-5 animate-fade-in">
          {/* Header: Return ID */}
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-black text-navy leading-snug break-all">
              Return ID: {ret.returnNumber || ret.id || '—'}
            </h2>
            {rejected && <StatusPill status="Rejected" />}
          </div>

          {rejected && (
            <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-600 font-medium leading-relaxed">
                This return request was rejected. Please contact support if you need more details.
              </p>
            </div>
          )}

          {/* Green vertical step timeline */}
          <div>
            {RETURN_STEPS.map((step, i) => {
              const done = i <= doneIdx && !(rejected && i > 0);
              const lineDone = i + 1 <= doneIdx && !(rejected && i + 1 > 0);
              return (
                <div key={step} className="flex">
                  <div className="flex flex-col items-center mr-3.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        done ? 'bg-emerald-500' : 'bg-white border-2 border-slate-200'
                      }`}
                    >
                      {done && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>
                    {i < RETURN_STEPS.length - 1 && (
                      <div
                        className={`w-0.5 flex-1 min-h-[24px] my-1 rounded-full ${
                          lineDone ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                  <div
                    className={`flex-1 flex items-start justify-between pt-1 ${
                      i < RETURN_STEPS.length - 1 ? 'pb-6' : ''
                    }`}
                  >
                    <span
                      className={`text-xs ${
                        done ? 'font-bold text-navy' : 'font-semibold text-slate-400'
                      }`}
                    >
                      {step}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium flex-shrink-0 ml-2">
                      {done ? fmtDate(dates[i]) : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* View Refund Status */}
          {!rejected && (
            <div className="pt-4 border-t border-slate-100 text-center">
              <button
                onClick={() =>
                  onNavigate('refund-status', {
                    returnId: ret.id ?? ret.returnNumber ?? returnId
                  })
                }
                className="text-xs font-bold text-purple hover:text-purple-dark transition-colors"
              >
                View Refund Status
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Design 25: REFUND STATUS — refund id, status, date, amount, method
   ═══════════════════════════════════════════════════════════════ */

/** Finds the return whose refund matches refundId, else by returnId, else the latest refunded one. */
const pickReturnForRefund = (list: any[], returnId?: string, refundId?: string): any | null => {
  const arr = Array.isArray(list) ? list : [];
  if (refundId) {
    const match = arr.find(
      r => r?.refund && (r.refund.refundNumber === refundId || r.refund.id === refundId)
    );
    if (match) return match;
  }
  if (returnId) {
    const match = arr.find(r => r?.id === returnId || r?.returnNumber === returnId);
    if (match) return match;
  }
  const sorted = sortByNewest(arr);
  return sorted.find(r => r?.refund) ?? sorted[0] ?? null;
};

/** Design 25: Refund Status — refund id, status, date, amount, refunded-to, Contact Support. */
export const ScreenRefundStatus: React.FC<NavProps & { returnId?: string; refundId?: string }> = ({
  onNavigate,
  returnId,
  refundId
}) => {
  const [ret, setRet] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyReturns()
      .then(list => {
        if (!cancelled) setRet(pickReturnForRefund(list, returnId, refundId));
      })
      .catch(() => {
        if (!cancelled) setRet(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [returnId, refundId]);

  const refund = ret?.refund;
  const statusText = refundStatusLabel(refund?.status);

  const supportFooter = (
    <div className="pt-4 border-t border-slate-100 text-center space-y-1.5">
      <p className="text-xs font-black text-navy">Need Help?</p>
      <button
        onClick={() => onNavigate('contact')}
        className="text-xs font-bold text-purple hover:text-purple-dark transition-colors"
      >
        Contact Support
      </button>
    </div>
  );

  return (
    <div className="font-sans bg-[#fbfbfb] p-4 pb-8 min-h-full">
      {loading ? (
        <LoadingCard text="Loading refund status..." />
      ) : !ret ? (
        <EmptyCard
          icon={<AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />}
          title="No refund found"
          message="We could not find any refunds for your account. Refunds appear here after a return is processed."
          actionLabel="Go to My Orders"
          onAction={() => onNavigate('my-orders')}
        />
      ) : !refund ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-card space-y-3 animate-fade-in">
          <Clock className="w-8 h-8 text-amber-500 mx-auto" />
          <div>
            <p className="text-sm font-bold text-navy">Refund not initiated yet</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Your refund will appear here once your return
              {ret.returnNumber ? ` (${ret.returnNumber})` : ''} is approved and the product is
              picked up.
            </p>
          </div>
          <button
            onClick={() =>
              onNavigate('return-status', { returnId: ret.id ?? ret.returnNumber ?? returnId })
            }
            className="px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold transition-colors"
          >
            View Return Status
          </button>
          {supportFooter}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4 animate-fade-in">
          {/* Header: Refund ID */}
          <h2 className="text-sm font-black text-navy leading-snug break-all">
            Refund ID: {refund.refundNumber || refundId || '—'}
          </h2>

          {/* Detail rows */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Refund Status</span>
              <StatusPill status={statusText} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Refund Date</span>
              <span className="font-bold text-navy">
                {fmtDate(refund.processedAt) || (statusText === 'Pending' ? 'Pending' : '—')}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Refund Amount</span>
              <span className="font-black text-navy">{inr(refund.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Refunded To</span>
              <span className="font-bold text-navy text-right break-all ml-3">
                {refund.method || '—'}
              </span>
            </div>
          </div>

          {supportFooter}
        </div>
      )}
    </div>
  );
};
