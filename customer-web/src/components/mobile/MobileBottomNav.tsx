import React from 'react';
import { Home, Grid, Heart, ShoppingBag, User } from 'lucide-react';

export type BottomNavTab = 'home' | 'categories' | 'wishlist' | 'orders' | 'account';

interface MobileBottomNavProps {
  currentTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab
}) => {
  const tabs: { id: BottomNavTab; label: string; icon: any }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'categories', label: 'Categories', icon: Grid },
    { id: 'wishlist', label: 'Wishlist', icon: Heart },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'account', label: 'Account', icon: User }
  ];

  return (
    <nav className="sticky bottom-0 z-40 bg-white border-t border-slate-200 px-1 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 ${
              isActive ? 'text-purple' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-purple rounded-full" />
              )}
            </div>
            <span className={`text-[10px] mt-0.5 ${isActive ? 'font-bold text-purple' : 'font-medium text-slate-500'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
