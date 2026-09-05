import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Plus,
  RotateCcw,
  Wallet
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

/* ── Shared helpers (kept in sync with components/mobile/ScreenReturns.tsx) ── */

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
  if (['completed', 'refunded', 'approved', 'success'].includes(v))
    return 'bg-emerald-100 text-emerald-700';
  if (['pending', 'initiated', 'processing', 'refundpending', 'requested'].includes(v))
    return 'bg-amber-100 text-amber-700';
  if (['rejected', 'failed', 'cancelled'].includes(v)) return 'bg-red-100 text-red-600';
  return 'bg-slate-100 text-slate-600';
};

const StatusPill: React.FC<{ status?: string }> = ({ status }) => (
  <span
    className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${pillClass(status)}`}
  >
    {status || '—'}
  </span>
);

/** Normalizes refund-record status strings into the design's pill labels. */
const refundStatusLabel = (s?: string): string => {
  const v = (s || '').toLowerCase();
  if (v.includes('complete') || v === 'refunded' || v.includes('success')) return 'Completed';
  if (v.includes('fail') || v.includes('reject') || v.includes('cancel')) return 'Failed';
  if (!s || v.includes('pending') || v.includes('initiat') || v.includes('process'))
    return 'Pending';
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
  if (v.includes('pick') || v.includes('inspect') || v.includes('received') || v.includes('collect'))
    return 2;
  return -1;
};

const sortByNewest = (arr: any[]): any[] =>
  [...arr].sort(
    (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
  );

/** Finds the return matching returnId (by id or returnNumber), else null. */
const findReturn = (list: any[], returnId?: string): any | null => {
  const arr = Array.isArray(list) ? list : [];
  if (returnId) {
    const match = arr.find(r => r?.id === returnId || r?.returnNumber === returnId);
    if (match) return match;
  }
  return null;
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

const LoadingBlock: React.FC<{ text: string }> = ({ text }) => (
  <div className="p-16 text-center">
    <Clock className="w-7 h-7 text-purple animate-spin mx-auto mb-3" />
    <p className="text-sm text-slate-500 font-medium">{text}</p>
  </div>
);

const EmptyBlock: React.FC<{
  icon: React.ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, message, actionLabel, onAction }) => (
  <div className="p-16 text-center space-y-4 animate-fade-in">
    {icon}
    <div>
      <p className="text-base font-bold text-navy">{title}</p>
      <p className="text-sm text-slate-500 mt-1">{message}</p>
    </div>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="px-6 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-sm font-bold transition-colors"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

/* ── Return request form (item selection + reason) ── */

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

const ReturnRequestForm: React.FC<{
  orderId?: string;
  orderNumber?: string;
  onNavigate: (page: string, params?: any) => void;
  onSubmitted: (created: any) => void;
}> = ({ orderId, orderNumber, onNavigate, onSubmitted }) => {
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
      onSubmitted(res);
    } catch {
      showToast('Could not submit your return request. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingBlock text="Loading order items..." />;

  if (!order || order.items.length === 0) {
    return (
      <EmptyBlock
        icon={<AlertCircle className="w-9 h-9 text-amber-500 mx-auto" />}
        title={!order ? 'Order not found' : 'No returnable items'}
        message={
          !order
            ? 'We could not load this order right now. Please try again from My Orders.'
            : 'Item details are not available for this order. Please contact support for help with your return.'
        }
        actionLabel="Back to My Orders"
        onAction={() => onNavigate('my-orders')}
      />
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {order.orderNumber && (
        <p className="text-sm text-slate-500">
          Requesting a return for order{' '}
          <span className="font-bold text-navy">{order.orderNumber}</span>
        </p>
      )}

      {/* Select items to return */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-navy">Select items to return</h3>
        {order.items.map((it, idx) => {
          const selected = !!it.id && !!selections[it.id];
          const selQty = it.id ? (selections[it.id] ?? it.quantity) : it.quantity;
          return (
            <div
              key={it.id || idx}
              onClick={() => toggleItem(it)}
              className={`flex items-center p-4 bg-white rounded-2xl border transition-colors ${
                it.id ? 'cursor-pointer hover:bg-slate-50/70' : 'opacity-60'
              } ${selected ? 'border-purple/40' : 'border-slate-200'}`}
            >
              {/* Checkbox */}
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  selected ? 'bg-purple border-purple' : 'bg-white border-slate-300'
                }`}
              >
                {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </div>

              <div className="flex-1 min-w-0 ml-4">
                <div className="text-sm font-bold text-navy truncate">{it.name}</div>
                {selected && it.quantity > 1 ? (
                  <div className="flex items-center mt-2 gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        stepQty(it.id as string, -1, it.quantity);
                      }}
                      className="w-7 h-7 rounded-md border border-slate-200 bg-white flex items-center justify-center text-navy hover:bg-slate-50"
                      aria-label="Decrease return quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-black text-navy w-5 text-center">{selQty}</span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        stepQty(it.id as string, 1, it.quantity);
                      }}
                      className="w-7 h-7 rounded-md border border-slate-200 bg-white flex items-center justify-center text-navy hover:bg-slate-50"
                      aria-label="Increase return quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-slate-400 font-medium">of {it.quantity}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 mt-0.5">Qty: {it.quantity}</div>
                )}
              </div>

              <div className="text-sm font-black text-navy ml-3 flex-shrink-0">
                {inr(selected ? it.unitPrice * selQty : it.lineTotal)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reason for Return */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-navy">Reason for Return</h3>
        <div className="relative">
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className={`w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm font-semibold focus:outline-none focus:border-purple transition-colors ${
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
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate-400 focus:outline-none focus:border-purple resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="px-10 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-sm shadow-glow-purple transition-all disabled:opacity-60 disabled:pointer-events-none"
      >
        {submitting ? 'Submitting...' : 'Submit Request'}
      </button>
    </div>
  );
};

/* ── Return status timeline ── */

const ReturnTimeline: React.FC<{ ret: any; onBack?: () => void }> = ({ ret, onBack }) => {
  const { doneIdx, dates, rejected } = useMemo(() => buildTimeline(ret), [ret]);

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-bold text-purple hover:text-purple-dark transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>All Return Requests</span>
        </button>
      )}

      {/* Header: Return ID */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-black text-navy break-all">
          Return ID: {ret.returnNumber || ret.id || '—'}
        </h3>
        {rejected && <StatusPill status="Rejected" />}
      </div>

      {ret.orderNumber && (
        <p className="text-sm text-slate-500 -mt-3">
          Order <span className="font-bold text-navy">{ret.orderNumber}</span>
          {ret.createdAt ? ` • Requested on ${fmtDate(ret.createdAt)}` : ''}
        </p>
      )}

      {rejected && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 font-medium leading-relaxed">
            This return request was rejected. Please contact support if you need more details.
          </p>
        </div>
      )}

      {/* Green vertical step timeline */}
      <div className="max-w-xl">
        {RETURN_STEPS.map((step, i) => {
          const done = i <= doneIdx && !(rejected && i > 0);
          const lineDone = i + 1 <= doneIdx && !(rejected && i + 1 > 0);
          return (
            <div key={step} className="flex">
              <div className="flex flex-col items-center mr-4">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    done ? 'bg-emerald-500' : 'bg-white border-2 border-slate-200'
                  }`}
                >
                  {done && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </div>
                {i < RETURN_STEPS.length - 1 && (
                  <div
                    className={`w-0.5 flex-1 min-h-[26px] my-1 rounded-full ${
                      lineDone ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
              <div
                className={`flex-1 flex items-start justify-between pt-1 ${
                  i < RETURN_STEPS.length - 1 ? 'pb-7' : ''
                }`}
              >
                <span
                  className={`text-sm ${done ? 'font-bold text-navy' : 'font-semibold text-slate-400'}`}
                >
                  {step}
                </span>
                <span className="text-xs text-slate-500 font-medium flex-shrink-0 ml-3">
                  {done ? fmtDate(dates[i]) : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Desktop design 18: RETURN & REFUND — one page, two tabs
   ═══════════════════════════════════════════════════════════════ */

type ReturnsTab = 'request' | 'refunds';

/** Desktop design 18: Return & Refund page with tabs "Return Request" | "Refunds".
 *  `mode` picks the initial view: 'request' (new return for orderId), 'status' (timeline for returnId), 'refunds'. */
export const ReturnsPage: React.FC<{
  onNavigate: (page: string, params?: any) => void;
  mode?: 'request' | 'status' | 'refunds';
  orderId?: string;
  orderNumber?: string;
  returnId?: string;
  refundId?: string;
}> = ({ onNavigate, mode, orderId, orderNumber, returnId, refundId }) => {
  const [activeTab, setActiveTab] = useState<ReturnsTab>(mode === 'refunds' ? 'refunds' : 'request');

  // Returns list — shared by both tabs.
  const [returns, setReturns] = useState<any[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);

  // Within the Return Request tab: show the new-request form for orderId until submitted.
  const [showForm, setShowForm] = useState<boolean>(!!orderId && mode !== 'status');
  // The return whose timeline is being viewed (id or returnNumber).
  const [selectedReturnId, setSelectedReturnId] = useState<string | undefined>(
    mode === 'status' ? returnId : undefined
  );
  // Fallback record for a just-created return that may not be in the refetched list yet.
  const [justCreated, setJustCreated] = useState<any | null>(null);

  const loadReturns = () => {
    setLoadingReturns(true);
    api
      .getMyReturns()
      .then(list => setReturns(Array.isArray(list) ? list : []))
      .catch(() => setReturns([]))
      .finally(() => setLoadingReturns(false));
  };

  useEffect(loadReturns, []);

  // Follow navigation-driven prop changes (e.g. 'refund-status' vs 'return-status' routes).
  useEffect(() => {
    setActiveTab(mode === 'refunds' ? 'refunds' : 'request');
    setShowForm(!!orderId && mode !== 'status');
    setSelectedReturnId(mode === 'status' ? returnId : undefined);
  }, [mode, orderId, returnId]);

  const handleSubmitted = (created: any) => {
    setJustCreated(created || null);
    setShowForm(false);
    setSelectedReturnId(created?.id ?? created?.returnNumber ?? undefined);
    loadReturns();
  };

  const selectedReturn = useMemo(() => {
    if (selectedReturnId) {
      const match = findReturn(returns, selectedReturnId);
      if (match) return match;
      if (
        justCreated &&
        (justCreated.id === selectedReturnId || justCreated.returnNumber === selectedReturnId)
      )
        return justCreated;
      // mode === 'status' without a resolvable id: fall back to the latest return.
      return sortByNewest(returns)[0] ?? justCreated ?? null;
    }
    return null;
  }, [returns, selectedReturnId, justCreated]);

  const sortedReturns = useMemo(() => sortByNewest(returns), [returns]);

  /** Refund entries: returns that carry a refund (matching refundId first when given). */
  const refundEntries = useMemo(() => {
    const withRefund = sortedReturns.filter(r => r?.refund);
    if (!refundId) return withRefund;
    const match = withRefund.filter(
      r => r.refund?.refundNumber === refundId || r.refund?.id === refundId
    );
    return match.length > 0 ? [...match, ...withRefund.filter(r => !match.includes(r))] : withRefund;
  }, [sortedReturns, refundId]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-fade-in">
      <h1 className="text-2xl font-black text-navy mb-6">Return &amp; Refund</h1>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        {/* Tab bar (purple underline on active tab) */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex items-center gap-8">
            {(
              [
                { id: 'request', label: 'Return Request' },
                { id: 'refunds', label: 'Refunds' }
              ] as Array<{ id: ReturnsTab; label: string }>
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple text-purple font-bold'
                    : 'border-transparent text-slate-500 font-semibold hover:text-navy'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Return Request tab ── */}
        {activeTab === 'request' &&
          (showForm ? (
            <ReturnRequestForm
              orderId={orderId}
              orderNumber={orderNumber}
              onNavigate={onNavigate}
              onSubmitted={handleSubmitted}
            />
          ) : selectedReturnId ? (
            loadingReturns && !selectedReturn ? (
              <LoadingBlock text="Loading return status..." />
            ) : selectedReturn ? (
              <ReturnTimeline ret={selectedReturn} onBack={() => setSelectedReturnId(undefined)} />
            ) : (
              <EmptyBlock
                icon={<RotateCcw className="w-12 h-12 text-slate-300 mx-auto" />}
                title="No return found"
                message="You have no return requests yet. You can request a return from a delivered order."
                actionLabel="Go to My Orders"
                onAction={() => onNavigate('my-orders')}
              />
            )
          ) : loadingReturns ? (
            <LoadingBlock text="Loading your return requests..." />
          ) : sortedReturns.length === 0 ? (
            <EmptyBlock
              icon={<RotateCcw className="w-12 h-12 text-slate-300 mx-auto" />}
              title="No return requests yet"
              message="You can request a return from a delivered order in My Orders."
              actionLabel="Go to My Orders"
              onAction={() => onNavigate('my-orders')}
            />
          ) : (
            <div className="divide-y divide-slate-100 animate-fade-in">
              {sortedReturns.map((r, idx) => (
                <button
                  key={r?.id || r?.returnNumber || idx}
                  onClick={() => setSelectedReturnId(r?.id ?? r?.returnNumber)}
                  className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-black text-navy truncate">
                      {r?.returnNumber || r?.id || '—'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {r?.orderNumber ? `Order ${r.orderNumber} • ` : ''}
                      {fmtDate(r?.createdAt) || '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusPill status={r?.status || 'Requested'} />
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          ))}

        {/* ── Refunds tab ── */}
        {activeTab === 'refunds' &&
          (loadingReturns ? (
            <LoadingBlock text="Loading your refunds..." />
          ) : refundEntries.length === 0 ? (
            <EmptyBlock
              icon={<Wallet className="w-12 h-12 text-slate-300 mx-auto" />}
              title="No refunds yet"
              message="Refunds appear here after a return is approved and processed."
              actionLabel="Go to My Orders"
              onAction={() => onNavigate('my-orders')}
            />
          ) : (
            <div className="divide-y divide-slate-100 animate-fade-in">
              {refundEntries.map((r, idx) => {
                const refund = r.refund || {};
                const statusText = refundStatusLabel(refund.status);
                return (
                  <div
                    key={refund.id || refund.refundNumber || idx}
                    className="px-6 py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-navy truncate">
                        Refund ID: {refund.refundNumber || refund.id || '—'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {fmtDate(refund.processedAt) ||
                          (statusText === 'Pending' ? 'Date pending' : '—')}
                        {' • '}Refunded To: {refund.method || '—'}
                        {r.returnNumber ? ` • Return ${r.returnNumber}` : ''}
                      </div>
                    </div>
                    <div className="text-sm font-black text-navy flex-shrink-0">
                      {inr(refund.amount)}
                    </div>
                    <StatusPill status={statusText} />
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
};
