import React from 'react';
import {
  Flame,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  CreditCard,
  Heart
} from 'lucide-react';

interface CustomerFooterProps {
  onNavigate: (page: string, params?: any) => void;
}

export const CustomerFooter: React.FC<CustomerFooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-navy-dark text-slate-400 text-xs border-t border-navy-border/60">
      {/* Top Features Banner */}
      <div className="bg-navy border-b border-navy-border/40 py-8 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-orange/10 border border-orange/20 flex items-center justify-center text-orange flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">100% Original Products</div>
              <div className="text-slate-400 text-[11px]">Direct from Sivakasi factory</div>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold flex-shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">Fast & Safe Delivery</div>
              <div className="text-slate-400 text-[11px]">Specialized hazardous-cargo transport</div>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple/10 border border-purple/20 flex items-center justify-center text-purple-light flex-shrink-0">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">Best Guaranteed Prices</div>
              <div className="text-slate-400 text-[11px]">Direct wholesale festival rates</div>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">24/7 Customer Support</div>
              <div className="text-slate-400 text-[11px]">Phone & WhatsApp assistance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        {/* Brand Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange to-gold flex items-center justify-center shadow-glow">
              <Flame className="w-5 h-5 text-navy fill-current" />
            </div>
            <div>
              <div className="font-black text-lg text-white">AADHI CRACKERS</div>
              <div className="text-[10px] text-gold font-medium tracking-wider uppercase">Celebrate Every Moment</div>
            </div>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
            AADHI CRACKERS is Sivakasi’s most trusted manufacturer and distributor of premium quality, eco-conscious fireworks and family gift boxes. Delivering joy and sparkle across India since 1998.
          </p>
          <div className="space-y-2 pt-2 text-xs">
            <div className="flex items-center space-x-2 text-slate-300">
              <MapPin className="w-4 h-4 text-orange flex-shrink-0" />
              <span>124/B Sivakasi Main Road, Thiruthangal, Sivakasi, Tamil Nadu - 626130</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <Phone className="w-4 h-4 text-gold flex-shrink-0" />
              <span>+91 98765 43210 / +91 94433 12345</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <Mail className="w-4 h-4 text-purple-light flex-shrink-0" />
              <span>support@aadhicrackers.com</span>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-navy-border pb-1">
            Top Categories
          </h4>
          <ul className="space-y-2.5">
            {['Gift Boxes', 'Combo Offers', 'Sparklers', 'Ground Chakkar', 'Flower Pots', 'Rockets', 'Aerial Shots'].map((c) => (
              <li key={c}>
                <button
                  onClick={() => onNavigate('shop', { category: c.toLowerCase().replace(/\s+/g, '-') })}
                  className="hover:text-gold transition-colors"
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-navy-border pb-1">
            Quick Links
          </h4>
          <ul className="space-y-2.5">
            <li><button onClick={() => onNavigate('home')} className="hover:text-gold transition-colors">Home</button></li>
            <li><button onClick={() => onNavigate('shop')} className="hover:text-gold transition-colors">All Fireworks</button></li>
            <li><button onClick={() => onNavigate('track-order')} className="hover:text-gold transition-colors">Track Your Order</button></li>
            <li><button onClick={() => onNavigate('about')} className="hover:text-gold transition-colors">About Us</button></li>
            <li><button onClick={() => onNavigate('contact')} className="hover:text-gold transition-colors">Contact & Wholesale</button></li>
            <li><button onClick={() => onNavigate('safety')} className="hover:text-gold transition-colors">Safety Precautions</button></li>
            <li><button onClick={() => onNavigate('erp-dashboard')} className="hover:text-gold text-purple-light font-semibold transition-colors">Admin ERP Login</button></li>
          </ul>
        </div>

        {/* Policies & Apps */}
        <div>
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-navy-border pb-1">
            Policies & Trust
          </h4>
          <ul className="space-y-2.5">
            <li><button onClick={() => onNavigate('terms')} className="hover:text-gold transition-colors">Terms & Conditions</button></li>
            <li><button onClick={() => onNavigate('privacy')} className="hover:text-gold transition-colors">Privacy Policy</button></li>
            <li><button onClick={() => onNavigate('shipping-policy')} className="hover:text-gold transition-colors">Shipping & Dangerous Goods</button></li>
            <li><button onClick={() => onNavigate('refund-policy')} className="hover:text-gold transition-colors">Cancellation & Returns</button></li>
          </ul>

          <div className="mt-6">
            <div className="text-[11px] font-semibold text-white mb-2">Accepted Payment Modes:</div>
            <div className="flex flex-wrap gap-2 text-slate-300">
              <span className="px-2 py-1 rounded bg-navy-light border border-navy-border font-medium text-[10px]">UPI</span>
              <span className="px-2 py-1 rounded bg-navy-light border border-navy-border font-medium text-[10px]">Google Pay</span>
              <span className="px-2 py-1 rounded bg-navy-light border border-navy-border font-medium text-[10px]">PhonePe</span>
              <span className="px-2 py-1 rounded bg-navy-light border border-navy-border font-medium text-[10px]">Cards</span>
              <span className="px-2 py-1 rounded bg-navy-light border border-navy-border font-medium text-[10px]">COD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-navy-border/40 py-4 px-4 bg-black/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div>
            © {new Date().getFullYear()} AADHI CRACKERS. All Rights Reserved. Sivakasi, Tamil Nadu, India.
          </div>
          <div className="flex items-center space-x-1">
            <span>Crafted with</span>
            <Heart className="w-3 h-3 text-red-500 fill-current" />
            <span>for Festive Celebrations</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
