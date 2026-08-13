'use client';

import { useMemo, useState } from 'react';
import { usePhotoFraming } from '@/hooks/usePhotoFraming';
import { PHOTO_WINDOW, cardDataUri } from '@/lib/card/renderCard';
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

export default function CardPreview({ data, onTransform, embedFonts, className = '' }: Props) {
  const src = useMemo(() => cardDataUri(data, { embedFonts }), [data, embedFonts]);
  const [touched, setTouched] = useState(false);

  const framing = usePhotoFraming({
    imgW: data.photo?.width ?? 1,
    imgH: data.photo?.height ?? 1,
    boxW: WINDOW.w,
    boxH: WINDOW.h,
    onChange: onTransform,
    disabled: !data.photo,
    ariaLabel:
      'Your pass. Drag to reposition your photo, pinch or scroll to zoom. With the keyboard: arrow keys move it, plus and minus zoom, 0 recentres.',
  });

  const { handle, stack } = data.input;
  const alt = `Hacker House Goa 2026 pass for ${handle || 'a builder'}: ${data.identity.title}${
    stack ? `, ${stack}` : ''
  }. Serial number ${data.identity.serial}.`;

  const t = data.photo?.transform ?? DEFAULT_TRANSFORM;
  const moved = t.x !== 0 || t.y !== 0 || t.zoom !== 1;
  const showHint = !touched && !moved && !!data.photo;

  return (
    <div className={`relative ${className}`}>
      <div
        {...framing.frameProps}
        onPointerDownCapture={() => setTouched(true)}
        className={`h-full w-full touch-none select-none rounded-[10px] outline-offset-4 ${
          data.photo ? (framing.isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="h-full w-full rounded-[10px] object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
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
