import React, { useState } from 'react';
import { Settings, Store, ShieldCheck, Truck, Save } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const ErpSettingsPage: React.FC = () => {
  const { showToast } = useToast();

  const [storeName, setStoreName] = useState('AADHI CRACKERS');
  const [tagline, setTagline] = useState('Celebrate Every Moment');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [email, setEmail] = useState('support@aadhicrackers.com');
  const [taxRate, setTaxRate] = useState(18);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(3000);
  const [rateLimiting, setRateLimiting] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Store & System settings saved successfully!', 'success');
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-navy">Store & System Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Configure business metadata, tax policies, and rate limits.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Store Profile */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 text-xs">
          <h2 className="text-base font-bold text-navy flex items-center space-x-2">
            <Store className="w-4 h-4 text-orange" />
            <span>Storefront Profile</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Business Store Name</label>
              <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Tagline</label>
              <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Support Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Support Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange" />
            </div>
          </div>
        </div>

        {/* Tax & Logistics Rules */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 text-xs">
          <h2 className="text-base font-bold text-navy flex items-center space-x-2">
            <Truck className="w-4 h-4 text-purple" />
            <span>Tax & Shipping Automation</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Default GST Rate (%)</label>
              <input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Free Shipping Threshold (₹)</label>
              <input type="number" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange" />
            </div>
          </div>
        </div>

        {/* Security & Rate Limiting */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 text-xs">
          <h2 className="text-base font-bold text-navy flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>API Security & Rate Limiting Policies</span>
          </h2>

          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" checked={rateLimiting} onChange={(e) => setRateLimiting(e.target.checked)} className="w-4 h-4 text-orange rounded accent-orange" />
              <div>
                <strong className="text-slate-800 block">Enforce Partitioned ASP.NET Core Rate Limiting</strong>
                <span className="text-slate-500">Protect endpoints with dedicated fixed window limits (Checkout 5/min, Auth 10/min, Admin 120/min).</span>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-8 py-3 bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-glow flex items-center space-x-2 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save System Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
