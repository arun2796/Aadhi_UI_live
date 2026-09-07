import React from 'react';
import {
  Flame,
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  Twitter,
  Youtube
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

interface CustomerFooterProps {
  onNavigate: (page: string, params?: any) => void;
}

const SOCIAL_LINKS = [
  { icon: Facebook, label: 'Facebook' },
  { icon: Instagram, label: 'Instagram' },
  { icon: Twitter, label: 'Twitter' },
  { icon: Youtube, label: 'YouTube' }
];

const PAYMENT_BADGES = ['VISA', 'Mastercard', 'UPI', 'RuPay', 'COD'];

export const CustomerFooter: React.FC<CustomerFooterProps> = ({ onNavigate }) => {
  const { footerMessage, storeName, storeTagline, storeEmail, storePhone, storeAddress } = useSettings();

  const columns: Array<{
    title: string;
    links: Array<{ label: string; page: string; params?: any }>;
  }> = [
    {
      title: 'Shop',
      links: [
        { label: 'All Products', page: 'shop' },
        { label: 'Gift Boxes', page: 'shop', params: { category: 'gift-boxes' } },
        { label: 'Combo Offers', page: 'shop', params: { category: 'combo-offers' } },
        { label: 'Sparklers', page: 'shop', params: { category: 'sparklers' } },
        { label: 'Best Sellers', page: 'shop', params: { sortBy: 'popular' } }
      ]
    },
    {
      title: 'Customer Service',
      links: [
        { label: 'Track Order', page: 'track-order' },
        { label: 'Contact Us', page: 'contact' },
        { label: 'Shipping Policy', page: 'shipping-policy' },
        { label: 'Returns & Refunds', page: 'refund-policy' },
        { label: 'Safety Guide', page: 'safety' }
      ]
    },
    {
      title: 'About Us',
      links: [
        { label: 'Our Story', page: 'about' },
        { label: 'Terms & Conditions', page: 'terms' },
        { label: 'Privacy Policy', page: 'privacy' },
        { label: 'Contact & Wholesale', page: 'contact' }
      ]
    },
    {
      title: 'My Account',
      links: [
        { label: 'My Account', page: 'account' },
        { label: 'My Orders', page: 'my-orders' },
        { label: 'My Wishlist', page: 'wishlist' },
        { label: 'My Addresses', page: 'addresses' },
        { label: 'My Cart', page: 'cart' }
      ]
    }
  ];

  return (
    <footer className="bg-navy text-slate-400 text-xs border-t border-navy-border/60">
      {/* Main Footer: brand block + link columns */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
        {/* Brand Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange to-gold flex items-center justify-center shadow-glow">
              <Flame className="w-5 h-5 text-navy fill-current" />
            </div>
            <div>
              <div className="font-black text-lg text-white">{storeName || 'AADHI CRACKERS'}</div>
              {storeTagline && (
                <div className="text-[10px] text-gold font-medium tracking-wider uppercase">{storeTagline}</div>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            {storeAddress && (
              <div className="flex items-center space-x-2 text-slate-300">
                <MapPin className="w-4 h-4 text-orange flex-shrink-0" />
                <span>{storeAddress}</span>
              </div>
            )}
            {storePhone && (
              <div className="flex items-center space-x-2 text-slate-300">
                <Phone className="w-4 h-4 text-gold flex-shrink-0" />
                <span>{storePhone}</span>
              </div>
            )}
            {storeEmail && (
              <div className="flex items-center space-x-2 text-slate-300">
                <Mail className="w-4 h-4 text-purple-light flex-shrink-0" />
                <span>{storeEmail}</span>
              </div>
            )}
          </div>

          {/* Social icon circles */}
          <div className="flex items-center space-x-2.5 pt-2">
            {SOCIAL_LINKS.map(({ icon: Icon, label }) => (
              <button
                key={label}
                aria-label={label}
                className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-orange hover:border-orange hover:text-white transition-colors"
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Link Columns: Shop / Customer Service / About Us / My Account */}
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-navy-border pb-1">
              {col.title}
            </h4>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={`${col.title}-${link.label}`}>
                  <button
                    onClick={() => onNavigate(link.page, link.params)}
                    className="hover:text-gold transition-colors text-left"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Storefront-controlled footer message (Website.FooterMessage) */}
      {footerMessage && (
        <div className="max-w-7xl mx-auto px-4 pb-5">
          <p className="text-[11px] text-slate-500 leading-relaxed text-center">
            {footerMessage}
          </p>
        </div>
      )}

      {/* Bottom Bar: © line + payment badges */}
      <div className="border-t border-navy-border/40 py-4 px-4 bg-black/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-3">
          <div>© {new Date().getFullYear()} {storeName || 'Aadhi Crackers'}. All Rights Reserved.</div>
          <div className="flex items-center flex-wrap gap-2">
            {PAYMENT_BADGES.map((badge) => (
              <span
                key={badge}
                className="px-2.5 py-1 rounded bg-white/10 border border-white/10 font-bold text-[10px] tracking-wide text-slate-300"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
