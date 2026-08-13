'use client';

import { useId, useRef } from 'react';
import { EVENT } from '@/lib/brand';
import { BTN_PRIMARY, BTN_SECONDARY } from './ui';

export type IntakeStatus = 'idle' | 'reading' | 'error';

type Props = {
  status: IntakeStatus;
  error: string | null;
  /** True while a file is being dragged anywhere over the window. */
  dragging: boolean;
  onFile: (file: File) => void;
  className?: string;
};

/** Registration crosses, the kind that sit outside the trim on a real print run. */
function RegMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`absolute size-3.5 text-hh-cream/35 ${className}`} aria-hidden="true">
      <path d="M10 0v20M0 10h20" stroke="currentColor" strokeWidth="1" />
      <circle cx="10" cy="10" r="4.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export default function UploadZone({ status, error, dragging, onFile, className = '' }: Props) {
  const pickRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const busy = status === 'reading';

  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset first: picking the same file twice must still fire a change event.
    e.target.value = '';
    if (file) onFile(file);
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-[14px] border px-5 text-center backdrop-blur-xl transition-colors ${
        dragging
          ? 'border-hh-yellow bg-hh-yellow/10'
          : status === 'error'
            ? 'border-hh-pink/70 bg-hh-cream/[0.06]'
            : 'border-hh-cream/25 bg-hh-cream/[0.06]'
      } ${className}`}
    >
      <RegMark className="left-2.5 top-2.5" />
      <RegMark className="right-2.5 top-2.5" />
      <RegMark className="bottom-2.5 left-2.5" />
      <RegMark className="bottom-2.5 right-2.5" />

      {/* The full line wraps and orphans "2026" on a 390px phone, so the event
          name — which the headline says anyway — only joins once it fits. */}
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-hh-cream/60">
        <span className="hidden sm:inline">{EVENT.name} · </span>
        {EVENT.window}
      </p>

      <h1 className="mt-3 font-display text-[clamp(2.6rem,11vw,4.5rem)] font-semibold leading-[0.84] tracking-tight text-hh-cream">
        BOARDING
        <br />
        PASS N<span className="text-hh-yellow">°</span>247
      </h1>

      <p className="mt-4 max-w-[30ch] font-mono text-xs leading-relaxed text-hh-cream/75 sm:text-sm">
        {dragging
          ? 'Let go — we’ll take it from here.'
          : 'Drop in a photo of yourself and your pass gets issued on the spot. No account, no waiting.'}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className={BTN_PRIMARY}
          onClick={() => pickRef.current?.click()}
          disabled={busy}
        >
          {busy ? 'Reading your photo…' : 'Choose a photo'}
        </button>
        {/* Only offered where there's a camera to open. */}
        <button
          type="button"
          className={`${BTN_SECONDARY} hidden [@media(pointer:coarse)]:inline-flex`}
          onClick={() => camRef.current?.click()}
          disabled={busy}
        >
          Take one now
        </button>
      </div>

      {/* Neither gesture exists on a touch device, where this only wraps to two
          lines and pushes the buttons up. */}
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-hh-cream/45 [@media(pointer:coarse)]:hidden">
        Or drag it anywhere on this page · paste with ⌘V / Ctrl+V
      </p>

      {busy && (
        <div className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-hh-cream/10">
          <div className="h-full w-1/3 animate-[intake_1.1s_ease-in-out_infinite] bg-hh-yellow" />
        </div>
      )}

      <p
        id={errorId}
        role="status"
        aria-live="polite"
        className={`mt-5 max-w-[34ch] font-mono text-xs leading-relaxed ${
          error ? 'text-hh-pink' : 'sr-only'
        }`}
      >
        {error ?? (busy ? 'Reading your photo.' : '')}
      </p>

      <input
        ref={pickRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        aria-label="Choose a photo from this device"
        aria-describedby={error ? errorId : undefined}
        onChange={take}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        aria-label="Take a photo with the camera"
        onChange={take}
      />
    </div>
  );
}
