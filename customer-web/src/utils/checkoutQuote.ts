/* ══════════════════════════════════════════════════════════════════════════════
   THE PAYABLE AMOUNT — single source of truth for the storefront
   ══════════════════════════════════════════════════════════════════════════════

   The client does NOT compute what the customer owes. POST /cart/calculate runs
   the identical arithmetic the order will run (server-side OrderPricingService),
   so its `grandTotal` is the amount the created order will carry and the amount
   that must appear on every surface that states a price: the summary rows, the
   "Total Payable Online" figure, the PLACE ORDER button and — most importantly —
   the `am=` parameter of the UPI QR the customer actually pays into.

   The rule this module exists to enforce: a number is shown to the customer only
   when it came back from the server complete and self-consistent. Anything else
   (a network failure, a slow response, an API build that answers with a partial
   breakdown) is reported as "total unavailable" and the pay action is disabled.
   There is deliberately no client-side fallback sum: the previous fallback —
   subtotal − discount + packing — understated every order by the 18% GST the
   server charges, and customers paid that understated figure by UPI.
   ════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';

/** A quote that has been verified complete and self-consistent. */
export interface CheckoutQuote {
  /** Units quoted (sum of quantities, after the server clamps them to stock). */
  totalItems: number;
  /** Sum of the lines before tax. */
  itemsSubtotal: number;
  discount: number;
  /** GST, at each product's own tax rate. */
  tax: number;
  packingCharges: number;
  /** Rate `packingCharges` was billed at, e.g. 1.5 for 1.5% (0 when the API omits it). */
  packingChargePercent: number;
  /** Always 0 — freight is To-Pay, settled with the transport company on collection. */
  shippingCharge: number;
  /** itemsSubtotal − discount + tax + shippingCharge + packingCharges. THE payable amount. */
  grandTotal: number;
  couponCode: string | null;
}

export type CheckoutQuoteStatus = 'empty' | 'loading' | 'ready' | 'unavailable';

/** Why no quote is on screen — drives the wording shown to the customer. */
export type CheckoutQuoteProblem = 'network' | 'incomplete';

/** Largest rupee gap tolerated between the quote's own parts and its grand total. */
export const QUOTE_FOOTING_TOLERANCE = 1;

const finiteOrNull = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Accepts a /cart/calculate response ONLY if it carries the full breakdown and
 * its parts add up to its own grand total; returns null otherwise.
 *
 * This is what stops an older API build (which answers `{subtotal, discount,
 * shippingCharge, grandTotal}` with no `tax` and no `packingCharges`) from being
 * charged against: its `grandTotal` omits GST and packing, so it is not a total
 * the storefront can stand behind even though it parses cleanly.
 */
export const isAuthoritativeQuote = (raw: unknown): CheckoutQuote | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const totalItems = finiteOrNull(r.totalItems);
  const itemsSubtotal = finiteOrNull(r.itemsSubtotal);
  const discount = finiteOrNull(r.discount);
  const tax = finiteOrNull(r.tax);
  const packingCharges = finiteOrNull(r.packingCharges);
  const packingChargePercent = finiteOrNull(r.packingChargePercent);
  const shippingCharge = finiteOrNull(r.shippingCharge);
  const grandTotal = finiteOrNull(r.grandTotal);

  if (
    totalItems === null ||
    itemsSubtotal === null ||
    discount === null ||
    tax === null ||
    packingCharges === null ||
    packingChargePercent === null ||
    shippingCharge === null ||
    grandTotal === null
  ) {
    return null;
  }

  if (itemsSubtotal < 0 || grandTotal < 0) return null;

  const footed = itemsSubtotal - discount + tax + shippingCharge + packingCharges;
  if (Math.abs(footed - grandTotal) > QUOTE_FOOTING_TOLERANCE) return null;

  return {
    totalItems,
    itemsSubtotal,
    discount,
    tax,
    packingCharges,
    packingChargePercent,
    shippingCharge,
    grandTotal,
    couponCode: typeof r.couponCode === 'string' && r.couponCode.trim() ? r.couponCode : null
  };
};

/** ₹161.33-style money with paise always shown — checkout figures are exact, never rounded. */
export const inrExact = (n: number): string =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The `am=` value for a UPI intent URI: plain decimal rupees, exactly two places. */
export const upiAmount = (n: number): string => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

/** Copy shown wherever a total would have been. */
export const QUOTE_PROBLEM_MESSAGE: Record<CheckoutQuoteProblem, string> = {
  network:
    'We could not reach the server to confirm your total. Nothing can be paid until the amount is confirmed — please retry.',
  incomplete:
    'The server did not return a complete price breakdown (GST / packing charges are missing), so the payable amount cannot be confirmed. Please retry.'
};

export interface CheckoutQuoteLineInput {
  productId: string;
  quantity: number;
}

export interface UseCheckoutQuoteArgs {
  items: CheckoutQuoteLineInput[];
  couponCode?: string;
  /** Re-quotes when this changes (the selected delivery address). */
  addressKey?: string;
}

export interface UseCheckoutQuoteResult {
  /** Non-null ONLY when it matches the current cart / coupon / address. */
  quote: CheckoutQuote | null;
  status: CheckoutQuoteStatus;
  problem: CheckoutQuoteProblem | null;
  /** True when an amount may be shown and the pay action may be enabled. */
  canPay: boolean;
  retry: () => void;
}

/** Identity of what is being quoted; a quote is only valid for its own signature. */
const signatureOf = (items: CheckoutQuoteLineInput[], couponCode?: string, addressKey?: string): string =>
  [
    items
      .map(i => `${i.productId}x${i.quantity}`)
      .sort()
      .join('|'),
    (couponCode || '').trim().toUpperCase(),
    (addressKey || '').trim()
  ].join('#');

const REQUOTE_DEBOUNCE_MS = 200;

/**
 * Keeps a verified quote in step with the cart, the coupon and the delivery address.
 * A quote is exposed only while its signature matches the current one, so a total
 * on screen always belongs to the cart on screen — never to the cart it used to be.
 */
export const useCheckoutQuote = ({
  items,
  couponCode,
  addressKey
}: UseCheckoutQuoteArgs): UseCheckoutQuoteResult => {
  const signature = useMemo(
    () => signatureOf(items, couponCode, addressKey),
    // items is re-derived on every cart change; the signature is what we track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, couponCode, addressKey]
  );

  const [state, setState] = useState<{
    signature: string;
    quote: CheckoutQuote | null;
    status: CheckoutQuoteStatus;
    problem: CheckoutQuoteProblem | null;
  }>({ signature: '', quote: null, status: 'loading', problem: null });

  const [attempt, setAttempt] = useState(0);
  const latestRequest = useRef(0);

  const retry = useCallback(() => setAttempt(a => a + 1), []);

  // Payload rebuilt from the signature's own inputs so a re-render with an
  // identical cart does not fire another request.
  const payload = useMemo(
    () => items.map(i => ({ productId: i.productId, quantity: i.quantity })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature]
  );

  useEffect(() => {
    if (payload.length === 0) {
      setState({ signature, quote: null, status: 'empty', problem: null });
      return;
    }

    // Clear any previous figure immediately: it belonged to a different cart.
    setState({ signature, quote: null, status: 'loading', problem: null });

    const requestId = ++latestRequest.current;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      api
        .calculateCart(payload, couponCode || undefined)
        .then(raw => {
          if (cancelled || requestId !== latestRequest.current) return;
          const verified = isAuthoritativeQuote(raw);
          setState(
            verified
              ? { signature, quote: verified, status: 'ready', problem: null }
              : { signature, quote: null, status: 'unavailable', problem: 'incomplete' }
          );
        })
        .catch(() => {
          if (cancelled || requestId !== latestRequest.current) return;
          setState({ signature, quote: null, status: 'unavailable', problem: 'network' });
        });
    }, REQUOTE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, attempt]);

  const current = state.signature === signature ? state : null;
  const quote = current?.quote ?? null;
  const status: CheckoutQuoteStatus = current?.status ?? 'loading';

  return {
    quote,
    status,
    problem: current?.problem ?? null,
    canPay: status === 'ready' && quote !== null,
    retry
  };
};
