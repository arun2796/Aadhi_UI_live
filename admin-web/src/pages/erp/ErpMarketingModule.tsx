import React, { useState, useEffect } from 'react';
import {
  Tag,
  Percent,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Calendar,
  Sparkles,
  Gift,
  Copy
} from 'lucide-react';
import { Coupon, Promotion } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const ErpMarketingModule: React.FC = () => {
  const { showToast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Coupon Creation Modal state
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponForm, setCouponForm] = useState<Partial<Coupon>>({
    code: '',
    name: '',
    type: 'Percentage',
    value: 15,
    minimumOrderAmount: 2500,
    maximumDiscount: 1000,
    usageLimit: 200,
    perCustomerLimit: 1,
    isActive: true
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const coup = await api.getCoupons();
      setCoupons(coup);
    } catch {
      showToast('Failed to load marketing coupons', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveCoupon = async () => {
    if (!couponForm.code || !couponForm.name || !couponForm.value) {
      showToast('Coupon code, name and discount value are required', 'warning');
      return;
    }

    try {
      await api.createCoupon({
        ...couponForm,
        code: couponForm.code.toUpperCase().trim(),
        usageCount: 0,
        startDateUtc: new Date().toISOString(),
        endDateUtc: new Date(Date.now() + 86400000 * 30).toISOString()
      });
      showToast(`Coupon ${couponForm.code} created successfully!`, 'success');
      setIsCouponModalOpen(false);
      loadData();
    } catch {
      showToast('Failed to create coupon', 'error');
    }
  };

  const handleDeleteCoupon = async (id: string, code: string) => {
    if (window.confirm(`Delete coupon "${code}"?`)) {
      await api.deleteCoupon(id);
      showToast(`Coupon ${code} removed`, 'info');
      loadData();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>Marketing, Coupons & Festival Discounts</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create flat or percentage discount coupon codes, configure minimum order constraints, and monitor redemption rates.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCouponModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-orange/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Coupon Code</span>
          </button>
        </div>
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {coupons.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-orange/15 to-transparent rounded-bl-3xl pointer-events-none" />

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black text-sm text-purple bg-purple/10 px-2 py-0.5 rounded-lg border border-purple/20">
                    {c.code}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(c.code);
                      showToast(`Copied ${c.code} to clipboard!`, 'success');
                    }}
                    className="p-1 text-slate-400 hover:text-purple"
                    title="Copy code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h3 className="font-bold text-xs text-navy">{c.name}</h3>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                {c.isActive ? 'Active' : 'Expired'}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Discount Value:</span>
                <span className="font-black text-navy">
                  {c.type === 'Percentage' ? `${c.value}% OFF` : `₹${c.value} FLAT OFF`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Minimum Order Required:</span>
                <span className="font-bold text-slate-800">₹{c.minimumOrderAmount.toLocaleString('en-IN')}</span>
              </div>
              {c.maximumDiscount && (
                <div className="flex justify-between">
                  <span>Max Cap:</span>
                  <span>₹{c.maximumDiscount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Redemptions:</span>
                <span className="font-bold text-purple">{c.usageCount} / {c.usageLimit || '∞'} uses</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[10px] text-slate-400">Limit: {c.perCustomerLimit} per customer</span>
              <button
                onClick={() => handleDeleteCoupon(c.id, c.code)}
                className="p-1 text-slate-400 hover:text-red-600"
                title="Delete Coupon"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE COUPON MODAL */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                Create Promotional Coupon Code
              </h3>
              <button onClick={() => setIsCouponModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">Coupon Code (Uppercase) *</label>
                <input
                  type="text"
                  value={couponForm.code || ''}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. DIWALI25"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-purple outline-none focus:border-purple uppercase"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Campaign Name *</label>
                <input
                  type="text"
                  value={couponForm.name || ''}
                  onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })}
                  placeholder="e.g. Early Bird Festive Saver"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-navy">Discount Type *</label>
                  <select
                    value={couponForm.type}
                    onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value as any })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none font-bold text-navy"
                  >
                    <option value="Percentage">Percentage (%)</option>
                    <option value="Flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-navy">Discount Value *</label>
                  <input
                    type="number"
                    value={couponForm.value}
                    onChange={(e) => setCouponForm({ ...couponForm, value: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none font-bold text-navy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-navy">Min Order (₹) *</label>
                  <input
                    type="number"
                    value={couponForm.minimumOrderAmount}
                    onChange={(e) => setCouponForm({ ...couponForm, minimumOrderAmount: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-navy">Max Cap (₹)</label>
                  <input
                    type="number"
                    value={couponForm.maximumDiscount || 1000}
                    onChange={(e) => setCouponForm({ ...couponForm, maximumDiscount: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsCouponModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCoupon}
                className="px-5 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold shadow-md shadow-orange/20"
              >
                Save Coupon Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
