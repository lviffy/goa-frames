import { ADVANCE, FALLBACK_ADVANCE, VERTICAL, type Face } from './metrics';

export type { Face };

/** XML-escape text destined for an SVG document. User input lands here. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Faces are named by family+weight because Imbue's bold is meaningfully wider
 * than its regular, and fitting display type off the wrong table walks it out
 * past the card edge. The two legacy names map onto the pair actually used.
 */
type FaceLike = Face | 'Imbue' | 'Victor Mono';

const FACES: Record<FaceLike, Face> = {
  imbue400: 'imbue400',
  imbue700: 'imbue700',
  mono400: 'mono400',
  mono700: 'mono700',
  Imbue: 'imbue700',
  'Victor Mono': 'mono400',
};

export const MONO_ADVANCE = 0.6;

/** The SVG font-family for a face. */
export function familyOf(face: FaceLike): string {
  return FACES[face].startsWith('imbue') ? 'Imbue' : 'Victor Mono';
}

/** The SVG font-weight for a face. */
export function weightOf(face: FaceLike): number {
  return FACES[face].endsWith('700') ? 700 : 400;
}

/** Cap height of a face, in units of font-size. */
export function capOf(face: FaceLike): number {
  return FACES[face].startsWith('imbue') ? VERTICAL.imbue.cap : VERTICAL.mono.cap;
}

/**
 * Advance width of a string, in units of font-size.
 *
 * Exact for anything in the measured table, which is every character the card
 * can actually emit after `mrzSafe`/uppercasing; a stray glyph outside it falls
 * back to a mid-range width rather than counting as zero.
 */
export function measure(text: string, face: FaceLike, tracking = 0): number {
  const key = FACES[face];
  const table = ADVANCE[key];
  const fallback = FALLBACK_ADVANCE[key];
  let total = 0;
  let n = 0;
  for (const ch of text) {
    total += table[ch] ?? fallback;
    n++;
  }
  // SVG letter-spacing adds a gap after every glyph, including the last one.
  return total + tracking * n;
}

/** Largest font-size at which `text` fits `maxWidth`, clamped to [min, max]. */
export function fitSize(
  text: string,
  maxWidth: number,
  face: FaceLike,
  min: number,
  max: number,
  tracking = 0,
): number {
  const unit = measure(text, face, tracking);
  if (unit <= 0) return max;
  return Math.max(min, Math.min(max, maxWidth / unit));
}

/**
 * Extra letter-spacing that pushes `text` out to exactly `targetWidth`.
 * Used to justify the two title lines to a common measure. Capped, because
 * past about 0.26em tracked display type stops reading as a word.
 */
export function trackTo(
  text: string,
  targetWidth: number,
  size: number,
  face: FaceLike,
  cap = 0.26,
): number {
  const gaps = Math.max(1, [...text].length - 1);
  const natural = measure(text, face) * size;
  return Math.max(0, Math.min(cap * size, (targetWidth - natural) / gaps));
}

/**
 * Greedy word wrap against the measured widths. Overflow past `maxLines` is
 * folded into the last line and ellipsised, so a builder who pastes an essay
 * into "working on" gets a truncated line rather than a broken layout.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  face: FaceLike,
  size: number,
  maxLines = 2,
  tracking = 0,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const fits = (s: string) => measure(s, face, tracking) * size <= maxWidth;

  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (fits(next) || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);

  // Anything that didn't fit gets ellipsised onto the final line.
  const used = lines.join(' ').split(/\s+/).length;
  if (used < words.length) {
    let last = lines[lines.length - 1] ?? '';
    while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

/** Truncate to a single line that fits, with an ellipsis if it had to cut. */
export function ellipsize(text: string, maxWidth: number, face: FaceLike, size: number): string {
  const t = text.trim();
  if (measure(t, face) * size <= maxWidth) return t;
  let s = t;
  while (s.length > 1 && measure(`${s}…`, face) * size > maxWidth) s = s.slice(0, -1).trimEnd();
  return `${s}…`;
}

/** Clamp a number into a range. */
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Round to 2dp and drop the trailing zeros — keeps the SVG string small. */
export const n2 = (v: number) => String(Math.round(v * 100) / 100);
