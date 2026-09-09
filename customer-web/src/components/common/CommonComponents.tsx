import React, { useState } from 'react';
import { Check, Copy, Landmark, Star, StarHalf, Truck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSettings } from '../../context/SettingsContext';

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
