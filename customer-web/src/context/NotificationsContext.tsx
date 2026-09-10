import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, type AppNotification } from '../services/api';
import { useAuth } from './AuthContext';

/**
 * The signed-in customer's order-update feed, held in one place so the bell badge
 * in the mobile top bar, the bell in the desktop header and whichever panel is
 * open all read the SAME unread count.
 *
 * That count is never derived twice: POST /notifications/{id}/read and
 * /notifications/read-all both answer with the new unread count, and that number
 * is adopted verbatim — no refetch, no local arithmetic left standing.
 *
 * Everything here is best-effort. api.getNotifications never throws (it answers
 * with an empty page on failure), so a customer whose network drops keeps the
 * feed they already had rather than seeing an error.
 *
 * Guests are deliberately absent from this file: they have no identity for the
 * API to answer about. Their updates come from the anonymous per-order feed on
 * the Track Order screens (see OrderUpdates in components/common/CommonComponents).
 */

const PAGE_SIZE = 20;

/** Background re-check while the tab is in the foreground. The whole point of
 *  the feature is that the customer learns WHEN THE ORDER SHIPS, so the badge
 *  should not have to wait for a full page reload — but one small GET a minute
 *  is as often as it is worth asking. */
const POLL_INTERVAL_MS = 60_000;

interface NotificationsContextType {
  items: AppNotification[];
  unreadCount: number;
  /** A fetch is in flight; the caller decides whether that means a spinner. */
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  /** True once the feed has been fetched at least once for this customer. */
  hasLoaded: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  /** How many pages are already in `items`, so a background refresh never throws
   *  away the pages the customer asked for with "Load more". */
  const pagesLoaded = useRef(1);
  const inFlight = useRef(false);
  const signedIn = useRef(false);
  const itemsRef = useRef<AppNotification[]>([]);
  const unreadRef = useRef(0);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { unreadRef.current = unreadCount; }, [unreadCount]);
  // Declared before the load/reset effect below so the flag is already correct
  // when that one runs.
  useEffect(() => { signedIn.current = Boolean(user); }, [user]);

  const refresh = useCallback(async () => {
    if (!signedIn.current || inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    try {
      const page = await api.getNotifications(1, PAGE_SIZE);
      if (!signedIn.current) return; // signed out while the request was in flight
      // A failed call is indistinguishable from an empty feed (both answer with
      // an empty page), and the feed never shrinks to nothing on its own — so an
      // empty answer leaves an already-populated list exactly as it was.
      if (page.items.length === 0 && page.totalCount === 0 && itemsRef.current.length > 0) return;
      setItems(page.items);
      setUnreadCount(page.unreadCount);
      setHasMore(page.hasNextPage);
      pagesLoaded.current = 1;
    } finally {
      inFlight.current = false;
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!signedIn.current || inFlight.current) return;
    inFlight.current = true;
    setIsLoadingMore(true);
    try {
      const next = pagesLoaded.current + 1;
      const page = await api.getNotifications(next, PAGE_SIZE);
      if (!signedIn.current) return;
      if (page.items.length === 0) {
        setHasMore(false);
        return;
      }
      setItems(prev => {
        const seen = new Set(prev.map(n => n.id));
        return [...prev, ...page.items.filter(n => !seen.has(n.id))];
      });
      pagesLoaded.current = next;
      setUnreadCount(page.unreadCount);
      setHasMore(page.hasNextPage);
    } finally {
      inFlight.current = false;
      setIsLoadingMore(false);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    if (!signedIn.current || !id) return;
    const target = itemsRef.current.find(n => n.id === id);
    if (!target || target.isRead) return;

    const readAt = new Date().toISOString();
    setItems(prev => prev.map(n => (n.id === id ? { ...n, isRead: true, readAtUtc: readAt } : n)));
    setUnreadCount(count => Math.max(0, count - 1));

    const result = await api.markNotificationRead(id);
    if (result) {
      setUnreadCount(result.unreadCount);
      return;
    }
    // The call did not land — put the row back the way the server still holds it.
    setItems(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: false, readAtUtc: target.readAtUtc } : n))
    );
    setUnreadCount(count => count + 1);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!signedIn.current) return;
    const snapshot = itemsRef.current;
    const previousUnread = unreadRef.current;
    if (previousUnread === 0 && !snapshot.some(n => !n.isRead)) return;

    const readAt = new Date().toISOString();
    setItems(prev => prev.map(n => (n.isRead ? n : { ...n, isRead: true, readAtUtc: readAt })));
    setUnreadCount(0);

    const result = await api.markAllNotificationsRead();
    if (result) {
      setUnreadCount(result.unreadCount);
      return;
    }
    setItems(snapshot);
    setUnreadCount(previousUnread);
  }, []);

  // Sign in → load the feed. Sign out → forget it entirely; the next customer on
  // this browser must never see the last one's orders.
  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      setHasMore(false);
      setHasLoaded(false);
      setIsLoading(false);
      setIsLoadingMore(false);
      pagesLoaded.current = 1;
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Keep the badge current while the customer is looking at the shop.
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      // Refreshing resets the list to page 1, so skip it while the customer is
      // reading a list they expanded themselves.
      if (pagesLoaded.current > 1) return;
      refresh();
    };
    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, refresh]);

  return (
    <NotificationsContext.Provider
      value={{
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
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
};
