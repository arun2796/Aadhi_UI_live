import React from 'react';
import { ChevronLeft, CheckCircle2, Truck, PackageCheck, Clock } from 'lucide-react';
import { MobileBottomNav } from './MobileBottomNav';

interface MobileNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string, params?: any) => void;
}

export const MobileNotificationsModal: React.FC<MobileNotificationsModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  if (!isOpen) return null;

  const notifications = [
    {
      id: 'notif-1',
      title: 'Order Confirmed',
      message: 'Your recent order has been confirmed & payment proof verified.',
      time: 'Recent',
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-600 border border-emerald-200'
    },
    {
      id: 'notif-2',
      title: 'Order Dispatched',
      message: 'Your fireworks order is packed and dispatched via Express Sivakasi Transit.',
      time: 'Recent',
      icon: Truck,
      color: 'bg-purple/10 text-purple border border-purple/20'
    },
    {
      id: 'notif-3',
      title: 'Out for Delivery',
      message: 'Your parcel is out for delivery with your local delivery agent.',
      time: 'Recent',
      icon: Clock,
      color: 'bg-orange/10 text-orange border border-orange/20'
    },
    {
      id: 'notif-4',
      title: 'Delivered Safely',
      message: 'Your order was safely delivered. Enjoy a dazzling celebration!',
      time: 'Recent',
      icon: PackageCheck,
      color: 'bg-emerald-50 text-emerald-600 border border-emerald-200'
    }
  ];

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col font-sans max-w-[425px] w-full mx-auto">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center bg-white shadow-xs">
        <button onClick={onClose} className="p-1 -ml-1 text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-sm text-navy ml-2">Notifications</h2>
      </div>

      {/* Notifications List matching Screen 16 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notifications.map((notif) => {
          const Icon = notif.icon;
          return (
            <div
              key={notif.id}
              onClick={() => {
                onClose();
                onNavigate('account');
              }}
              className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-start space-x-3.5 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${notif.color}`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs text-navy leading-tight">{notif.title}</div>
                <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">{notif.message}</div>
                <div className="text-[9px] text-slate-400 font-medium mt-1">{notif.time}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Nav */}
      <MobileBottomNav
        currentTab="home"
        onSelectTab={(tab) => {
          onClose();
          onNavigate(tab);
        }}
      />
    </div>
  );
};
