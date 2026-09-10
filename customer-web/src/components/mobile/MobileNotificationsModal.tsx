import React, { useEffect, useMemo } from 'react';
import { ChevronLeft, Bell, Clock, Truck } from 'lucide-react';
import { MobileBottomNav } from './MobileBottomNav';
import { NotificationRow, shipmentCardRowIds } from '../common/CommonComponents';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import type { AppNotification } from '../../services/api';

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
  const { user } = useAuth();
  const {
    items,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasMore,
    hasLoaded,
    refresh,
    loadMore,
    markRead,
    markAllRead
  } = useNotifications();

  const signedIn = Boolean(user);
  // The carrier + LR is repeated across rows for the same shipment; state it once.
  const shipmentRows = useMemo(() => shipmentCardRowIds(items), [items]);

  // Opening the sheet is the moment the customer asks "what happened to my
  // order?" — answer with the current feed, not whatever was last fetched.
  useEffect(() => {
    if (isOpen && signedIn) refresh();
  }, [isOpen, signedIn, refresh]);

  if (!isOpen) return null;

  /* Opening one notification marks it read and, when it belongs to an order,
     goes to that order's tracking screen (/track/<orderNumber>, which works for
     everyone). A notification with no order simply gets marked read. */
  const handleOpen = (notification: AppNotification) => {
    if (!notification.isRead) markRead(notification.id);
    if (notification.orderNumber) {
      onClose();
      onNavigate('track-order', { orderNumber: notification.orderNumber });
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col font-sans max-w-[425px] w-full mx-auto">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center bg-white shadow-xs">
        <button onClick={onClose} className="p-1 -ml-1 text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-sm text-navy ml-2">Notifications</h2>
        {unreadCount > 0 && (
          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-orange text-white text-[10px] font-black leading-none">
            {unreadCount}
          </span>
        )}
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="ml-auto text-[11px] font-bold text-purple active:scale-95 transition-transform"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!signedIn ? (
          /* A guest has no account for the bell to answer about. Their order
             number is their handle, so point them at Track Order. */
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
              <Bell className="w-7 h-7" />
            </div>
            <div className="text-sm font-bold text-navy">Sign in to see your updates</div>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-[240px]">
              Ordered without an account? Track it with your order number to see when it
              ships and which transport office to collect from.
            </p>
            <div className="flex flex-col items-center space-y-2 pt-1">
              <button
                onClick={() => { onClose(); onNavigate('auth', { initialTab: 'login' }); }}
                className="px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => { onClose(); onNavigate('track-order'); }}
                className="text-[11px] font-bold text-purple flex items-center space-x-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Track an order</span>
              </button>
            </div>
          </div>
        ) : isLoading && items.length === 0 ? (
          <div className="p-10 text-center">
            <Clock className="w-6 h-6 text-purple animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Fetching your order updates...</p>
          </div>
        ) : items.length === 0 ? (
          /* Nothing has happened yet — say exactly that, and nothing more. */
          hasLoaded ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                <Bell className="w-7 h-7" />
              </div>
              <div className="text-sm font-bold text-navy">No notifications yet</div>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-[220px]">
                Updates about your orders and deliveries will appear here.
              </p>
            </div>
          ) : null
        ) : (
          <div className="p-4 space-y-2.5">
            {items.map(notification => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={handleOpen}
                showCarrierDetails={shipmentRows.has(notification.id)}
              />
            ))}

            {hasMore && (
              <button
                onClick={() => loadMore()}
                disabled={isLoadingMore}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-[11px] font-bold text-purple disabled:text-slate-400 active:scale-98 transition-all"
              >
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        )}
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
