import React from 'react';
import {
  X,
  Home,
  Grid,
  Gift,
  Package,
  Truck,
  Info,
  MapPin,
  Heart,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';

interface MobileSideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string, params?: any) => void;
}

export const MobileSideDrawer: React.FC<MobileSideDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const { user } = useAuth();
  const { totalItems } = useCart();
  const { wishlist } = useWishlist();

  if (!isOpen) return null;

  const menuItems = [
    { id: 'home', label: 'Home', icon: Home, page: 'home' },
    { id: 'categories', label: 'Categories', icon: Grid, page: 'category-menu' },
    { id: 'combos', label: 'Combos', icon: Package, page: 'shop', params: { view: 'combos' } },
    { id: 'gift-boxes', label: 'Gift Boxes', icon: Gift, page: 'shop', params: { view: 'giftboxes' } },
    { id: 'bulk-orders', label: 'Bulk Orders', icon: Truck, page: 'contact' },
    { id: 'about', label: 'About Us', icon: Info, page: 'about' },
    { id: 'track-order', label: 'Track Order', icon: MapPin, page: 'track-order' },
    { id: 'wishlist', label: 'My Wishlist', icon: Heart, page: 'wishlist', badge: wishlist.length },
    { id: 'cart', label: 'My Cart', icon: ShoppingBag, page: 'cart', badge: totalItems }
  ];

  return (
    <div className="absolute inset-0 z-50 overflow-hidden font-sans max-w-[425px] w-full mx-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="absolute inset-y-0 left-0 max-w-[280px] w-full bg-[#111238] text-white flex flex-col justify-between shadow-2xl z-10 animate-slide-in">
        <div className="flex flex-col h-full overflow-hidden">
          {/* User Profile Header */}
          <div className="p-4 border-b border-navy-border/60 flex items-center justify-between">
            <div
              onClick={() => { onClose(); onNavigate('account'); }}
              className="flex items-center space-x-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange to-gold flex items-center justify-center text-navy font-black text-sm shadow-glow">
                {user ? user.firstName.charAt(0) : 'A'}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-white truncate leading-tight group-hover:text-gold transition-colors">
                  {user ? `${user.firstName} ${user.lastName}` : 'Arun Kumar'}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">View Profile</div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Items List matching Screen 15 */}
          <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onClose();
                    onNavigate(item.page, item.params);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-navy-light flex items-center justify-between transition-all text-left active:bg-navy-light"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Brand Bar */}
          <div className="p-4 border-t border-navy-border/60 text-center">
            <div className="text-[10px] text-gold font-bold uppercase tracking-widest">AADHI CRACKERS</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Sivakasi Original • Since 1998</div>
          </div>
        </div>
      </div>
    </div>
  );
};
