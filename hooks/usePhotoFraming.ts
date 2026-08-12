'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { MAX_ZOOM, MIN_ZOOM, clampTransform, coverScale } from '@/lib/photo';
import { DEFAULT_TRANSFORM } from '@/lib/types';
import type { PhotoTransform } from '@/lib/types';

/**
 * Drag-to-reposition + pinch/wheel-to-zoom for the photo window.
 *
 * This is the escape hatch for the photos the auto-framing gets wrong, and the
 * plan is explicit that it must be one gesture rather than a modal cropper.
 *
 * Pointer Events only — one code path for mouse, touch and pen, with
 * `setPointerCapture` so a fast drag that leaves the element keeps tracking.
 * `touch-action: none` on the target stops the browser stealing the gesture to
 * scroll the page, which is the single most common way a mobile drag handler
 * feels broken.
 */

export type UsePhotoFramingArgs = {
  /** Processed photo dimensions (Photo.width / Photo.height). */
  imgW: number;
  imgH: number;
  /** The photo window, in the same units you draw it in. */
  boxW: number;
  boxH: number;
  /** Starting framing. Defaults to DEFAULT_TRANSFORM. */
  initial?: PhotoTransform;
  /** Fired on every change, already clamped. */
  onChange?: (t: PhotoTransform) => void;
  /** Turns off every gesture, e.g. while a photo is still loading. */
  disabled?: boolean;
  /** Arrow-key step, as a fraction of the window. Shift multiplies by 4. */
  nudge?: number;
  /** Multiplier per keyboard zoom press. */
  zoomStep?: number;
  ariaLabel?: string;
};

export type PhotoFramingProps = {
  ref: (el: HTMLElement | null) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onDragStart: (e: { preventDefault: () => void }) => void;
  tabIndex: number;
  role: string;
  'aria-label': string;
  'aria-roledescription': string;
  'data-dragging': string | undefined;
  style: CSSProperties;
};

export type PhotoFraming = {
  transform: PhotoTransform;
  /** Spread onto the element that shows the photo window. */
  frameProps: PhotoFramingProps;
  isDragging: boolean;
  /** Back to the starting framing. */
  reset: () => void;
  /** Programmatic set (clamped), e.g. from a face-detection result. */
  setTransform: (t: PhotoTransform | ((prev: PhotoTransform) => PhotoTransform)) => void;
  /** `scale(zoom)`-style helpers for buttons. */
  zoomBy: (factor: number) => void;
};

const DEFAULT_LABEL =
  'Photo framing. Drag to reposition, pinch or scroll to zoom. With the keyboard: arrow keys move the photo, plus and minus zoom, 0 resets.';

type Pt = { x: number; y: number };
type Geom = { imgW: number; imgH: number; boxW: number; boxH: number };
type Rect = { left: number; top: number; w: number; h: number };

/**
 * One gesture step: move the point at window fraction (px, py) by (dx, dy) —
 * also fractions of the window — while scaling to `zoom`.
 *
 * Doing pan and zoom in one expression is what makes a pinch feel attached to
 * the fingers instead of drifting toward the centre. With zoom unchanged it
 * degenerates to `x + dx`, i.e. a plain drag.
 *
 * Deliberately expressed in *fractions of the window*: pointer deltas are
 * divided by the element's rendered size, so this works whether the caller's
 * boxW/boxH are CSS pixels or SVG user units.
 */
function applyGesture(
  t0: PhotoTransform,
  g: Geom,
  px: number,
  py: number,
  dx: number,
  dy: number,
  zoom: number,
): PhotoTransform {
  const k = t0.zoom > 0 ? zoom / t0.zoom : 1;
  const s0 = coverScale(g.imgW, g.imgH, g.boxW, g.boxH) * t0.zoom;
  // Drawn size as a multiple of the window.
  const rx = g.boxW > 0 ? (g.imgW * s0) / g.boxW : 1;
  const ry = g.boxH > 0 ? (g.imgH * s0) / g.boxH : 1;
  return {
    x: px + dx - k * (px - (1 - rx) / 2 - t0.x) - (1 - rx * k) / 2,
    y: py + dy - k * (py - (1 - ry) / 2 - t0.y) - (1 - ry * k) / 2,
    zoom,
  };
}

export function usePhotoFraming({
  imgW,
  imgH,
  boxW,
  boxH,
  initial,
  onChange,
  disabled = false,
  nudge = 0.02,
  zoomStep = 1.12,
  ariaLabel = DEFAULT_LABEL,
}: UsePhotoFramingArgs): PhotoFraming {
  const start = useMemo<PhotoTransform>(() => initial ?? DEFAULT_TRANSFORM, [initial]);

  const [transform, setState] = useState<PhotoTransform>(() =>
    clampTransform(start, imgW, imgH, boxW, boxH),
  );
  const [isDragging, setDragging] = useState(false);

  // Geometry and the live transform live in refs too: the pointer handlers are
  // attached once and must never read a stale closure.
  const geom = useRef({ imgW, imgH, boxW, boxH });
  geom.current = { imgW, imgH, boxW, boxH };

  const tRef = useRef(transform);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const elRef = useRef<HTMLElement | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  /** Gesture anchor: transform, pointer geometry and element rect when it began. */
  const anchor = useRef<{ t: PhotoTransform; centre: Pt; dist: number; rect: Rect } | null>(null);

  const commit = useCallback((next: PhotoTransform) => {
    const g = geom.current;
    const clamped = clampTransform(next, g.imgW, g.imgH, g.boxW, g.boxH);
    const prev = tRef.current;
    if (clamped.x === prev.x && clamped.y === prev.y && clamped.zoom === prev.zoom) return;
    tRef.current = clamped;
    setState(clamped);
    onChangeRef.current?.(clamped);
  }, []);

  const setTransform = useCallback(
    (t: PhotoTransform | ((prev: PhotoTransform) => PhotoTransform)) => {
      commit(typeof t === 'function' ? t(tRef.current) : t);
    },
    [commit],
  );

  const reset = useCallback(() => {
    pointers.current.clear();
    anchor.current = null;
    setDragging(false);
    commit(start);
  }, [commit, start]);

  const zoomBy = useCallback(
    (factor: number) => {
      const prev = tRef.current;
      const zoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      // Button and keyboard zoom pivot on the middle of the window.
      commit(applyGesture(prev, geom.current, 0.5, 0.5, 0, 0, zoom));
    },
    [commit],
  );

  // Re-clamp whenever the photo or the window changes shape (e.g. a new upload,
  // or a responsive card resize). Without this a landscape→portrait swap can
  // leave a stale pan that shows a gap.
  useEffect(() => {
    commit(tRef.current);
  }, [commit, imgW, imgH, boxW, boxH]);

  // Reset when the caller hands us a different starting point (new photo).
  // Compared by value, not identity: callers pass `{x:0,y:0,zoom:1}` inline all
  // the time, and an identity check would loop forever.
  useEffect(() => {
    const g = geom.current;
    const next = clampTransform(start, g.imgW, g.imgH, g.boxW, g.boxH);
    const prev = tRef.current;
    if (next.x === prev.x && next.y === prev.y && next.zoom === prev.zoom) return;
    tRef.current = next;
    setState(next);
    // Deliberately not calling onChange: the caller already owns `start`.
  }, [start.x, start.y, start.zoom]);

  // ---- gesture bookkeeping -------------------------------------------------

  const centreOf = (pts: Pt[]): Pt => {
    let x = 0;
    let y = 0;
    for (const p of pts) {
      x += p.x;
      y += p.y;
    }
    return { x: x / pts.length, y: y / pts.length };
  };

  const distOf = (pts: Pt[]): number => {
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  /**
   * The element's rendered size in CSS pixels — the denominator that turns a
   * pointer delta into a fraction of the window. Falls back to the caller's box
   * only if the element isn't measurable yet.
   */
  const measure = useCallback((): Rect => {
    const r = elRef.current?.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0) return { left: r.left, top: r.top, w: r.width, h: r.height };
    const g = geom.current;
    return { left: 0, top: 0, w: g.boxW > 0 ? g.boxW : 1, h: g.boxH > 0 ? g.boxH : 1 };
  }, []);

  const rebase = useCallback(() => {
    const pts = [...pointers.current.values()];
    if (pts.length === 0) {
      anchor.current = null;
      return;
    }
    anchor.current = { t: tRef.current, centre: centreOf(pts), dist: distOf(pts), rect: measure() };
  }, [measure]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (disabledRef.current) return;
      // Ignore secondary mouse buttons; right-click should still open a menu.
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const el = e.currentTarget;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Capture is best-effort; the window-level cleanup below covers us.
      }
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      rebase();
      setDragging(true);
      // Focus so the keyboard controls are immediately live after a tap.
      if (typeof el.focus === 'function') el.focus({ preventScroll: true });
      e.preventDefault();
    },
    [rebase],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (disabledRef.current) return;
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const a = anchor.current;
      if (!a) return;
      const pts = [...pointers.current.values()];
      const g = geom.current;
      if (g.boxW <= 0 || g.boxH <= 0) return;

      const centre = centreOf(pts);
      let zoom = a.t.zoom;
      if (pts.length >= 2 && a.dist > 0) {
        zoom = clamp((a.t.zoom * distOf(pts)) / a.dist, MIN_ZOOM, MAX_ZOOM);
      }
      commit(
        applyGesture(
          a.t,
          g,
          (a.centre.x - a.rect.left) / a.rect.w,
          (a.centre.y - a.rect.top) / a.rect.h,
          (centre.x - a.centre.x) / a.rect.w,
          (centre.y - a.centre.y) / a.rect.h,
          zoom,
        ),
      );
      e.preventDefault();
    },
    [commit],
  );

  const release = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!pointers.current.delete(e.pointerId)) return;
      try {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Already released, or the element is gone. Nothing to do.
      }
      if (pointers.current.size === 0) {
        anchor.current = null;
        setDragging(false);
      } else {
        // Lifting one finger of a pinch must not make the photo jump.
        rebase();
      }
    },
    [rebase],
  );

  // ---- wheel ---------------------------------------------------------------
  // React routes wheel through a passive root listener, so `preventDefault()`
  // inside onWheel is ignored and the page scrolls underneath the gesture.
  // Attach it directly, non-passive, and tear it down on unmount.
  const [node, setNode] = useState<HTMLElement | null>(null);
  const setRef = useCallback((el: HTMLElement | null) => {
    elRef.current = el;
    setNode(el);
  }, []);

  useEffect(() => {
    const el = node;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (disabledRef.current) return;
      const g = geom.current;
      if (g.boxW <= 0 || g.boxH <= 0) return;
      e.preventDefault();
      const prev = tRef.current;
      // ctrlKey means a trackpad pinch (the browser synthesises it); deltaMode
      // 1 is lines, 2 is pages — normalise all of them to something sane.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const delta = e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0025);
      const zoom = clamp(prev.zoom * Math.exp(-delta), MIN_ZOOM, MAX_ZOOM);
      // Zoom about the cursor, so the bit of the photo under the pointer stays
      // under the pointer.
      const rect = measure();
      commit(
        applyGesture(
          prev,
          g,
          (e.clientX - rect.left) / rect.w,
          (e.clientY - rect.top) / rect.h,
          0,
          0,
          zoom,
        ),
      );
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // Everything the handler reads comes from a ref, so this binds exactly
    // once per element rather than on every transform change.
  }, [commit, measure, node]);

  // Safety net: if the element unmounts mid-drag, or the pointer is cancelled
  // by the OS (a call comes in, the tab is hidden), drop the gesture state so
  // nothing is left half-held.
  useEffect(() => {
    const drop = () => {
      if (pointers.current.size === 0) return;
      pointers.current.clear();
      anchor.current = null;
      setDragging(false);
    };
    window.addEventListener('pointercancel', drop);
    window.addEventListener('blur', drop);
    document.addEventListener('visibilitychange', drop);
    return () => {
      window.removeEventListener('pointercancel', drop);
      window.removeEventListener('blur', drop);
      document.removeEventListener('visibilitychange', drop);
      drop();
    };
  }, []);

  // ---- keyboard ------------------------------------------------------------

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (disabledRef.current) return;
      const step = nudge * (e.shiftKey ? 4 : 1);
      const prev = tRef.current;
      switch (e.key) {
        case 'ArrowLeft':
          commit({ ...prev, x: prev.x - step });
          break;
        case 'ArrowRight':
          commit({ ...prev, x: prev.x + step });
          break;
        case 'ArrowUp':
          commit({ ...prev, y: prev.y - step });
          break;
        case 'ArrowDown':
          commit({ ...prev, y: prev.y + step });
          break;
        case '+':
        case '=':
          zoomBy(zoomStep);
          break;
        case '-':
        case '_':
          zoomBy(1 / zoomStep);
          break;
        case '0':
          reset();
          break;
        default:
          return;
      }
      e.preventDefault();
    },
    [commit, nudge, reset, zoomBy, zoomStep],
  );

  const frameProps = useMemo<PhotoFramingProps>(
    () => ({
      ref: setRef,
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onKeyDown,
      // Native image/element dragging would hijack a mouse drag.
      onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
      tabIndex: disabled ? -1 : 0,
      role: 'group',
      'aria-label': ariaLabel,
      'aria-roledescription': 'photo framing area',
      'data-dragging': isDragging ? 'true' : undefined,
      style: {
        // Without this the browser scrolls the page instead of letting us pan.
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
      } as CSSProperties,
    }),
    [ariaLabel, disabled, isDragging, onKeyDown, onPointerDown, onPointerMove, release, setRef],
  );

  return { transform, frameProps, isDragging, reset, setTransform, zoomBy };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}
