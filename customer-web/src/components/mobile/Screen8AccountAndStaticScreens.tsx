import React from 'react';
import {
  User,
  ShoppingBag,
  Heart,
  MapPin,
  Lock,
  Bell,
  LogOut,
  ChevronRight,
  Phone,
  Mail,
  Clock,
  Award,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  Flame,
  ChevronLeft
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';

interface Screen8AccountProps {
  onNavigate: (page: string, params?: any) => void;
  onOpenNotifications: () => void;
}

export const Screen8Account: React.FC<Screen8AccountProps> = ({ onNavigate, onOpenNotifications }) => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const menuItems = [
    { label: 'My Orders', icon: ShoppingBag, action: () => onNavigate('orders') },
    { label: 'My Wishlist', icon: Heart, action: () => onNavigate('wishlist') },
    { label: 'Addresses', icon: MapPin, action: () => showToast('Saved addresses view', 'info') },
    { label: 'Profile Information', icon: User, action: () => showToast('Profile details', 'info') },
    { label: 'Change Password', icon: Lock, action: () => showToast('Change password modal', 'info') },
    { label: 'Notification Preferences', icon: Bell, action: onOpenNotifications },
    { label: 'Log Out', icon: LogOut, action: () => { logout(); showToast('Logged out', 'info'); } }
  ];

  return (
    <div className="space-y-4 p-4 pb-8 font-sans bg-[#fbfbfb]">
      {/* Title */}
      <h2 className="text-base font-black text-navy">My Account</h2>

      {/* User Profile Card matching Screen 8 */}
      <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center space-x-3.5">
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple to-purple-dark text-white font-black text-base flex items-center justify-center shadow-md">
          {user ? user.firstName.charAt(0) : 'A'}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-navy truncate">
            {user ? `${user.firstName} ${user.lastName}` : 'Arun Kumar'}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium truncate">
            {user?.email || 'arun.kumar@email.com'}
          </p>
        </div>
      </div>

      {/* Menu List matching Screen 8 */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {menuItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={item.action}
              className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <Icon className="w-4 h-4 text-slate-500" />
                <span>{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const Screen9AboutUs: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="space-y-4 p-4 pb-8 font-sans bg-[#fbfbfb]">
      {/* Title Header */}
      <div className="flex items-center space-x-2">
        <button onClick={onBack} className="p-1 -ml-1 text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-base font-black text-navy">About Aadhi Crackers</h2>
      </div>

      {/* Storefront Photo Card matching Screen 9 */}
      <div className="rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-lg relative aspect-16/10">
        <img
          src="https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600&auto=format&fit=crop&q=80"
          alt="Aadhi Crackers Store"
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent flex items-end p-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-orange flex items-center justify-center shadow-md">
              <Flame className="w-5 h-5 text-white fill-current" />
            </div>
            <div>
              <div className="font-black text-sm text-white">AADHI CRACKERS</div>
              <div className="text-[9px] text-gold font-bold uppercase">Sivakasi Original</div>
            </div>
          </div>
        </div>
      </div>

      {/* Description Text */}
      <p className="text-xs text-slate-600 leading-relaxed">
        Aadhi Crackers is your one-stop destination for premium quality crackers for all your celebrations. We are committed to providing 100% original products, safe packaging and on-time delivery.
      </p>

      {/* 4 Feature Badges in 2x2 Grid matching Screen 9 */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center space-x-2.5">
          <Award className="w-5 h-5 text-orange flex-shrink-0" />
          <div>
            <div className="font-bold text-xs text-navy">Best Quality</div>
            <div className="text-[9px] text-slate-400">100% Original</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center space-x-2.5">
          <Sparkles className="w-5 h-5 text-purple flex-shrink-0" />
          <div>
            <div className="font-bold text-xs text-navy">Wide Range</div>
            <div className="text-[9px] text-slate-400">500+ Products</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center space-x-2.5">
          <Truck className="w-5 h-5 text-gold flex-shrink-0" />
          <div>
            <div className="font-bold text-xs text-navy">Timely Delivery</div>
            <div className="text-[9px] text-slate-400">On Time, Every Time</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center space-x-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <div className="font-bold text-xs text-navy">Safe & Trusted</div>
            <div className="text-[9px] text-slate-400">Secure Packaging</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Screen10ContactUs: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="space-y-4 p-4 pb-8 font-sans bg-[#fbfbfb]">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <button onClick={onBack} className="p-1 -ml-1 text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-base font-black text-navy">Contact Us</h2>
      </div>

      {/* Info Card matching Screen 10 */}
      <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-card space-y-4 text-xs">
        <div className="flex items-start space-x-3 text-slate-600">
          <MapPin className="w-4 h-4 text-orange flex-shrink-0 mt-0.5" />
          <span>123, West Street, Shivanandapuram, Coimbatore - 641012</span>
        </div>

        <div className="flex items-center space-x-3 text-slate-600">
          <Phone className="w-4 h-4 text-gold flex-shrink-0" />
          <span className="font-bold text-navy">+91 98765 43210</span>
        </div>

        <div className="flex items-center space-x-3 text-slate-600">
          <Mail className="w-4 h-4 text-purple flex-shrink-0" />
          <span>support@aadhicrackers.com</span>
        </div>

        <div className="flex items-start space-x-3 text-slate-600 pt-2 border-t border-slate-100">
          <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-navy">Mon - Sat: 8:00 AM - 8:00 PM</div>
            <div className="text-slate-400">Sunday: 10:00 AM - 6:00 PM</div>
          </div>
        </div>
      </div>

      {/* Follow Us social buttons matching Screen 10 */}
      <div className="space-y-2 pt-2">
        <h3 className="font-bold text-xs text-navy uppercase tracking-wider">Follow Us</h3>
        <div className="flex items-center space-x-3">
          <a
            href="#"
            className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs"
          >
            f
          </a>
          <a
            href="#"
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs"
          >
            📸
          </a>
          <a
            href="#"
            className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm shadow-xs"
          >
            ▶
          </a>
        </div>
      </div>
    </div>
  );
};

export const Screen13Wishlist: React.FC<{
  onNavigate: (page: string, params?: any) => void;
}> = ({ onNavigate }) => {
  const { wishlist, toggleWishlist } = useWishlist();

  const defaultItems = [
    { id: 'w-1', name: 'Mega Celebration Box', price: 4499, slug: 'mega-celebration-box', img: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=300&auto=format&fit=crop&q=80' },
    { id: 'w-2', name: 'Ground Chakkar Deluxe', price: 280, slug: 'ground-chakkar-deluxe', img: 'https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?w=300&auto=format&fit=crop&q=80' },
    { id: 'w-3', name: 'Flower Pots (Big)', price: 120, slug: 'flower-pots-big', img: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=300&auto=format&fit=crop&q=80' },
    { id: 'w-4', name: 'Aerial Shot - 30 Shots', price: 249, slug: 'aerial-shot-30-shots', img: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=300&auto=format&fit=crop&q=80' }
  ];

  return (
    <div className="space-y-3 p-4 pb-8 font-sans bg-[#fbfbfb]">
      <h2 className="text-base font-black text-navy">My Wishlist (4)</h2>

      {/* 4 Items List matching Screen 13 */}
      <div className="space-y-2.5">
        {defaultItems.map((item) => (
          <div
            key={item.id}
            onClick={() => onNavigate('product-detail', { slug: item.slug })}
            className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <img
                src={item.img}
                alt={item.name}
                className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-100 flex-shrink-0"
              />
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-navy truncate">{item.name}</h4>
                <div className="text-xs font-black text-slate-700 mt-0.5">
                  ₹{item.price.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Filled Red Heart */}
            <button
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="p-2 text-red-500 hover:scale-110 transition-transform"
            >
              <Heart className="w-5 h-5 fill-red-500 text-red-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const Screen14CategoryMenu: React.FC<{
  onNavigate: (page: string, params?: any) => void;
}> = ({ onNavigate }) => {
  const categoriesList = [
    { name: 'Sparklers', slug: 'sparklers', icon: '✨' },
    { name: 'Ground Chakkar', slug: 'ground-chakkar', icon: '🌀' },
    { name: 'Aerial Shots', slug: 'aerial-shots', icon: '🎆' },
    { name: 'Rockets', slug: 'rockets', icon: '🚀' },
    { name: 'Flower Pots', slug: 'flower-pots', icon: '🏺' },
    { name: 'Gift Boxes', slug: 'gift-boxes', icon: '🎁' },
    { name: 'Combo Offers', slug: 'combo-offers', icon: '📦' },
    { name: 'Fancy Items', slug: 'fancy-items', icon: '🦚' },
    { name: 'New Arrivals', slug: 'new-arrivals', icon: '🆕' }
  ];

  return (
    <div className="space-y-3 p-4 pb-8 font-sans bg-[#fbfbfb]">
      <h2 className="text-base font-black text-navy">Categories</h2>

      {/* 9 Category Items matching Screen 14 */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {categoriesList.map((c, i) => (
          <button
            key={i}
            onClick={() => onNavigate('category', { category: c.slug })}
            className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <span className="text-base">{c.icon}</span>
              <span>{c.name}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  );
};
