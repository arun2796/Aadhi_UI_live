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

  watchScreenTime();

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
  if (typeof window === 'undefined') return;

  const path = window.location.pathname + window.location.search;

  // Close the previous screen's timer before the new one starts, so each screen is credited
  // with its own seconds and never the next screen's.
  flushScreenTime();
  startScreenTimer(path);

  if (!GA_ID) return;

  // gtag('set') BEFORE the event, and this is the part that is easy to miss: GA4 also emits
  // its own automatic events (user_engagement, scroll) and those carry whatever page was last
  // *set*, not whatever page_view last reported. Without this line every screen's engagement
  // time is attributed to the page the visitor landed on, and 'average time per screen' in GA4
  // is quietly meaningless — the landing page appears to hold people for the whole visit.
  window.gtag?.('set', {
    page_path: path,
    page_location: window.location.href,
    page_title: title || document.title
  });

  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: title || document.title
  });
};

/* ─────────────────────────────────────────────────────────────────────────────
   Time spent per screen.

   GA4 reports this on its own, but only as a property-wide average days later.
   This measures it per session as well, so a single replay in Clarity can be
   filtered by 'spent over a minute here' — which is how you find the screens
   that confuse people rather than the ones that merely get traffic.

   It counts VISIBLE time only. A tab left open in the background for an hour is
   not a customer studying your product page, and counting it as engagement is
   the most common way this metric lies.
   ───────────────────────────────────────────────────────────────────────────── */

let screenPath = '';
let screenStart = 0;
let screenMs = 0;

const startScreenTimer = (path: string) => {
  screenPath = path;
  screenStart = document.visibilityState === 'visible' ? Date.now() : 0;
  screenMs = 0;
};

/** Reports the screen just left, if it was open long enough to mean anything. */
const flushScreenTime = () => {
  if (!screenPath) return;

  if (screenStart) screenMs += Date.now() - screenStart;
  screenStart = 0;

  const seconds = Math.round(screenMs / 1000);
  // Under two seconds is a pass-through, not a visit. Recording those would bury the
  // screens people actually dwell on under a pile of noise.
  if (seconds >= 2) {
    window.gtag?.('event', 'screen_time', {
      page_path: screenPath,
      engagement_seconds: seconds
    });
    // Clarity takes only strings for filtering, so bucket it: 'show me sessions that spent
    // 1-3 minutes on checkout' is a question you can actually ask of a filter list.
    const bucket =
      seconds >= 180 ? '180s+' :
      seconds >= 60 ? '60-179s' :
      seconds >= 30 ? '30-59s' :
      seconds >= 10 ? '10-29s' : 'under-10s';
    window.clarity?.('set', 'screen_time', `${screenPath} ${bucket}`);
  }

  screenPath = '';
  screenMs = 0;
};

/**
 * Starts the visibility bookkeeping. Called once from initAnalytics.
 *
 * `pagehide` rather than `unload`: mobile Safari and Chrome freeze backgrounded tabs into the
 * back/forward cache and may never fire `unload` at all, so the last screen of most mobile
 * visits — very often the checkout — would go unreported.
 */
const watchScreenTime = () => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (screenStart) {
        screenMs += Date.now() - screenStart;
        screenStart = 0;
      }
    } else if (screenPath && !screenStart) {
      screenStart = Date.now();
    }
  });

  window.addEventListener('pagehide', flushScreenTime);
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

/**
 * Links the current session to a signed-in customer.
 *
 * WHAT IS SENT: the customer's internal id (a GUID) and nothing else. Deliberately NOT their
 * name, email, phone or address — Microsoft Clarity's terms prohibit sending personally
 * identifiable information, and doing so would also export customer personal data to a third
 * party without consent, which is precisely what the checkout masking exists to prevent.
 *
 * HOW YOU USE IT: a recording shows the id; paste it into the ERP customer search to see who it
 * was. Clarity holds a meaningless key, your own database holds the identity.
 */
export const identifyCustomer = (customerId?: string | null): void => {
  if (typeof window === 'undefined') return;

  if (!customerId) {
    // Signed out. Tag the session so 'guest vs registered' is filterable, but never try to
    // un-identify: Clarity has no such call, and a page load starts a fresh session anyway.
    window.clarity?.('set', 'customer_type', 'guest');
    return;
  }

  window.clarity?.('identify', customerId);
  window.clarity?.('set', 'customer_type', 'registered');
  // GA4's user_id joins sessions across devices for the same person.
  window.gtag?.('set', { user_id: customerId });
};

/** Tags the session with the cart value, so you can filter for abandoned high-value carts. */
export const tagCartValue = (totalRupees: number): void => {
  if (typeof window === 'undefined' || !Number.isFinite(totalRupees)) return;
  // Bucketed, not exact: a filter list of every distinct rupee total would be unusable, and
  // ranges are what you actually ask questions about.
  const bucket =
    totalRupees >= 10000 ? '10000+' :
    totalRupees >= 5000 ? '5000-9999' :
    totalRupees >= 2000 ? '2000-4999' :
    totalRupees >= 500 ? '500-1999' : 'under-500';
  window.clarity?.('set', 'cart_value', bucket);
};

/**
 * Records which layout the visitor was actually served, and how big their screen is.
 *
 * WHY THIS IS NOT REDUNDANT WITH CLARITY'S OWN 'Device' FILTER. Clarity guesses PC / Mobile /
 * Tablet from the user agent. This storefront decides from viewport width (<768px, App.tsx),
 * and the two disagree exactly where it matters: a tablet held in portrait, or a phone in
 * desktop-site mode, gets a layout its user-agent label does not predict. When someone reports
 * 'the checkout looked broken', this tag says which of the two code paths they actually saw.
 */
export const tagDevice = (isMobileLayout: boolean): void => {
  if (typeof window === 'undefined') return;

  window.clarity?.('set', 'layout', isMobileLayout ? 'mobile' : 'desktop');

  const w = window.innerWidth;
  // Named the way you would describe the device out loud, not by raw pixels, because the
  // question being answered is 'do phones struggle here?' — not 'what is 414px'.
  const size =
    w < 480 ? 'phone-small' :
    w < 768 ? 'phone' :
    w < 1024 ? 'tablet' :
    w < 1440 ? 'laptop' : 'desktop-large';
  window.clarity?.('set', 'screen_size', size);

  // Also on GA4, so 'conversion rate by device' is answerable with the app's own definition
  // of mobile rather than Google's.
  window.gtag?.('set', { layout: isMobileLayout ? 'mobile' : 'desktop', screen_size: size });
};

/**
 * Tags the session with the delivery STATE chosen at checkout.
 *
 * WHY A STATE AND NOT AN ADDRESS. A state is the same coarse geography Google and Clarity
 * already record by IP, and it is a shipping category rather than a description of a person.
 * The street, pincode, name and phone stay masked and are never sent — that line is the whole
 * reason the checkout carries data-clarity-mask.
 *
 * WHY IT IS WORTH HAVING SEPARATELY FROM GA4's Region. GA4 infers region from the visitor's IP,
 * which is where they are BROWSING. This is where they are asking you to SHIP. For fireworks
 * those are routinely different — someone in Bengaluru ordering for family in Madurai — and it
 * is the shipping destination that decides whether you can fulfil the order at all.
 */
export const tagDeliveryState = (state?: string | null): void => {
  if (typeof window === 'undefined') return;
  const clean = (state || '').trim();
  if (!clean) return;

  window.clarity?.('set', 'delivery_state', clean);
  window.clarity?.('set', 'delivery_region', /^tamil\s*nadu$/i.test(clean) ? 'Tamil Nadu' : 'Other state');
  window.gtag?.('set', { delivery_state: clean });
};
