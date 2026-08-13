'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePhotoFraming } from '@/hooks/usePhotoFraming';
import { PHOTO_CLASS, PHOTO_WINDOW, renderCard } from '@/lib/card/renderCard';
import { photoRect } from '@/lib/photo';
import { DEFAULT_TRANSFORM, type CardData, type PhotoTransform } from '@/lib/types';

/*
 * The framing gesture is measured against the renderer's own window rect, so a
 * drag that hits the pan clamp here is exactly the drag that hits it in the
 * exported PNG.
 */
const WINDOW = PHOTO_WINDOW;

type Props = {
  data: CardData;
  onTransform: (t: PhotoTransform) => void;
  /** Inline the woff2 so the preview is byte-identical to the download. */
  embedFonts: boolean;
  className?: string;
};

/**
 * The live pass.
 *
 * The document is injected as *inline* SVG rather than an `<img>` pointed at a
 * data URI. That distinction is the whole performance story: the card carries
 * the photo as base64, so the serialised document is ~500KB, and handing the
 * browser a fresh data URI on every pointer move means re-encoding, re-parsing
 * and re-rasterising all of it at pointer rate. Dragging was visibly behind
 * the finger.
 *
 * Inline, the framing gesture instead sets four attributes on the two `<image>`
 * layers and the browser repaints just those. The document is only rebuilt when
 * something that isn't the framing actually changes — a keystroke, a new ink, a
 * new photo. Export is untouched: it still serialises through renderCard, so
 * what you drag is exactly what you download.
 */
export default function CardPreview({ data, onTransform, embedFonts, className = '' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [touched, setTouched] = useState(false);

  const { photo, input, identity } = data;

  // Deliberately keyed on everything *except* the transform. The gesture
  // below re-frames the photo without going through here.
  const svg = useMemo(
    () => renderCard(data, { embedFonts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      input.handle,
      input.stack,
      input.colorway,
      input.titleOverride,
      photo?.dataUrl,
      photo?.width,
      photo?.height,
      embedFonts,
    ],
  );

  const framing = usePhotoFraming({
    imgW: photo?.width ?? 1,
    imgH: photo?.height ?? 1,
    boxW: WINDOW.w,
    boxH: WINDOW.h,
    onChange: onTransform,
    disabled: !photo,
    ariaLabel:
      'Your pass. Drag to reposition your photo, pinch or scroll to zoom. With the keyboard: arrow keys move it, plus and minus zoom, 0 recentres.',
  });

  const t = photo?.transform ?? DEFAULT_TRANSFORM;

  // Runs on every framing change — and, because the document is rebuilt with a
  // stale transform baked in, on every rebuild too. Layout effect so a freshly
  // injected card never paints one frame at the wrong offset.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !photo) return;
    const r = photoRect(photo.width, photo.height, WINDOW.w, WINDOW.h, t);
    const x = String(WINDOW.x + r.x);
    const y = String(WINDOW.y + r.y);
    const w = String(r.width);
    const h = String(r.height);
    for (const el of host.querySelectorAll(`.${PHOTO_CLASS}`)) {
      el.setAttribute('x', x);
      el.setAttribute('y', y);
      el.setAttribute('width', w);
      el.setAttribute('height', h);
    }
  }, [svg, photo, t]);

  const alt = `Hacker House Goa 2026 pass for ${input.handle || 'a builder'}: ${identity.title}${
    input.stack ? `, ${input.stack}` : ''
  }. Serial number ${identity.serial}.`;

  const moved = t.x !== 0 || t.y !== 0 || t.zoom !== 1;
  const showHint = !touched && !moved && !!photo;

  return (
    <div className={`relative ${className}`}>
      <div
        {...framing.frameProps}
        onPointerDownCapture={() => setTouched(true)}
        className={`h-full w-full touch-none select-none rounded-[10px] outline-offset-4 ${
          photo ? (framing.isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
      >
        {/* The SVG is the card, so it carries the accessible name itself. */}
        <div
          ref={hostRef}
          role="img"
          aria-label={alt}
          className="h-full w-full overflow-hidden rounded-[10px] drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* The affordance shows once, until the card is first touched. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-3 flex justify-center transition-opacity duration-500 ${
          showHint ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="rounded-full bg-black/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-hh-cream backdrop-blur-md">
          Drag to reposition your photo
        </span>
      </div>

      {moved && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={framing.reset}
            className="rounded-full bg-black/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-hh-cream backdrop-blur-md transition hover:bg-black/80"
          >
            Recentre photo
          </button>
        </div>
      )}
    </div>
  );
}
