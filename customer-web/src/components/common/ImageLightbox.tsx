/* ══════════════════════════════════════════════════════════════════════════════
   IMAGE LIGHTBOX — tap a product photo to open it full screen and zoom in.

   WHY NOT 3D. A 3D view needs a real 3D model (.glb) per product, which means
   photographing each item on a turntable from dozens of angles or having it
   modelled. A photograph cannot be turned into one. With a catalogue this size
   that is weeks of work before a single customer benefits, and what people are
   actually asking for when they tap a product photo is to see it CLOSELY — the
   label, the size, the print quality. That is zoom, and zoom is what this does.

   WHY NO LIBRARY. Every lightbox package worth using is 30-90 kB for behaviour
   that is a few pointer handlers and a CSS transform. This storefront's whole
   main bundle is ~93 kB gzipped and the work to keep it there was deliberate.

   GESTURES
     • tap a photo          → opens here
     • pinch                → zoom 1× to 4×
     • double-tap           → toggle 1× ↔ 2.5× centred on the tap
     • drag (zoomed)        → pan
     • drag (not zoomed)    → previous / next photo
     • swipe down           → close
     • Escape / ✕           → close
   ════════════════════════════════════════════════════════════════════════════ */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
/** Horizontal travel, in px, that counts as a swipe rather than a stray finger. */
const SWIPE_THRESHOLD = 60;

interface Props {
  images: string[];
  /** Which photo to open on. */
  startIndex?: number;
  /** Used for alt text and the counter's screen-reader label. */
  title?: string;
  onClose: () => void;
}

interface Point {
  x: number;
  y: number;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const ImageLightbox: React.FC<Props> = ({ images, startIndex = 0, title, onClose }) => {
  const [index, setIndex] = useState(() => clamp(startIndex, 0, Math.max(0, images.length - 1)));
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  /** Suppresses the CSS transition mid-gesture so the image tracks the finger exactly. */
  const [dragging, setDragging] = useState(false);
  /** Drives the entry animation and the per-photo fade-in. */
  const [loaded, setLoaded] = useState(false);
  const [entered, setEntered] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, Point>>(new Map());
  const gestureStart = useRef<{ dist: number; scale: number; centre: Point; offset: Point } | null>(
    null
  );
  const panStart = useRef<{ point: Point; offset: Point } | null>(null);
  const lastTap = useRef(0);
  const zoomed = scale > MIN_SCALE + 0.01;

  const reset = useCallback(() => {
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
  }, []);

  // A new photo starts un-decoded. In practice the carousel has already cached
  // every image, so this resolves in the same frame and no spinner is seen — it
  // only shows on a cold open over a slow connection.
  useEffect(() => {
    setLoaded(false);
  }, [index]);

  const go = useCallback(
    (delta: number) => {
      if (images.length < 2) return;
      setIndex(i => (i + delta + images.length) % images.length);
      reset();
    },
    [images.length, reset]
  );

  // One frame after mount, so the browser has a start state to animate FROM.
  // Without the rAF the element is created already in its final state and the
  // transition never runs.
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* ── Keyboard + body scroll lock ────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);

    // The page behind must not scroll while this is open, and it must come back
    // to exactly where it was — not to the top.
    const { overflow, position, top, width } = document.body.style;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      window.scrollTo(0, scrollY);
    };
  }, [onClose, go]);

  /* ── Keeping a zoomed image inside its frame ─────────────────────────────── */
  const clampOffset = useCallback((next: Point, atScale: number): Point => {
    const el = stageRef.current;
    if (!el) return next;
    // At scale s the image overflows by (s-1)/2 of the frame on each side; panning
    // further than that would drag empty space into view.
    const maxX = ((atScale - 1) * el.clientWidth) / 2;
    const maxY = ((atScale - 1) * el.clientHeight) / 2;
    return { x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, []);

  /* ── Pointer handling (mouse, touch and pen through one path) ────────────── */
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gestureStart.current = {
        dist: distance(a, b),
        scale,
        centre: midpoint(a, b),
        offset
      };
      panStart.current = null;
      return;
    }

    if (pointers.current.size === 1) {
      setDragging(true);
      panStart.current = { point: { x: e.clientX, y: e.clientY }, offset };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two fingers → pinch.
    if (pointers.current.size === 2 && gestureStart.current) {
      const [a, b] = [...pointers.current.values()];
      const start = gestureStart.current;
      const next = clamp((distance(a, b) / start.dist) * start.scale, MIN_SCALE, MAX_SCALE);
      setScale(next);
      setOffset(clampOffset(start.offset, next));
      return;
    }

    // One finger while zoomed → pan. While not zoomed the drag is a swipe and is
    // resolved on release, so nothing moves here.
    if (pointers.current.size === 1 && panStart.current && zoomed) {
      const s = panStart.current;
      setOffset(
        clampOffset({ x: s.offset.x + (e.clientX - s.point.x), y: s.offset.y + (e.clientY - s.point.y) }, scale)
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = panStart.current;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);

    if (pointers.current.size < 2) gestureStart.current = null;
    if (pointers.current.size === 0) setDragging(false);

    if (!wasSingle || !start) return;
    panStart.current = null;

    const dx = e.clientX - start.point.x;
    const dy = e.clientY - start.point.y;
    const travelled = Math.hypot(dx, dy);

    // Swipes only count when the image is not zoomed — otherwise a pan would
    // change photo, or close the viewer, underneath the customer.
    if (!zoomed && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
      return;
    }

    // Swipe down to dismiss. This is the gesture every phone gallery uses, and it
    // is the only way to close without reaching for the ✕ in the far corner —
    // which on a large phone is a two-handed operation.
    if (!zoomed && dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
      onClose();
      return;
    }

    // A tap: nothing moved.
    if (travelled < 10) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        if (zoomed) {
          reset();
        } else {
          // Zoom toward the point tapped, so the detail under the finger is what
          // fills the screen.
          const el = stageRef.current;
          if (el) {
            const r = el.getBoundingClientRect();
            const dxC = e.clientX - (r.left + r.width / 2);
            const dyC = e.clientY - (r.top + r.height / 2);
            const next = DOUBLE_TAP_SCALE;
            setScale(next);
            setOffset(clampOffset({ x: -dxC * (next - 1), y: -dyC * (next - 1) }, next));
          } else {
            setScale(DOUBLE_TAP_SCALE);
          }
        }
      } else {
        lastTap.current = now;
      }
    }
  };

  /* ── Desktop wheel zoom ──────────────────────────────────────────────────── */
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 4) return;
    const next = clamp(scale - e.deltaY * 0.003, MIN_SCALE, MAX_SCALE);
    setScale(next);
    setOffset(o => clampOffset(o, next));
  };

  if (images.length === 0) return null;
  const src = images[index];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col transition-opacity duration-200"
      style={{ opacity: entered ? 1 : 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} — photo viewer` : 'Photo viewer'}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 text-white/90 shrink-0">
        <div className="min-w-0 flex-1">
          {title && (
            <div className="text-[13px] font-black text-white truncate leading-tight">{title}</div>
          )}
          {images.length > 1 && (
            <div className="text-[11px] font-semibold text-white/50 tabular-nums">
              Photo {index + 1} of {images.length}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Reads out the zoom level while zoomed, and how to zoom while not —
              the control tells you what it is for at the moment you need it. */}
          {zoomed ? (
            <span className="text-[11px] font-black text-white/70 tabular-nums px-2 py-1 rounded-full bg-white/10">
              {scale.toFixed(1)}×
            </span>
          ) : (
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-white/50">
              <ZoomIn className="w-3.5 h-3.5" />
              Double-click or scroll to zoom
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo viewer"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="flex-1 relative overflow-hidden touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {/* Only on a cold open — the carousel has normally cached the photo already. */}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          </div>
        )}

        <img
          key={src}
          src={src}
          alt={title ? `${title} — photo ${index + 1}` : `Photo ${index + 1}`}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            // The open settles the photo in from slightly small, which reads as the
            // image coming forward rather than a panel appearing over the page.
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${
              scale * (entered ? 1 : 0.92)
            })`,
            opacity: loaded ? 1 : 0,
            transition: dragging
              ? 'opacity 160ms linear'
              : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms linear',
            cursor: zoomed ? 'grab' : 'zoom-in'
          }}
        />

        {/* Arrows: pointer devices only, and never while zoomed (they would sit on
            top of the part of the image being examined). */}
        {images.length > 1 && !zoomed && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Foot: gesture hint on touch, thumbnails when there is more than one photo */}
      <div className="shrink-0">
        {/* Touch only. The arrows and the scroll hint above cover pointer devices,
            and a phone has no room to say everything at once. */}
        {!zoomed && (
          <p className="sm:hidden text-center text-[11px] font-semibold text-white/40 pb-1">
            Pinch or double-tap to zoom · swipe down to close
          </p>
        )}

        {images.length > 1 && (
          <div className="px-3 pt-1 pb-3 flex gap-2 overflow-x-auto justify-center [&::-webkit-scrollbar]:hidden">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setIndex(i);
                  reset();
                }}
                aria-label={`Photo ${i + 1}`}
                aria-current={i === index}
                className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all duration-200 ${
                  i === index
                    ? 'border-orange opacity-100 scale-100'
                    : 'border-white/15 opacity-40 scale-95 hover:opacity-80'
                }`}
              >
                {/* contain, not cover: a thumbnail that crops the product is a worse
                    guide to which photo you are picking than one that shows all of it. */}
                <img
                  src={img}
                  alt=""
                  className="w-full h-full object-contain bg-white/5"
                  draggable={false}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
