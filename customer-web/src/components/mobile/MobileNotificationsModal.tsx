import React from 'react';
import { ChevronLeft, Bell } from 'lucide-react';
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

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col font-sans max-w-[425px] w-full mx-auto">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center bg-white shadow-xs">
        <button onClick={onClose} className="p-1 -ml-1 text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-sm text-navy ml-2">Notifications</h2>
      </div>

      {/* Empty state — notifications arrive with live order updates */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
          <Bell className="w-7 h-7" />
        </div>
        <div className="text-sm font-bold text-navy">No notifications yet</div>
        <p className="text-[11px] text-slate-400 leading-relaxed max-w-[220px]">
          Updates about your orders and deliveries will appear here.
        </p>
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
