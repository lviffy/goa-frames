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
 * Approximate advance width of a string, in units of font-size.
 *
 * Pure SVG has no text wrapping and no measurement API off-DOM, so fitting is
 * done by estimate. Victor Mono is monospaced, so its factor is exact. Imbue is
 * proportional and very condensed; the per-character table below was measured
 * off rendered specimens rather than guessed.
 */
const IMBUE_WIDTHS: Record<string, number> = {
  ' ': 0.18, I: 0.19, J: 0.3, L: 0.34, T: 0.38, E: 0.37, F: 0.35, S: 0.36,
  B: 0.4, C: 0.4, P: 0.38, R: 0.41, A: 0.43, V: 0.42, Y: 0.4, X: 0.42,
  D: 0.44, G: 0.44, H: 0.45, K: 0.43, N: 0.45, O: 0.46, Q: 0.46, U: 0.44,
  Z: 0.38, M: 0.58, W: 0.62, '-': 0.24, '·': 0.22, '.': 0.16, ',': 0.16,
  '0': 0.42, '1': 0.26, '2': 0.4, '3': 0.4, '4': 0.42, '5': 0.4,
  '6': 0.41, '7': 0.37, '8': 0.41, '9': 0.41, '/': 0.28, ':': 0.16,
};

export const MONO_ADVANCE = 0.6;

export function measure(text: string, family: 'Imbue' | 'Victor Mono'): number {
  if (family === 'Victor Mono') return text.length * MONO_ADVANCE;
  let total = 0;
  for (const ch of text.toUpperCase()) total += IMBUE_WIDTHS[ch] ?? 0.44;
  return total;
}

/** Largest font-size at which `text` fits `maxWidth`, clamped to [min, max]. */
export function fitSize(
  text: string,
  maxWidth: number,
  family: 'Imbue' | 'Victor Mono',
  min: number,
  max: number,
): number {
  const unit = measure(text, family);
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
  family: 'Imbue' | 'Victor Mono',
  cap = 0.26,
): number {
  const gaps = Math.max(1, text.length - 1);
  const natural = measure(text, family) * size;
  return Math.max(0, Math.min(cap * size, (targetWidth - natural) / gaps));
}

/** Clamp a number into a range. */
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
