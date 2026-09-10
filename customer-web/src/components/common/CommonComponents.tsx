import React, { useState } from 'react';
import { Check, Copy, Landmark, Star, StarHalf, Truck, Upload, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';
import { compressImageFile } from '../../utils/imageCompressor';
import {
  copyText,
  forgetOrderNumber,
  readRecentOrders,
  type RecentOrder
} from '../../utils/guestOrders';

export const RatingStars: React.FC<{ rating?: number; reviewCount?: number; size?: string }> = ({
  rating = 4.8,
  reviewCount,
  size = 'w-4 h-4'
}) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.4;

  return (
    <div className="flex items-center space-x-1">
      <div className="flex items-center text-amber-400">
        {[...Array(5)].map((_, i) => {
          if (i < fullStars) {
            return <Star key={i} className={`${size} fill-current`} />;
          }
          if (i === fullStars && hasHalf) {
            return <StarHalf key={i} className={`${size} fill-current`} />;
          }
          return <Star key={i} className={`${size} text-slate-300`} />;
        })}
      </div>
      {reviewCount !== undefined && (
        <span className="text-xs text-slate-500 font-medium">({reviewCount} reviews)</span>
      )}
    </div>
  );
};

export const StatusBadge: React.FC<{ status: string; type?: 'order' | 'payment' | 'stock' }> = ({
  status,
  type = 'order'
}) => {
  const s = status.toLowerCase();

  let bg = 'bg-slate-100 text-slate-700';

  if (s === 'paid' || s === 'delivered' || s === 'confirmed' || s === 'in stock') {
    bg = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  } else if (s === 'pending' || s === 'processing' || s === 'medium' || s === 'unfulfilled') {
    bg = 'bg-amber-50 text-amber-700 border border-amber-200';
  } else if (s === 'shipped' || s === 'outfordelivery' || s === 'packed') {
    bg = 'bg-blue-50 text-blue-700 border border-blue-200';
  } else if (s === 'cancelled' || s === 'failed' || s === 'critical' || s === 'low' || s === 'out of stock') {
    bg = 'bg-red-50 text-red-700 border border-red-200';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${bg}`}>
      {status}
    </span>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fade-in">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden transform transition-all`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-navy">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const Drawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}> = ({ isOpen, onClose, title, children, width = 'max-w-md' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-navy/60 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={`fixed inset-y-0 right-0 ${width} w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-bold text-navy">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Shipment: carrier + LR / waybill number (phases 6-7)
   The customer collects the parcel from the transport office using
   this LR number, so it gets a high-contrast navy card everywhere
   an order is shown (My Orders, Order Details, Track Order).
   Renders nothing until the order actually carries the values.
   ───────────────────────────────────────────────────────────── */

export const CarrierTrackingCard: React.FC<{
  carrierName?: string;
  trackingNumber?: string;
  compact?: boolean;
  className?: string;
}> = ({ carrierName, trackingNumber, compact = false, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const carrier = (carrierName || '').trim();
  const lr = (trackingNumber || '').trim();

  if (!carrier && !lr) return null;

  const handleCopy = () => {
    if (!lr) return;
    try {
      navigator.clipboard.writeText(lr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable — the number stays selectable on screen */
    }
  };

  return (
    <div
      className={`rounded-2xl bg-navy text-white shadow-card ${compact ? 'p-4' : 'p-5'} ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
          <Truck className={compact ? 'w-4.5 h-4.5' : 'w-5 h-5'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
            Shipment Details
          </div>
          {carrier && (
            <div className={`font-black mt-0.5 ${compact ? 'text-[13px]' : 'text-base'}`}>
              Shipped via {carrier}
            </div>
          )}
          {lr && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-white/60">LR / Waybill</span>
              <span
                className={`font-mono font-black tracking-wide break-all ${
                  compact ? 'text-sm' : 'text-lg'
                }`}
              >
                {lr}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy LR / Waybill number"
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-bold flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          )}
          <p className="text-[10px] text-white/50 mt-2 leading-relaxed">
            Show this LR / waybill number at the transport office to collect your parcel.
          </p>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Bank transfer details for the checkout Payment step (phase 3).
   Values come from the public storefront settings
   (Payment.BankName / AccountName / AccountNumber / IfscCode).
   The whole card is hidden while none of them are configured.
   ───────────────────────────────────────────────────────────── */

export const BankTransferDetailsCard: React.FC<{ compact?: boolean; className?: string }> = ({
  compact = false,
  className = ''
}) => {
  const { bankName, accountName, accountNumber, ifscCode } = useSettings();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const rows = [
    { key: 'bank', label: 'Bank Name', value: (bankName || '').trim() },
    { key: 'name', label: 'Account Name', value: (accountName || '').trim() },
    { key: 'number', label: 'Account Number', value: (accountNumber || '').trim(), mono: true },
    { key: 'ifsc', label: 'IFSC Code', value: (ifscCode || '').trim(), mono: true }
  ].filter(r => r.value.length > 0);

  // All four empty → the store has not configured bank transfer; render nothing.
  if (rows.length === 0) return null;

  const handleCopy = (key: string, value: string) => {
    try {
      navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(current => (current === key ? null : current)), 2500);
    } catch {
      /* clipboard unavailable — the value stays selectable on screen */
    }
  };

  return (
    <div
      className={`rounded-2xl bg-white border border-slate-200 shadow-card ${
        compact ? 'p-4' : 'p-5'
      } space-y-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-purple-soft flex items-center justify-center flex-shrink-0">
          <Landmark className="w-4 h-4 text-purple" />
        </div>
        <div>
          <h4 className={`font-black text-navy ${compact ? 'text-xs' : 'text-sm'}`}>
            Bank Transfer Details
          </h4>
          <p className="text-[10px] text-slate-400 font-medium">
            NEFT / IMPS / RTGS — then submit the UTR below
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
        {rows.map(row => (
          <div key={row.key} className="flex items-center gap-2 px-3 py-2.5 bg-white">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {row.label}
              </div>
              <div
                className={`text-navy font-bold break-all ${row.mono ? 'font-mono tracking-wide' : ''} ${
                  compact ? 'text-xs' : 'text-sm'
                }`}
              >
                {row.value}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(row.key, row.value)}
              title={`Copy ${row.label}`}
              className="px-2 py-1 rounded-lg bg-purple-soft text-purple hover:bg-purple hover:text-white text-[10px] font-bold flex items-center gap-1 flex-shrink-0 transition-colors"
            >
              {copiedKey === row.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === row.key ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const triggerFireworksConfetti = () => {
  const duration = 3.5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  const interval: any = setInterval(function() {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      return clearInterval(interval);
    }
    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   GUEST-FIRST PURCHASE FLOW
   Shared by the desktop pages (src/pages/customer) and the mobile screens
   (src/components/mobile) so both trees say the same thing about accounts.

   Customers are never forced to sign in. An account is a convenience — My
   Orders, wishlist, saved addresses — never a gate in front of buying.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The quiet, non-blocking "sign in if you want to" row at checkout.
 *
 * Continuing as a guest is the default and needs no interaction at all: this is
 * one inline card, never a modal or an interstitial. Signing in from here comes
 * straight back to checkout with the cart intact (the cart lives in CartContext
 * and the auth screens honour `redirectTo`).
 */
export const GuestCheckoutNotice: React.FC<{
  onLogin: () => void;
  className?: string;
}> = ({ onLogin, className = '' }) => (
  <div
    className={`p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center gap-2.5 ${className}`}
  >
    <div className="flex items-start gap-2.5 flex-1 min-w-0">
      <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
        <Check className="w-4 h-4 stroke-[3]" />
      </div>
      <div className="text-xs leading-relaxed min-w-0">
        <div className="font-black text-navy text-[13px]">Checking out as a guest</div>
        <div className="text-slate-500 mt-0.5">
          No account needed. We&rsquo;ll give you an order number to track your delivery.
        </div>
      </div>
    </div>
    <button
      type="button"
      onClick={onLogin}
      className="text-[11px] font-bold text-purple hover:text-purple-dark underline underline-offset-2 whitespace-nowrap self-start sm:self-auto flex-shrink-0"
    >
      Already have an account? Log in
    </button>
  </div>
);

/**
 * The order number, made unmissable and copyable.
 *
 * For a guest this string is the ONLY handle on the order — there is no My
 * Orders to fall back on — so it is rendered large, monospaced, selectable, with
 * one-tap copy and an explicit "save this" instruction.
 */
export const OrderNumberKeepsake: React.FC<{
  orderNumber: string;
  /** Guests get the stronger "this is your only reference" wording. */
  isGuest?: boolean;
  className?: string;
}> = ({ orderNumber, isGuest = false, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(orderNumber);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!orderNumber) return null;

  return (
    <div
      className={`rounded-2xl border-2 border-dashed border-purple/40 bg-purple-soft/40 p-4 sm:p-5 text-center ${className}`}
    >
      <div className="text-[11px] font-bold text-purple uppercase tracking-wider">Your Order Number</div>

      <div className="mt-1.5 flex items-center justify-center gap-2 flex-wrap">
        <span className="text-xl sm:text-2xl font-mono font-black text-navy tracking-tight select-all break-all">
          {orderNumber}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy order number ${orderNumber}`}
          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors flex-shrink-0 ${
            copied
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-white border-slate-300 text-slate-600 hover:text-purple hover:border-purple'
          }`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <p className="text-[11px] text-slate-600 mt-2 leading-relaxed max-w-xs mx-auto">
        {isGuest ? (
          <>
            <strong className="text-navy">Please save this number.</strong> You ordered without an
            account, so it is your only reference for tracking this order or contacting us.
          </>
        ) : (
          <>Keep this number handy for tracking and for any question about this order.</>
        )}
      </p>
    </div>
  );
};

/**
 * "Recent orders on this device" — a convenience for guests, who have no My Orders.
 *
 * Purely local (see src/utils/guestOrders.ts): the numbers are unsigned
 * localStorage the customer could edit themselves, so nothing here is trusted —
 * choosing one only pre-fills the public tracking lookup, which the API answers.
 * Renders nothing when storage is unavailable or holds nothing.
 */
export const RecentDeviceOrders: React.FC<{
  onTrack: (orderNumber: string) => void;
  className?: string;
}> = ({ onTrack, className = '' }) => {
  const [orders, setOrders] = useState<RecentOrder[]>(() => readRecentOrders());

  if (orders.length === 0) return null;

  return (
    <div className={`rounded-2xl bg-white border border-slate-200 p-4 shadow-xs ${className}`}>
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
        Recent orders on this device
      </div>
      <div className="flex flex-wrap gap-2">
        {orders.map(o => (
          <span
            key={o.orderNumber}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => onTrack(o.orderNumber)}
              className="pl-3 pr-2 py-1.5 text-[11px] font-mono font-bold text-navy hover:text-purple transition-colors"
            >
              {o.orderNumber}
            </button>
            <button
              type="button"
              onClick={() => setOrders(forgetOrderNumber(o.orderNumber))}
              aria-label={`Forget ${o.orderNumber} on this device`}
              title="Remove from this device"
              className="pr-2.5 pl-1 py-1.5 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 mt-2.5 leading-relaxed">
        Saved in this browser only, so you can find your orders again. It is not a substitute for
        keeping your order number.
      </p>
    </div>
  );
};

/**
 * Correct or re-send the UPI payment proof for an order that was just placed.
 *
 * POST /orders/{id}/payment-proof accepts anonymous callers as long as the
 * matching order number travels in the body, so a guest can fix a mistyped UTR
 * without an account — exactly as a signed-in customer would. The screenshot is
 * required because the API overwrites the stored image with whatever arrives.
 */
export const PaymentProofUpdateCard: React.FC<{
  orderId: string;
  orderNumber: string;
  currentUtr?: string;
  className?: string;
}> = ({ orderId, orderNumber, currentUtr = '', className = '' }) => {
  const [open, setOpen] = useState(false);
  const [utr, setUtr] = useState(currentUtr);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError('Screenshot size must be under 15MB');
      return;
    }
    setFileName(file.name);
    try {
      const result = await compressImageFile(file);
      setScreenshot(result.base64);
      setError(null);
    } catch {
      setError('Failed to process image. Please try another photo.');
    }
  };

  const handleSubmit = async () => {
    if (!utr.trim()) {
      setError('Enter the UPI UTR / Transaction Reference ID.');
      return;
    }
    if (!screenshot) {
      setError('Attach the payment screenshot — it replaces the one on file.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.submitPaymentProof({
        orderId,
        orderNumber,
        utrNumber: utr.trim(),
        screenshotBase64: screenshot,
        notes: `Payment proof updated by the customer for ${orderNumber}.`
      });
      setDone(true);
      setOpen(false);
    } catch (err: any) {
      setError(
        err?.response?.status === 401
          ? 'We could not match this order number. Please contact us with your order number.'
          : err?.message || 'Could not submit the payment proof. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  // Nothing to submit against without both halves of the API's guard.
  if (!orderId || !orderNumber) return null;

  if (done) {
    return (
      <div
        className={`p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-2 ${className}`}
      >
        <Check className="w-4 h-4 flex-shrink-0" />
        <span>Updated payment proof received. Our team will verify it shortly.</span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-[11px] font-bold text-purple hover:text-purple-dark underline underline-offset-2 ${className}`}
      >
        Entered the wrong UTR? Update payment proof
      </button>
    );
  }

  return (
    <div className={`p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5 text-left ${className}`}>
      <div className="font-black text-navy text-[13px]">Update payment proof</div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        For order <strong className="text-navy font-mono">{orderNumber}</strong>. No account needed.
      </p>

      <input
        type="text"
        value={utr}
        onChange={(e) => setUtr(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
        maxLength={24}
        placeholder="UPI UTR / Transaction Reference ID"
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-purple"
      />

      <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-[11px] text-slate-500 cursor-pointer hover:border-purple transition-colors">
        <Upload className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{fileName || 'Attach payment screenshot'}</span>
        <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </label>

      {error && <div className="text-[11px] font-semibold text-rose-600 leading-relaxed">{error}</div>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="flex-1 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-600 hover:text-navy font-bold text-[11px] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className={`flex-1 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-[11px] transition-colors ${
            busy ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {busy ? 'Sending...' : 'Submit'}
        </button>
      </div>
    </div>
  );
};
