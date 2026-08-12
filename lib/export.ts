'use client';

/**
 * SVG → PNG. The half of the brief that says "a real image file, not something
 * that only renders on-screen".
 *
 * The whole path is: pure-SVG string (no <foreignObject>) → data URI →
 * <img>.decode() → canvas.drawImage → canvas.toBlob('image/png'). Every step
 * of that is supported identically on iOS Safari, Android Chrome and desktop,
 * which is the entire reason renderCard() emits an SVG string instead of DOM.
 *
 * Two rules this file exists to enforce:
 *
 *  1. Fonts must be inlined as base64 *inside* the SVG. An <img> loading an SVG
 *     is an isolated document: it cannot see the page's @font-face rules and
 *     will silently substitute a system face. Silently — you only find out when
 *     you open the downloaded PNG and the wordmark is Helvetica.
 *  2. The data URI is built with encodeURIComponent, never btoa. The SVG
 *     carries arbitrary Unicode from user input (emoji handles, Devanagari
 *     names) and btoa throws InvalidCharacterError on anything above U+00FF.
 */

import { BRAND, CARD, EVENT, OG, colorway } from './brand';
import { renderCard } from './card/renderCard';
import { fontCss, fontsReady, preloadFonts } from './card/fonts';
import { esc, fitSize } from './card/util';
import type { CardData } from './types';

const PNG_MIME = 'image/png';

// ---------------------------------------------------------------- errors

export type ExportErrorCode =
  | 'environment' // called outside a browser
  | 'fonts' // the woff2 payloads never arrived
  | 'decode' // the browser refused to rasterise the SVG
  | 'canvas' // no 2d context
  | 'tainted' // cross-origin pixels poisoned the canvas
  | 'encode'; // toBlob returned null or never called back

/**
 * Every failure in this file is thrown as one of these, with a message that can
 * be shown to a human. Nothing here is allowed to fail quietly: the user is one
 * tap away from a download that produces no file and no explanation.
 */
export class ExportError extends Error {
  readonly code: ExportErrorCode;

  constructor(code: ExportErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

function assertBrowser(fn: string): void {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new ExportError(
      'environment',
      `${fn}() rasterises through a canvas and can only run in the browser.`,
    );
  }
}

// ---------------------------------------------------------------- fonts

/**
 * Load the base64 font payloads, with one retry. If they genuinely can't be
 * fetched we throw rather than exporting a card in a system fallback face —
 * a PNG that isn't on-brand fails a different line of the brief, and unlike a
 * thrown error it does so invisibly.
 */
async function ensureFonts(): Promise<void> {
  if (fontsReady()) return;
  try {
    await preloadFonts();
  } catch {
    try {
      await preloadFonts();
    } catch (err) {
      throw new ExportError(
        'fonts',
        'Could not load the pass fonts, so the image would have exported in the wrong typeface. Check your connection and try again.',
        err,
      );
    }
  }
}

// ---------------------------------------------------------------- raster

/**
 * Re-declare the raster size of an SVG without touching its contents, by
 * nesting it inside an outer <svg> that carries the target width/height and the
 * original viewBox. This gets a *vector* rescale (crisp text at 2x, crisp text
 * at the small size the OG slot needs) without doing regex surgery on another
 * module's output string.
 */
function resize(inner: string, w: number, h: number, vbW: number, vbH: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${w}" height="${h}" viewBox="0 0 ${vbW} ${vbH}">${inner}</svg>`
  );
}

function svgDataUri(svg: string): string {
  // encodeURIComponent, NOT btoa — see the file header.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function waitForLoad(img: HTMLImageElement, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) return resolve();
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`image load timed out after ${ms}ms`));
    }, ms);
    const cleanup = () => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };
    img.onload = () => {
      cleanup();
      resolve();
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('image load failed'));
    };
  });
}

/**
 * SVG string → decoded <img>.
 *
 * decode() is preferred over onload: it resolves only once the bitmap is ready
 * to paint, whereas onload can fire a frame before that on Safari and leave you
 * drawing a blank. Older Safari occasionally rejects decode() for SVG data
 * URIs though, so onload remains as a second chance; only if *both* fail do we
 * give up, and then loudly.
 */
async function svgToImage(svg: string, label: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = svgDataUri(svg);

  try {
    await img.decode();
  } catch (decodeErr) {
    try {
      await waitForLoad(img, 10_000);
    } catch (loadErr) {
      throw new ExportError(
        'decode',
        `The ${label} artwork could not be rasterised by this browser. If the photo was very large, try a smaller one.`,
        decodeErr ?? loadErr,
      );
    }
  }

  if (img.naturalWidth === 0 || img.naturalHeight === 0) {
    throw new ExportError('decode', `The ${label} artwork rasterised to an empty image.`);
  }
  return img;
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ExportError(
      'canvas',
      'This browser refused to open a 2D canvas, so the pass could not be turned into an image.',
    );
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

/**
 * canvas → PNG Blob, with all three of its failure modes made explicit:
 * a SecurityError from a tainted canvas, a null blob, and a callback that
 * simply never fires (seen on memory-pressured mobile Safari).
 */
function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      done(() =>
        reject(
          new ExportError(
            'encode',
            'The browser stopped responding while encoding the PNG. Try again, or use a smaller photo.',
          ),
        ),
      );
    }, 20_000);

    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          done(() =>
            reject(
              new ExportError(
                'encode',
                'The browser returned an empty file instead of a PNG. Try again, or use a smaller photo.',
              ),
            ),
          );
          return;
        }
        done(() => resolve(blob));
      }, PNG_MIME);
    } catch (err) {
      const tainted = err instanceof DOMException && err.name === 'SecurityError';
      done(() =>
        reject(
          tainted
            ? new ExportError(
                'tainted',
                'The photo came from another site and locked the canvas, so it cannot be saved. Upload the photo as a file instead.',
                err,
              )
            : new ExportError('encode', 'The PNG could not be encoded.', err),
        ),
      );
    }
  });
}

// ---------------------------------------------------------------- card PNG

/** Clamp the export scale to something a phone can actually allocate. */
function safeScale(scale: number | undefined): number {
  if (!Number.isFinite(scale) || scale === undefined) return 1;
  return Math.max(0.25, Math.min(3, scale));
}

/**
 * The card as a real PNG file, 1080×1350 by default (4:5 — X's tallest
 * in-feed ratio, so nothing gets cropped in the timeline).
 */
export async function exportPng(data: CardData, opts?: { scale?: number }): Promise<Blob> {
  assertBrowser('exportPng');
  await ensureFonts();

  const scale = safeScale(opts?.scale);
  const w = Math.round(CARD.w * scale);
  const h = Math.round(CARD.h * scale);

  const svg = renderCard(data, { embedFonts: true });
  const img = await svgToImage(
    scale === 1 ? svg : resize(svg, w, h, CARD.w, CARD.h),
    'pass',
  );

  const { canvas, ctx } = makeCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvasToPng(canvas);
}

// ---------------------------------------------------------------- OG PNG

/**
 * Where the 4:5 card sits inside the 1.91:1 link preview.
 * 440×550 is exactly 0.8, so the card is never distorted.
 */
const SLOT = { x: 80, y: 40, w: 440, h: 550 } as const;
/** The type column beside it. */
const COL = { x: 600, w: 540 } as const;

/**
 * The furniture around the card: green field, wordmark, event window.
 *
 * This is a separate SVG from the card and gets composited *under* it, rather
 * than nesting one SVG inside another via <image href="data:image/svg+xml">,
 * which several browsers refuse to load. Two rasters, one canvas, no nesting.
 */
function ogChromeSvg(data: CardData): string {
  const cw = colorway(data.input.colorway);
  const { w, h } = OG;
  const serial = String(data.identity.serial).padStart(4, '0');

  const kicker = `BOARDING PASS · No. ${serial}`;
  const line = [data.identity.title, data.input.stack.trim()].filter(Boolean).join('  ·  ');
  const lineSize = fitSize(line, COL.w, 'Victor Mono', 13, 22);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Victor Mono">
<style>${fontCss()}</style>
<defs>
<linearGradient id="og-field" x1="0" y1="0" x2="0.35" y2="1">
<stop offset="0" stop-color="${BRAND.green}"/>
<stop offset="1" stop-color="${BRAND.deepGreen}"/>
</linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#og-field)"/>
<rect x="18" y="18" width="${w - 36}" height="${h - 36}" fill="none" stroke="${BRAND.cream}" stroke-opacity="0.20" stroke-width="2"/>

<!-- misregistration ghost: the accent plate the card is printed over -->
<rect x="${SLOT.x + 16}" y="${SLOT.y + 16}" width="${SLOT.w}" height="${SLOT.h}" fill="${cw.accent}" opacity="0.85"/>
<rect x="${SLOT.x - 5}" y="${SLOT.y - 5}" width="${SLOT.w + 10}" height="${SLOT.h + 10}" fill="${BRAND.cream}" opacity="0.10"/>

<text x="${COL.x}" y="104" font-size="21" letter-spacing="3.4" fill="${BRAND.cream}" fill-opacity="0.72">${esc(kicker)}</text>
<text x="${COL.x}" y="252" font-family="Imbue" font-weight="700" font-size="168" fill="${BRAND.cream}">HACKER</text>
<text x="${COL.x}" y="394" font-family="Imbue" font-weight="700" font-size="168" fill="${BRAND.yellow}">HOUSE</text>
<line x1="${COL.x}" y1="434" x2="${COL.x + COL.w}" y2="434" stroke="${BRAND.cream}" stroke-opacity="0.35" stroke-width="2"/>
<text x="${COL.x}" y="482" font-size="24" letter-spacing="2.4" fill="${BRAND.cream}">${esc(EVENT.window)}</text>
<text x="${COL.x}" y="526" font-size="${lineSize.toFixed(1)}" letter-spacing="1.2" fill="${cw.accent}">${esc(line)}</text>
<text x="${COL.x}" y="578" font-size="26" letter-spacing="1.4" fill="${BRAND.yellow}">${esc(EVENT.hashtag)}</text>
</svg>`;
}

/**
 * The 1200×630 link-preview image.
 *
 * This is not the card bitmap with padding bolted on. X's
 * `summary_large_image` centre-crops whatever you give it to 1.91:1, so a
 * 1080×1350 card handed over raw loses its top and bottom — the wordmark and
 * the serial, i.e. everything that identifies the event. So the card is
 * *composed into* a deliberate 1.91:1 layout: the full card at 440×550 on the
 * left, the wordmark and "GOA, INDIA · 28–31 OCT 2026" beside it.
 *
 * The card is re-rasterised at slot size rather than downscaled from 1080px, so
 * its small type stays vector-sharp.
 */
export async function exportOgPng(data: CardData): Promise<Blob> {
  assertBrowser('exportOgPng');
  await ensureFonts();

  const { canvas, ctx } = makeCanvas(OG.w, OG.h);

  const chrome = await svgToImage(ogChromeSvg(data), 'link preview');
  ctx.drawImage(chrome, 0, 0, OG.w, OG.h);

  const card = await svgToImage(
    resize(renderCard(data, { embedFonts: true }), SLOT.w, SLOT.h, CARD.w, CARD.h),
    'pass',
  );
  ctx.drawImage(card, SLOT.x, SLOT.y, SLOT.w, SLOT.h);

  return canvasToPng(canvas);
}
