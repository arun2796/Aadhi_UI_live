/* ══════════════════════════════════════════════════════════════════════════════
   LIGHTBOX PORTAL — the loading boundary that keeps the photo viewer OFF the
   critical path.

   THE PROBLEM THIS SOLVES. Both product screens are imported eagerly by App.tsx,
   so anything they import lands in the main bundle — the one every visitor
   downloads before the product list can render. The viewer is worth having, but
   not at the cost of the catalogue appearing more slowly for the majority of
   people who never open a photo full screen.

   So the viewer is behind React.lazy: its code is fetched the first time someone
   actually taps an image, and never otherwise. The list pays nothing.

   WHY THE FALLBACK IS NOT `null`. On a slow connection the chunk takes a moment,
   and a tap that produces nothing at all reads as a broken button — people tap
   again, and again. The fallback paints the final backdrop immediately with a
   quiet spinner, so the response is instant even when the code is not.
   ════════════════════════════════════════════════════════════════════════════ */

import React, { Suspense, lazy } from 'react';

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
    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center"
    role="status"
    aria-label="Opening photo"
  >
    <span className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
  </div>
);

export const LightboxPortal: React.FC<Props> = props => (
  <Suspense fallback={<LightboxSkeleton />}>
    <ImageLightbox {...props} />
  </Suspense>
);
