/* ══════════════════════════════════════════════════════════════════════════════
   INVOICE ACTIONS — the single place that turns an order into the customer's copy
   of the ESTIMATE, on every surface that offers it.

   Four surfaces (× two trees) print the same document: My Orders → Order Details,
   the order-confirmation "Thank You" screen and the public Track Order screen.
   They all route through `printEstimate` / `downloadEstimate` here so the awkward
   part — a `window.open` that mobile Chrome silently refuses — is solved once.

   POP-UP BLOCKING (the whole reason this file exists)
   ---------------------------------------------------
   `window.open` returns null when the browser blocks it, and mobile Chrome blocks
   it routinely. The old call sites wrote straight into the returned window, so a
   blocked pop-up meant the button simply did nothing. Here every action:
     • runs entirely SYNCHRONOUSLY inside the click — nothing is awaited before
       `window.open`, or the browser stops treating it as a user gesture and
       blocks it even when pop-ups are allowed;
     • falls back to printing from a hidden same-origin iframe when the pop-up is
       refused, which needs no pop-up permission at all;
     • reports failure to the caller so it can raise a toast, instead of failing
       silently.
   ════════════════════════════════════════════════════════════════════════════ */

import {
  buildEstimateHtml,
  DEFAULT_INVOICE_BRANDING,
  type EstimateOrder,
  type EstimateOrderItem,
  type InvoiceBranding
} from './invoiceTemplate';

/** Why an invoice action could not complete. The caller turns it into a toast. */
export type EstimateFailure =
  /** Pop-up refused AND the iframe fallback could not print. */
  | 'blocked'
  /** The browser would not produce the file at all (no Blob / object URL). */
  | 'unsupported';

export const ESTIMATE_FAILURE_MESSAGE: Record<EstimateFailure, string> = {
  blocked:
    'Your browser blocked the invoice window. Please allow pop-ups for this site, or use Download instead.',
  unsupported: 'This browser could not create the invoice file. Please try a different browser.'
};

/* ── File naming ─────────────────────────────────────────────────────────────── */

const safeFilePart = (value?: string): string =>
  (value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ORDER';

/** e.g. `ESTIMATE-ORD-2026-000013.html` */
export const estimateFileName = (order: EstimateOrder): string =>
  `ESTIMATE-${safeFilePart(order.orderNumber)}.html`;

/* ── Print ───────────────────────────────────────────────────────────────────── */

/**
 * Prints from a hidden, same-origin iframe. `srcdoc` keeps the frame same-origin,
 * so calling `print()` on its window is allowed; no pop-up permission is involved,
 * which is what makes this the right fallback on mobile Chrome.
 *
 * The frame is deliberately NOT `display:none` / `visibility:hidden` — a frame that
 * was never laid out refuses to print in some engines — so it is parked off-screen
 * at zero size instead.
 */
const printFromHiddenFrame = (html: string, onFailure?: (r: EstimateFailure) => void): boolean => {
  try {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    frame.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;padding:0;margin:0;';

    const remove = () => {
      try {
        frame.remove();
      } catch {
        /* already gone */
      }
    };

    frame.onload = () => {
      try {
        const w = frame.contentWindow;
        if (!w) throw new Error('iframe has no window');
        w.focus();
        w.print();
      } catch {
        remove();
        onFailure?.('blocked');
        return;
      }
      // The print dialog is modal but not observable; keep the frame alive well
      // past any plausible dialog, then tidy up.
      window.setTimeout(remove, 60000);
    };

    frame.srcdoc = html;
    document.body.appendChild(frame);
    return true;
  } catch {
    return false;
  }
};

/**
 * Opens the estimate for printing / Save-as-PDF.
 *
 * MUST be called directly from the click handler with nothing awaited first.
 */
export const printEstimate = (
  order: EstimateOrder,
  branding: InvoiceBranding = DEFAULT_INVOICE_BRANDING,
  onFailure?: (reason: EstimateFailure) => void
): void => {
  let html: string;
  try {
    html = buildEstimateHtml(order, branding);
  } catch {
    onFailure?.('unsupported');
    return;
  }

  // 1. A real window is the best outcome: the customer sees the document, can
  //    print it, save it as a PDF, or just keep it open.
  let popup: Window | null = null;
  try {
    popup = window.open('', '_blank', 'width=820,height=940');
  } catch {
    popup = null;
  }

  if (popup && !popup.closed) {
    try {
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      window.setTimeout(() => {
        try {
          if (!popup!.closed) popup!.print();
        } catch {
          /* the reader can still print from the window they can see */
        }
      }, 400);
      return;
    } catch {
      try {
        popup.close();
      } catch {
        /* ignore */
      }
    }
  }

  // 2. Pop-up refused (the norm on mobile Chrome) — print from a hidden iframe.
  if (printFromHiddenFrame(html, onFailure)) return;

  // 3. Nothing worked. Say so rather than doing nothing.
  onFailure?.('blocked');
};

/* ── Download ────────────────────────────────────────────────────────────────── */

/**
 * Saves the estimate as a real file named after the order
 * (`ESTIMATE-ORD-2026-000013.html`) via a Blob + object URL + `<a download>`.
 *
 * MUST be called directly from the click handler.
 */
export const downloadEstimate = (
  order: EstimateOrder,
  branding: InvoiceBranding = DEFAULT_INVOICE_BRANDING,
  onFailure?: (reason: EstimateFailure) => void
): void => {
  let url = '';
  try {
    const html = buildEstimateHtml(order, branding);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    if ('download' in a) {
      a.href = url;
      a.download = estimateFileName(order);
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      // Browsers that ignore the download attribute can still be handed the
      // document to save manually.
      const w = window.open(url, '_blank');
      if (!w) {
        URL.revokeObjectURL(url);
        onFailure?.('blocked');
        return;
      }
    }

    // Revoked once the browser has certainly taken the bytes — revoking straight
    // away cancels the save in Safari and Firefox.
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }, 60000);
  } catch {
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    onFailure?.('unsupported');
  }
};

/* ── Order → estimate shape ──────────────────────────────────────────────────── */

const numberOrUndefined = (...values: unknown[]): number | undefined => {
  for (const v of values) {
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return undefined;
};

/**
 * Maps any of the storefront's order payloads onto the estimate's order shape:
 * the full `OrderDto` (My Orders / checkout response), the checkout snapshot kept
 * on the device, and the anonymous `OrderTrackingDto` from
 * `GET /orders/track/{orderNumber}`.
 *
 * Nothing is invented. A field the payload does not carry stays undefined and the
 * template leaves its cell blank or, for the totals, states the balance honestly.
 * `overrides` is for values the SERVER confirmed elsewhere in the same flow — the
 * packing charge and grand total the create-order response returned, for instance.
 */
export const toEstimateOrder = (
  raw: any,
  overrides?: Partial<EstimateOrder>
): EstimateOrder | null => {
  if (!raw && !overrides) return null;
  const src = raw || {};

  const items: EstimateOrderItem[] = (Array.isArray(src.items) ? src.items : []).map((it: any) => {
    const quantity = Number(it?.quantity) || 1;
    const unitPrice = Number(it?.unitPrice ?? it?.price) || 0;
    return {
      productName: it?.productName ?? it?.productNameSnapshot ?? it?.name ?? undefined,
      sku: it?.sku || it?.code || undefined,
      quantity,
      unitPrice,
      // A genuine catalogue MRP only — the API snapshots `compareAtPrice` onto the
      // line when the product had one, and leaves it null otherwise.
      compareAtPrice: numberOrUndefined(it?.compareAtPrice, it?.mrp, it?.originalPrice),
      discount: numberOrUndefined(it?.discount),
      tax: numberOrUndefined(it?.tax),
      lineTotal: Number(it?.lineTotal) || unitPrice * quantity
    };
  });

  const mapped: EstimateOrder = {
    orderNumber: src.orderNumber ?? undefined,
    placedAtUtc: src.placedAtUtc ?? src.placedAt ?? src.createdAt ?? undefined,
    customerName: src.customerName || src.shippingAddress?.fullName || undefined,
    customerPhone: src.customerPhone || src.shippingAddress?.phone || undefined,
    shippingAddress: src.shippingAddress ?? undefined,
    deliveryAddressSummary: src.deliveryAddressSummary ?? undefined,
    // Collection details, present only once the order has been dispatched. The
    // full OrderDto and the anonymous tracking DTO both carry them; the checkout
    // snapshot predates dispatch, so there they are simply absent.
    carrierName: src.carrierName ?? src.carrier ?? undefined,
    trackingNumber: src.trackingNumber ?? src.lrNumber ?? undefined,
    carrierPhone: src.carrierPhone ?? undefined,
    carrierAddress: src.carrierAddress ?? undefined,
    items,
    itemsSubtotal: numberOrUndefined(src.itemsSubtotal, src.subtotal),
    discount: numberOrUndefined(src.discount),
    packingCharges: numberOrUndefined(src.packingCharges, src.packingCharge),
    packingChargePercent: numberOrUndefined(src.packingChargePercent),
    tax: numberOrUndefined(src.tax),
    grandTotal: numberOrUndefined(src.grandTotal, src.totalAmount, src.total)
  };

  if (!overrides) return mapped;

  // Only real values override — an absent override must never blank out a field
  // the payload did carry.
  const merged: EstimateOrder = { ...mapped };
  (Object.keys(overrides) as Array<keyof EstimateOrder>).forEach(key => {
    const value = overrides[key];
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value) && value.length === 0) return;
    (merged as any)[key] = value;
  });
  return merged;
};

/** True when there is enough on the order to print a document worth keeping. */
export const canPrintEstimate = (order: EstimateOrder | null | undefined): boolean =>
  Boolean(order && order.orderNumber && Array.isArray(order.items) && order.items.length > 0);
