import React, { useEffect, useRef } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { api } from '../../services/api';
import { inrExact } from '../../utils/checkoutQuote';

interface NavProps {
  onNavigate: (page: string, params?: any) => void;
}

interface PaymentResultProps extends NavProps {
  orderNumber?: string;
  orderId?: string;
  amount?: number;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Shared centered card layout for the three payment result screens. */
const ResultShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[75vh] flex items-start justify-center p-4 pt-10 font-sans bg-[#fbfbfb]">
    <div className="w-full max-w-sm p-6 rounded-2xl bg-white border border-slate-200 shadow-card text-center space-y-5 animate-fade-in">
      {children}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   Design 20: PAYMENT SUCCESS
   ───────────────────────────────────────────────────────────── */

export const ScreenPaymentSuccess: React.FC<PaymentResultProps> = ({
  onNavigate,
  orderNumber,
  amount
}) => {
  return (
    <ResultShell>
      <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg animate-scale-up">
        <Check className="w-12 h-12 stroke-[3]" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-black text-navy">Payment Successful!</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          {typeof amount === 'number' && amount > 0 ? (
            <>Your payment of <strong className="text-navy">{inrExact(amount)}</strong> was successful.</>
          ) : (
            <>Your payment was successful.</>
          )}
        </p>
      </div>

      {orderNumber && (
        <div className="text-sm font-black text-navy">
          Order ID: <span className="font-mono">{orderNumber}</span>
        </div>
      )}

      <button
        onClick={() => onNavigate('home')}
        className="w-full py-3.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs transition-colors shadow-glow-purple"
      >
        Continue
      </button>
    </ResultShell>
  );
};

/* ─────────────────────────────────────────────────────────────
   Design 21: PAYMENT FAILED
   ───────────────────────────────────────────────────────────── */

export const ScreenPaymentFailed: React.FC<PaymentResultProps> = ({
  onNavigate,
  orderNumber,
  amount
}) => {
  return (
    <ResultShell>
      <div className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center mx-auto shadow-lg animate-scale-up">
        <X className="w-12 h-12 stroke-[3]" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-black text-navy">Payment Failed!</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Your payment{typeof amount === 'number' && amount > 0 ? <> of <strong className="text-navy">{inrExact(amount)}</strong></> : null} could not be completed.
          <br />
          Please try again or use another payment method.
        </p>
      </div>

      {orderNumber && (
        <div className="text-sm font-black text-navy">
          Order ID: <span className="font-mono">{orderNumber}</span>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={() => onNavigate('checkout')}
          className="w-full py-3.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs transition-colors shadow-glow-purple"
        >
          Try Again
        </button>
        <button
          onClick={() => onNavigate('checkout')}
          className="text-xs font-bold text-blue-600 hover:underline"
        >
          Use Different Method
        </button>
      </div>
    </ResultShell>
  );
};

/* ─────────────────────────────────────────────────────────────
   Design 22: PAYMENT PENDING — polls trackOrder every ~10s and
   redirects to success/failed once the payment is resolved.
   ───────────────────────────────────────────────────────────── */

export const ScreenPaymentPending: React.FC<PaymentResultProps> = ({
  onNavigate,
  orderNumber,
  amount
}) => {
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;
  const amountRef = useRef(amount);
  amountRef.current = amount;

  useEffect(() => {
    if (!orderNumber) return;

    let stopped = false;

    const checkStatus = async () => {
      const res = await api.trackOrder(orderNumber);
      if (stopped || !res) return;
      const pay = String(res.paymentStatus ?? '').toLowerCase();
      const resolvedAmount =
        Number(res.grandTotal ?? res.totalAmount ?? res.total) || amountRef.current;
      if (pay === 'paid') {
        navigateRef.current('payment-success', { orderNumber, amount: resolvedAmount });
      } else if (pay === 'failed' || pay === 'rejected' || pay === 'cancelled') {
        navigateRef.current('payment-failed', { orderNumber, amount: resolvedAmount });
      }
    };

    checkStatus();
    const intervalId = window.setInterval(checkStatus, 10000);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [orderNumber]);

  return (
    <ResultShell>
      <div className="w-20 h-20 rounded-full bg-orange text-white flex items-center justify-center mx-auto shadow-lg animate-scale-up">
        <Clock className="w-11 h-11 stroke-[2.5]" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-black text-navy">Payment Pending</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Your payment is being processed.
          <br />
          We will update your order status once the payment is confirmed.
        </p>
      </div>

      {orderNumber && (
        <div className="text-sm font-black text-navy">
          Order ID: <span className="font-mono">{orderNumber}</span>
        </div>
      )}

      {orderNumber && (
        <div className="flex items-center justify-center space-x-1.5 text-[10px] font-semibold text-amber-600">
          <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Checking payment status automatically...</span>
        </div>
      )}

      <button
        onClick={() => onNavigate('my-orders')}
        className="w-full py-3.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs transition-colors shadow-glow-purple"
      >
        View Orders
      </button>
    </ResultShell>
  );
};
