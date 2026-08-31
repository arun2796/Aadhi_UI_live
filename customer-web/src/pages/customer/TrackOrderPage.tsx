import React, { useState, useEffect } from 'react';
import {
  Truck,
  Search,
  CheckCircle2,
  PackageCheck,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';

interface TrackOrderPageProps {
  initialOrderNumber?: string;
  onNavigate: (page: string, params?: any) => void;
}

export const TrackOrderPage: React.FC<TrackOrderPageProps> = ({ initialOrderNumber }) => {
  const [query, setQuery] = useState<string>(initialOrderNumber || '');
  const [order, setOrder] = useState<any | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (initialOrderNumber) {
      handleSearch(initialOrderNumber);
    }
  }, [initialOrderNumber]);

  const handleSearch = async (searchStr?: string) => {
    const q = searchStr || query;
    if (!q.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await api.trackOrder(q.trim());
      setOrder(res);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const getStepIndex = (status: any) => {
    const s = String(status || '').toLowerCase();
    if (s === 'delivered') return 5;
    if (s === 'outfordelivery') return 4;
    if (s === 'shipped') return 3;
    if (s === 'packed' || s === 'processing') return 2;
    if (s === 'confirmed') return 1;
    return 0; // Pending
  };

  const steps = [
    { title: 'Order Placed', desc: 'Order received in system' },
    { title: 'Confirmed', desc: 'Payment verified & approved' },
    { title: 'Packed at Hub', desc: 'Securely packed in Sivakasi' },
    { title: 'Shipped', desc: 'Dispatched via Express Dangerous-Goods Transit' },
    { title: 'Out For Delivery', desc: 'Arrived at your local delivery hub' },
    { title: 'Delivered', desc: 'Safely handed over to you' }
  ];

  const currentStatus = order?.status || order?.orderStatus || 'Pending';
  const currentStep = order ? getStepIndex(currentStatus) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center space-x-1 text-xs font-bold text-orange uppercase tracking-wider">
          <Truck className="w-4 h-4" />
          <span>Live Tracking Portal</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-navy">
          Track Your Fireworks Order
        </h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Enter your Order Number (e.g. <strong>ORD-2026-001248</strong>) or your registered 10-digit mobile number.
        </p>
      </div>

      {/* Search Input Form */}
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

      {/* Results */}
      {order ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-8 animate-fade-in">
          {/* Header Snapshot */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
            <div>
              <div className="text-xs text-slate-400 font-semibold">Order Tracking Details</div>
              <h2 className="text-xl font-black text-navy">{order.orderNumber}</h2>
              <div className="text-xs text-slate-500">
                Placed on {order.placedAtUtc ? new Date(order.placedAtUtc).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Status: {currentStatus}
              </span>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                Grand Total: <strong className="text-navy">₹{(order.grandTotal || 0).toLocaleString('en-IN')}</strong> ({order.paymentMethod || 'UPI'})
              </div>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="space-y-6">
            <h3 className="font-bold text-sm text-navy">Order Progress Timeline</h3>
            <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 space-y-8 ml-3">
              {steps.map((step, idx) => {
                const isPassed = idx <= currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div key={idx} className="relative">
                    {/* Step Circle */}
                    <div
                      className={`absolute -left-[31px] sm:-left-[39px] top-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isPassed
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>

                    <div>
                      <h4 className={`text-xs sm:text-sm font-bold ${isCurrent ? 'text-orange font-black' : isPassed ? 'text-navy' : 'text-slate-400'}`}>
                        {step.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Address & Items Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-orange" />
                <span>Delivery Address</span>
              </div>
              <div className="text-slate-600">
                {order.deliveryAddressSummary || (order.shippingAddress ? `${order.shippingAddress.fullName || ''}, ${order.shippingAddress.addressLine1 || ''}, ${order.shippingAddress.city || ''} - ${order.shippingAddress.postalCode || ''}` : 'Delivery to customer address')}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                <PackageCheck className="w-4 h-4 text-purple" />
                <span>Package Summary</span>
              </div>
              <div className="text-slate-600">
                {order.items && order.items.length > 0 ? (
                  order.items.map((i: any) => `${i.productName || i.productNameSnapshot || 'Item'} (x${i.quantity})`).join(', ')
                ) : (
                  'Festive Assorted Fireworks Gift Pack'
                )}
              </div>
            </div>
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
      ) : null}
    </div>
  );
};
