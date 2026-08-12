'use client';

import { useEffect, useState } from 'react';

/** Doors open, Goa. Used for the live counter in the corner. */
const DOORS = Date.UTC(2026, 9, 28, 3, 30, 0); // 09:00 IST, 28 Oct 2026

function countdown(now: number): string {
  const ms = Math.max(0, DOORS - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d}D ${pad(h)}:${pad(m)}:${pad(s)}`;
}

function LiveClock() {
  // Server-rendered markup can't know the time; fill it in after mount so the
  // first paint and the hydration pass agree.
  const [tick, setTick] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setTick(countdown(Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p
      className="flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-hh-cream drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] sm:text-sm"
      // Announced once, not every second.
      aria-label={`Pass issuing is live. Doors open in ${tick ?? 'under a year'}.`}
    >
      <span className="relative flex size-2.5 shrink-0 items-center justify-center" aria-hidden="true">
        <span className="absolute size-2.5 animate-ping rounded-full bg-green-400/70" />
        <span className="size-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)]" />
      </span>
      {/* The word carries the meaning; the dot only decorates it. */}
      <span aria-hidden="true">LIVE</span>
      <span aria-hidden="true" className="text-hh-cream/40">
        ·
      </span>
      <span aria-hidden="true" className="tabular-nums text-hh-cream/80">
        GOA IN {tick ?? '———'}
      </span>
    </p>
  );
}

const PILL =
  'inline-flex items-center gap-1.5 rounded-full p-2.5 text-[11px] font-medium tracking-[0.12em] text-hh-cream drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] transition hover:opacity-80 active:scale-95 sm:px-3 sm:py-2 sm:text-sm';

export default function TopBar({ onReset }: { onReset?: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3 px-3 pt-3 sm:px-5 sm:pt-4">
      <LiveClock />
      <nav className="flex items-center gap-0.5 sm:gap-1">
        {onReset && (
          <button type="button" onClick={onReset} className={PILL}>
            START OVER
          </button>
        )}
        <a href="https://hhgoa.com" target="_blank" rel="noreferrer" className={`${PILL} group`}>
          HHGOA.COM
          <svg
            viewBox="0 0 16 16"
            className="size-3 -rotate-45 opacity-50 transition-opacity group-hover:opacity-90"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </nav>
    </header>
  );
}
