'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CardPreview from '@/components/CardPreview';
import Dock from '@/components/Dock';
import GoaScene from '@/components/GoaScene';
import TopBar from '@/components/TopBar';
import UploadZone, { type IntakeStatus } from '@/components/UploadZone';
import { useFileIntake } from '@/components/useFileIntake';
import { DEFAULT_COLORWAY } from '@/lib/brand';
import { preloadFonts } from '@/lib/card/fonts';
import { buildIdentity, generateTitle } from '@/lib/identity';
import { loadPhoto, photoErrorMessage } from '@/lib/photo';
import { prepareShare } from '@/lib/share';
import type { BuilderInput, CardData, Photo, PhotoTransform } from '@/lib/types';

/**
 * The stage: a fixed silkscreen backdrop, the pass floating on it, and a glass
 * dock at the foot that drives everything. One screen, no routes, no gate.
 */

/** Shown on the pass before anyone types, so the first render is never a blank form. */
const PLACEHOLDER = { handle: '@yourhandle', stack: 'Rust · infra' };

const EMPTY: BuilderInput = { handle: '', stack: '', colorway: DEFAULT_COLORWAY };

/** Height-aware sizing: the pass fills the space left over, never more. See globals.css. */
const HERO = 'pass-fit';

export default function Page() {
  const [input, setInput] = useState<BuilderInput>(EMPTY);
  const [photo, setPhoto] = useState<Photo | null>(null);
  /** Bumped per accepted photo; remounts the preview so framing starts fresh. */
  const [photoNonce, setPhotoNonce] = useState(0);
  const [titleSalt, setTitleSalt] = useState(0);
  const [status, setStatus] = useState<IntakeStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const jobId = useRef(0);

  // Inlined woff2 makes the preview byte-identical to the download. Fetch it
  // once, up front, so neither the preview nor the export ever waits on it.
  useEffect(() => {
    let live = true;
    preloadFonts()
      .then(() => live && setFontsReady(true))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const takeFile = useCallback(async (file: File) => {
    const job = ++jobId.current;
    setStatus('reading');
    setError(null);
    try {
      const next = await loadPhoto(file);
      if (jobId.current !== job) return; // a newer file won the race
      setPhoto(next);
      setPhotoNonce((n) => n + 1);
      setStatus('idle');
    } catch (err) {
      if (jobId.current !== job) return;
      setStatus('error');
      setError(photoErrorMessage(err));
    }
  }, []);

  const { dragging } = useFileIntake(takeFile);

  const onInput = useCallback((patch: Partial<BuilderInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const onTransform = useCallback((transform: PhotoTransform) => {
    setPhoto((prev) => (prev ? { ...prev, transform } : prev));
  }, []);

  const reset = useCallback(() => {
    jobId.current += 1;
    setPhoto(null);
    setInput(EMPTY);
    setTitleSalt(0);
    setStatus('idle');
    setError(null);
  }, []);

  // What the card shows: typed values, or the placeholders until they exist.
  // The salt re-derives on every keystroke, so a re-rolled title still tracks
  // what the builder types instead of freezing on a stale string.
  const data: CardData = useMemo(() => {
    const shown: BuilderInput = {
      colorway: input.colorway,
      handle: input.handle.trim() || PLACEHOLDER.handle,
      stack: input.stack.trim() || PLACEHOLDER.stack,
    };
    if (titleSalt > 0) shown.titleOverride = generateTitle(shown, titleSalt);
    return { input: shown, identity: buildIdentity(shown), photo };
  }, [input.colorway, input.handle, input.stack, titleSalt, photo]);

  // Publish the PNG in the background as soon as the card settles, so Share
  // never waits on a network round-trip. Never rejects; a failure just means
  // the share falls back to attaching the file.
  useEffect(() => {
    if (!data.photo) return;
    const id = setTimeout(() => void prepareShare(data), 700);
    return () => clearTimeout(id);
  }, [data]);

  return (
    <>
      <GoaScene />

      {/*
        `h-dvh`, not `min-h-dvh`: the stage below is a size container, and a
        container-query container needs a *definite* block size or `cqh`
        resolves to 0 — which silently collapses the pass to the width of its
        own text. `min-h` leaves the height content-dependent. The floor lets a
        very short window scroll rather than crush the pass to nothing.
      */}
      <div className="flex h-dvh min-h-[600px] flex-col">
        <TopBar onReset={photo ? reset : undefined} />

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-4 [container-type:size]">
          {photo ? (
            <>
              <CardPreview
                key={photoNonce}
                className={HERO}
                data={data}
                onTransform={onTransform}
                embedFonts={fontsReady}
              />
              {(error || status === 'reading') && (
                <p
                  role="alert"
                  className={`absolute inset-x-4 top-2 mx-auto max-w-[42ch] rounded-full px-4 py-2 text-center font-mono text-[11px] leading-snug backdrop-blur-md ${
                    error ? 'bg-hh-pink/85 text-white' : 'bg-black/70 text-hh-cream'
                  }`}
                >
                  {error ?? 'Reading your photo…'}
                </p>
              )}
            </>
          ) : (
            <UploadZone
              className={HERO}
              status={status}
              error={error}
              dragging={dragging}
              onFile={takeFile}
            />
          )}
        </div>

        {photo && (
          <Dock
            data={data}
            input={input}
            onInput={onInput}
            onReroll={() => setTitleSalt((n) => n + 1)}
            onFile={takeFile}
          />
        )}
      </div>
    </>
  );
}
