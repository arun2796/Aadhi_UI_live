/**
 * Recent order numbers placed on THIS device.
 *
 * Customers are never forced to sign in, so a guest has no My Orders list — their
 * order number is the only handle they have on the order. This keeps the last few
 * numbers in localStorage so the storefront can offer "recent orders on this
 * device" and hand them straight back to /track/<orderNumber>.
 *
 * It is a CONVENIENCE, never a security assumption:
 *   • the list is plain, unsigned localStorage that anyone on the device can read
 *     or forge, so it grants no access on its own;
 *   • every screen that uses it still resolves the number through the API
 *     (GET /orders/track/{orderNumber}), which is the real source of truth;
 *   • nothing here is required for the purchase flow to work.
 *
 * Storage being unavailable is a NORMAL outcome — private windows, blocked site
 * data, a full quota, or a non-browser build — so every function degrades to a
 * no-op / empty list instead of throwing. Reads and writes are each wrapped
 * because `localStorage` can throw on ACCESS, not just on use.
 */

const STORAGE_KEY = 'aadhi_recent_orders';
const MAX_REMEMBERED = 8;

export interface RecentOrder {
  orderNumber: string;
  /** Epoch ms the order was placed on this device. */
  placedAt: number;
}

/** Returns localStorage only when it can actually be read AND written. */
const storage = (): Storage | null => {
  try {
    const ls = window.localStorage;
    const probe = '__aadhi_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
};

/** True when "recent orders on this device" can be offered at all. */
export const canRememberOrders = (): boolean => storage() !== null;

const sanitise = (raw: unknown): RecentOrder[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: RecentOrder[] = [];
  for (const entry of raw) {
    const orderNumber = String((entry as any)?.orderNumber ?? '').trim();
    if (!orderNumber || seen.has(orderNumber.toUpperCase())) continue;
    seen.add(orderNumber.toUpperCase());
    const placedAt = Number((entry as any)?.placedAt);
    out.push({ orderNumber, placedAt: Number.isFinite(placedAt) ? placedAt : 0 });
    if (out.length >= MAX_REMEMBERED) break;
  }
  return out;
};

/** Newest first. `[]` when storage is unavailable or holds nothing usable. */
export const readRecentOrders = (): RecentOrder[] => {
  const ls = storage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitise(JSON.parse(raw));
  } catch {
    return [];
  }
};

/** Adds (or refreshes) one order number. Silently does nothing without storage. */
export const rememberOrderNumber = (orderNumber?: string | null): void => {
  const clean = String(orderNumber ?? '').trim();
  if (!clean) return;
  const ls = storage();
  if (!ls) return;
  try {
    const next = [
      { orderNumber: clean, placedAt: Date.now() },
      ...readRecentOrders().filter(o => o.orderNumber.toUpperCase() !== clean.toUpperCase())
    ].slice(0, MAX_REMEMBERED);
    ls.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — the order number is still shown on screen */
  }
};

/** Removes one remembered number (the customer dismissing it from this device). */
export const forgetOrderNumber = (orderNumber: string): RecentOrder[] => {
  const ls = storage();
  const remaining = readRecentOrders().filter(
    o => o.orderNumber.toUpperCase() !== String(orderNumber ?? '').trim().toUpperCase()
  );
  if (!ls) return remaining;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } catch {
    /* ignore */
  }
  return remaining;
};

/**
 * Copies text to the clipboard, falling back to a hidden <textarea> + execCommand
 * for browsers or insecure origins where the async Clipboard API is unavailable.
 */
export const copyText = async (text: string): Promise<boolean> => {
  const value = String(text ?? '');
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
};
