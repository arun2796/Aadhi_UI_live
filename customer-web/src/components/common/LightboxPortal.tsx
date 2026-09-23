/* ══════════════════════════════════════════════════════════════════════════════
   LIGHTBOX PORTAL — renders the photo viewer at <body>, and keeps its code off
   the critical path.

   ── WHY A PORTAL IS REQUIRED, NOT A TIDINESS CHOICE ───────────────────────────
   `position: fixed` is normally measured against the viewport, but NOT when an
   ancestor has a transform, filter, perspective, backdrop-filter or will-change.
   Any of those makes that ancestor the containing block, and `inset-0` then means
   "fill my transformed parent" instead of "fill the screen".

   Both product screens are wrapped in `animate-fade-in`, whose keyframes end at
   `transform: translateY(0)` with `animation-fill-mode: both` — so the transform
   never goes away after the animation finishes. The viewer was therefore pinned
   inside the page content: the sticky header stayed visible above it, the bottom
   navigation sat on top of it, and the photo was clipped at the fold. No z-index
   could fix that, because the problem was the geometry, not the stacking order.

   Rendering into document.body escapes every such ancestor, so `inset-0` means
   the viewport again.

   ── WHY IT IS ALSO LAZY ───────────────────────────────────────────────────────
   Both product screens are imported eagerly by App.tsx, so whatever they import
   lands in the main bundle — the one every visitor downloads before the product
   list can render. Behind React.lazy the viewer is fetched on the first tap and
   never otherwise, so the catalogue pays nothing for it.

   The fallback is not `null`: on a slow connection a tap that paints nothing
   reads as a broken button and people tap again. It paints the final backdrop at
   once, with a quiet spinner.
   ════════════════════════════════════════════════════════════════════════════ */

import React, { Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';

const ImageLightbox = lazy(() =>
  import('./ImageLightbox').then(m => ({ default: m.ImageLightbox }))
);

interface Props {
  images: string[];
  startIndex?: number;
  title?: string;
  onClose: () => void;
}

/** The same backdrop the viewer itself uses, so the hand-off is not a flash. */
const LightboxSkeleton: React.FC = () => (
  <div
    className="fixed inset-0 z-100 bg-black/95 backdrop-blur-sm flex items-center justify-center"
    role="status"
    aria-label="Opening photo"
  >
    <span className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
  </div>
);

export const LightboxPortal: React.FC<Props> = props => {
  // The SEO prerender runs this in Node, where there is no document to portal into.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <Suspense fallback={<LightboxSkeleton />}>
      <ImageLightbox {...props} />
    </Suspense>,
    document.body
  );
};
