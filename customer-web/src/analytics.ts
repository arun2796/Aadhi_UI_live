/**
 * Storefront analytics — Microsoft Clarity (behaviour) + Google Analytics 4 (traffic).
 *
 * The two answer different questions and neither replaces the other:
 *   GA4      how many people came, from where, what they bought   → WHAT happened
 *   Clarity  session replays, heatmaps, rage clicks, dead clicks  → WHY it happened
 *
 * WHY THIS IS NOT IN firebase.ts. It used to be: Firebase Analytics was initialised there, and
 * that file is only imported by the sign-in screens. Once those screens became lazy-loaded,
 * analytics stopped firing for everyone who never opened a login page — which is nearly every
 * visitor. Loading the tags here, from main.tsx, makes them independent of the auth flow and of
 * the whole Firebase SDK.
 *
 * WHY IT LOADS LATE. Both tags are injected after `load`, so they queue behind the page's own
 * work and cannot compete with Largest Contentful Paint. Analytics that costs you customers is
 * a bad trade.
 *
 * WHY IT IS ENV-DRIVEN. Ids come from VITE_CLARITY_PROJECT_ID / VITE_GA_MEASUREMENT_ID, which
 * are set in CI for production only. Local development therefore sends nothing, so your real
 * numbers are never polluted by your own testing.
 */

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const CLARITY_ID = (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined)?.trim() || '';
const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim() || '';

/** Runs `fn` once the page is done loading, or immediately if it already is. */
const whenIdle = (fn: () => void) => {
  const run = () => window.setTimeout(fn, 0);
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
};

const injectScript = (src: string) => {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
  return s;
};

let started = false;

/** Called once from main.tsx. Safe to call again — it will not double-load. */
export const initAnalytics = (): void => {
  if (started || typeof window === 'undefined') return;
  started = true;

  whenIdle(() => {
    // ── Microsoft Clarity ────────────────────────────────────────────────────
    // Free, unlimited sessions, no sampling. Records replays and heatmaps.
    if (CLARITY_ID) {
      window.clarity =
        window.clarity ||
        function (...args: unknown[]) {
          (window.clarity as unknown as { q: unknown[][] }).q =
            (window.clarity as unknown as { q?: unknown[][] }).q || [];
          (window.clarity as unknown as { q: unknown[][] }).q.push(args);
        };
      injectScript(`https://www.clarity.ms/tag/${encodeURIComponent(CLARITY_ID)}`);
    }

    // ── Google Analytics 4 ───────────────────────────────────────────────────
    // gtag.js directly rather than through Firebase Analytics: same property, but it
    // does not drag the Firebase SDK back into the initial download.
    if (GA_ID) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function (...args: unknown[]) {
        window.dataLayer!.push(args);
      };
      window.gtag('js', new Date());
      // send_page_view is off because this is a single-page app: the first view and every
      // route change are reported by trackPageView() below, so the two cannot double-count.
      window.gtag('config', GA_ID, { send_page_view: false });
      injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`);

      trackPageView();
    }
  });
};

/**
 * Reports one screen. A single-page app never reloads, so without this GA4 would record a
 * single page view per visit and every journey would look one step long.
 */
export const trackPageView = (title?: string): void => {
  if (!GA_ID || typeof window === 'undefined') return;
  window.gtag?.('event', 'page_view', {
    page_path: window.location.pathname + window.location.search,
    page_location: window.location.href,
    page_title: title || document.title
  });
};

/**
 * One commerce event (`add_to_cart`, `begin_checkout`, `purchase`, …). No-ops when GA4 is not
 * configured, so call sites never need to check.
 */
export const trackEvent = (name: string, params: Record<string, unknown> = {}): void => {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', name, params);
  // Clarity custom tags make replays filterable — "show me sessions that reached checkout".
  window.clarity?.('event', name);
};
