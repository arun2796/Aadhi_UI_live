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

/* ══════════════════════════════════════════════════════════════════════════════
   ORDER ESTIMATE SNAPSHOT — the printable order, kept on the device that placed it
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Why this exists.
 *
 * The order-confirmation screen has to be able to hand the customer their ESTIMATE
 * the moment they have paid — that is the whole point of the screen for a guest,
 * who has no My Orders to come back to. Building that document needs the order's
 * lines, address and billed charges, and:
 *
 *   • the only anonymous source of an order is `GET /orders/track/{orderNumber}`,
 *     whose `OrderTrackingDto` carries the lines and the grand total but NOT the
 *     packing charge, order discount, order tax or structured address;
 *   • `GET /orders/{id}`, which does carry all of it, requires a login;
 *   • and fetching anything on the click would put an `await` in front of
 *     `window.open`, which is exactly what makes browsers block it.
 *
 * `POST /orders` already returned the complete order at checkout, so the fields the
 * estimate needs are kept here and read back synchronously when the customer asks
 * for their copy. It is a CONVENIENCE cache with the same rules as the order-number
 * list above: the customer's own order, on the customer's own device, never trusted
 * for anything (nothing is authorised by it, and every screen still resolves the
 * order through the API), and every path degrades to `null` rather than throwing.
 */
export interface OrderEstimateSnapshot {
  orderNumber: string;
  placedAtUtc?: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: Record<string, any>;
  items: Array<Record<string, any>>;
  itemsSubtotal?: number;
  discount?: number;
  tax?: number;
  packingCharges?: number;
  packingChargePercent?: number;
  grandTotal?: number;
  /** Epoch ms this snapshot was written. */
  savedAt: number;
}

const ESTIMATE_KEY = 'aadhi_order_estimates';
const MAX_SNAPSHOTS = 5;

const numOrUndef = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
};

const readSnapshots = (): OrderEstimateSnapshot[] => {
  const ls = storage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(ESTIMATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: any) => s && typeof s.orderNumber === 'string' && s.orderNumber && Array.isArray(s.items)
    ) as OrderEstimateSnapshot[];
  } catch {
    return [];
  }
};

/**
 * Keeps the printable slice of a freshly created order (the `OrderDto` returned by
 * `POST /orders`). Only the fields the estimate prints are stored — no images, no
 * payment proof — so the entry stays a couple of kilobytes.
 */
export const rememberOrderEstimate = (order: any): void => {
  const orderNumber = String(order?.orderNumber ?? '').trim();
  if (!orderNumber) return;
  const ls = storage();
  if (!ls) return;

  try {
    const snapshot: OrderEstimateSnapshot = {
      orderNumber,
      placedAtUtc: order?.placedAtUtc ?? order?.placedAt ?? undefined,
      customerName: order?.customerName || order?.shippingAddress?.fullName || undefined,
      customerPhone: order?.customerPhone || order?.shippingAddress?.phone || undefined,
      shippingAddress: order?.shippingAddress
        ? {
            fullName: order.shippingAddress.fullName,
            phone: order.shippingAddress.phone,
            addressLine1: order.shippingAddress.addressLine1,
            addressLine2: order.shippingAddress.addressLine2,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            postalCode: order.shippingAddress.postalCode
          }
        : undefined,
      items: (Array.isArray(order?.items) ? order.items : []).map((it: any) => ({
        productName: it?.productName ?? it?.name ?? undefined,
        sku: it?.sku || undefined,
        quantity: Number(it?.quantity) || 1,
        unitPrice: Number(it?.unitPrice) || 0,
        compareAtPrice: numOrUndef(it?.compareAtPrice),
        discount: numOrUndef(it?.discount),
        tax: numOrUndef(it?.tax),
        lineTotal: numOrUndef(it?.lineTotal)
      })),
      itemsSubtotal: numOrUndef(order?.itemsSubtotal),
      discount: numOrUndef(order?.discount),
      tax: numOrUndef(order?.tax),
      packingCharges: numOrUndef(order?.packingCharges),
      packingChargePercent: numOrUndef(order?.packingChargePercent),
      grandTotal: numOrUndef(order?.grandTotal),
      savedAt: Date.now()
    };

    const next = [
      snapshot,
      ...readSnapshots().filter(
        s => s.orderNumber.toUpperCase() !== orderNumber.toUpperCase()
      )
    ].slice(0, MAX_SNAPSHOTS);

    ls.setItem(ESTIMATE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — the screens fall back to the tracking payload */
  }
};

/** The snapshot for one order number, or `null` when this device does not hold it. */
export const readOrderEstimate = (orderNumber?: string | null): OrderEstimateSnapshot | null => {
  const clean = String(orderNumber ?? '').trim();
  if (!clean) return null;
  return (
    readSnapshots().find(s => s.orderNumber.toUpperCase() === clean.toUpperCase()) || null
  );
};
