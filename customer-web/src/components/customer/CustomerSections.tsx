import React from 'react';
import { ShieldCheck, Truck, RotateCcw, Headphones, Award, Sparkles, AlertCircle } from 'lucide-react';

export const TrustIndicators: React.FC = () => {
  const items = [
    {
      icon: Award,
      title: '100% Original Brands',
      description: 'Direct authentic manufacturing at Sivakasi, Tamil Nadu with full BIS/PESO certified formulations.',
      color: 'text-orange bg-orange/10 border-orange/20'
    },
    {
      icon: ShieldCheck,
      title: 'Safe & Secure Tested',
      description: 'Every batch rigorously tested for fuse stability, low decibel thresholds, and minimal smoke levels.',
      color: 'text-purple bg-purple/10 border-purple/20'
    },
    {
      icon: Truck,
      title: 'Transport Delivery',
      description: 'Dispatched by lorry to your destination transport office, typically within 1–2 weeks. Freight is paid to the transport company on collection.',
      color: 'text-gold-dark bg-gold/10 border-gold/20'
    },
    {
      icon: RotateCcw,
      title: 'Best Lowest Prices',
      description: 'Wholesale factory rates with up to 70% direct discount compared to local seasonal retail shops.',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    {
      icon: Headphones,
      title: '24/7 Support Assistance',
      description: 'Dedicated customer care executives available on phone, email, and WhatsApp for order guidance.',
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-3 ${item.color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">{item.title}</h4>
            <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
          </div>
        );
      })}
    </div>
  );
};

export const SafetySection: React.FC = () => {
  const dos = [
    'Always store fireworks in a cool, dry place away from heat and flammable materials.',
    'Use an agarbathi (incense stick) or sparkler to light fireworks from an arm’s length.',
    'Keep a bucket of water or sand nearby at all times during celebrations.',
    'Always light crackers in an open outdoor area free from overhead electric lines.',
    'Wear cotton clothing while bursting crackers to prevent heat hazards.'
  ];

  const donts = [
    'Never attempt to re-ignite a firework that failed to go off on the first attempt.',
    'Never burst crackers inside closed rooms, balconies, or congested corridors.',
    'Never point rockets or aerial repeaters toward people, animals, or houses.',
    'Do not carry loose fireworks in pockets or close to open flames.',
    'Never leave children unattended while handling any fireworks.'
  ];

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-10 border border-slate-800 overflow-hidden relative shadow-2xl">
      <div className="relative z-10">
        <div className="flex items-center space-x-2 text-gold font-bold text-xs uppercase tracking-widest mb-2">
          <Sparkles className="w-4 h-4 text-orange" />
          <span>Safety First Always</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black mb-3">
          Essential Safety Guidelines & Precautions
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm max-w-2xl mb-8">
          At AADHI CRACKERS, your family’s joy and safety are our highest priorities. Please adhere strictly to these vital guidelines for a bright and injury-free celebration.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* DO's */}
          <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-800/40">
            <h3 className="text-emerald-400 font-bold text-base flex items-center space-x-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">✓</span>
              <span>Things You MUST DO</span>
            </h3>
            <ul className="space-y-3">
              {dos.map((d, i) => (
                <li key={i} className="flex items-start space-x-2.5 text-xs text-slate-300">
                  <span className="text-emerald-400 font-bold mt-0.5">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* DONT's */}
          <div className="p-6 rounded-2xl bg-red-950/40 border border-red-800/40">
            <h3 className="text-red-400 font-bold text-base flex items-center space-x-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs">✕</span>
              <span>Things You MUST AVOID</span>
            </h3>
            <ul className="space-y-3">
              {donts.map((d, i) => (
                <li key={i} className="flex items-start space-x-2.5 text-xs text-slate-300">
                  <span className="text-red-400 font-bold mt-0.5">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
