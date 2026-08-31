import React from 'react';
import {
  Menu,
  Search,
  Heart,
  ShoppingBag,
  Flame,
  Bell,
  ChevronLeft
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';

interface MobileTopBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  onOpenDrawer?: () => void;
  onOpenSearch?: () => void;
  onOpenWishlist?: () => void;
  onOpenCart?: () => void;
  onOpenNotifications?: () => void;
  currentPage: string;
}

export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  title,
  showBack = false,
  onBack,
  onOpenDrawer,
  onOpenSearch,
  onOpenWishlist,
  onOpenCart,
  onOpenNotifications,
  currentPage
}) => {
  const { totalItems } = useCart();
  const { wishlist } = useWishlist();

  return (
    <header className="sticky top-0 z-40 bg-[#111238] text-white px-3.5 py-2.5 flex items-center justify-between shadow-md">
      {/* Left side: Back button or Hamburger menu */}
      <div className="flex items-center space-x-2">
        {showBack ? (
          <button
            onClick={onBack}
            className="p-1 text-slate-200 hover:text-white rounded-lg active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        ) : (
          <button
            onClick={onOpenDrawer}
            className="p-1 text-slate-200 hover:text-white rounded-lg active:scale-95 transition-transform"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
        )}

        {/* Title or Brand Logo */}
        {title ? (
          <h1 className="font-bold text-sm text-white truncate max-w-[180px]">{title}</h1>
        ) : (
          <div className="flex items-center space-x-1.5 cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-orange via-gold to-yellow-300 flex items-center justify-center shadow-xs">
              <Flame className="w-4 h-4 text-navy fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xs tracking-wider leading-none text-white">
                AADHI <span className="text-orange text-[10px] font-bold">CRACKERS</span>
              </span>
              <span className="text-[7px] text-gold font-bold tracking-widest uppercase">
                Celebrate Every Moment
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right Action Icons: Search, Wishlist, Notifications, Cart */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onOpenSearch}
          className="p-1 text-slate-200 hover:text-orange active:scale-95 transition-all"
          aria-label="Search"
        >
          <Search className="w-4 h-4 text-slate-200" />
        </button>

        <button
          onClick={onOpenWishlist}
          className="p-1 text-slate-200 hover:text-red-400 relative active:scale-95 transition-all"
          aria-label="Wishlist"
        >
          <Heart className={`w-4 h-4 ${wishlist.length > 0 ? 'text-red-400 fill-red-400' : 'text-slate-200'}`} />
          {wishlist.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">
              {wishlist.length}
            </span>
          )}
        </button>

        <button
          onClick={onOpenNotifications}
          className="p-1 text-slate-200 hover:text-gold relative active:scale-95 transition-all"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-slate-200" />
          <span className="absolute 0.5 top-0.5 right-0.5 w-2 h-2 bg-orange rounded-full" />
        </button>

        <button
          onClick={onOpenCart}
          className="p-1 text-slate-200 hover:text-orange relative active:scale-95 transition-all"
          aria-label="Cart"
        >
          <ShoppingBag className="w-4 h-4 text-gold" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange text-white rounded-full text-[9px] flex items-center justify-center font-black shadow-xs">
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
