/**
 * Fonts for rasterisation.
 *
 * A pure-SVG document rasterised through an <img> tag is loaded in an isolated
 * context: it cannot see the page's @font-face rules, cannot fetch anything,
 * and will silently fall back to a system face if the fonts aren't inlined.
 * So for any SVG that will become a PNG, the woff2 bytes must be embedded as
 * base64 directly in the document.
 *
 * The DOM preview doesn't need this — it inherits the page's fonts — so
 * `embedFonts` is opt-in and the ~90KB of base64 is only paid on export.
 */

let cache: string | null = null;

const FILES: { family: string; url: string }[] = [
  { family: 'Imbue', url: '/fonts/Imbue-latin.woff2' },
  { family: 'Victor Mono', url: '/fonts/VictorMono-latin.woff2' },
];

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch failed: ${url} (${res.status})`);
  const buf = await res.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000; // avoid blowing the argument limit on large buffers
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Load and cache the @font-face block. Call once, early — before the user has
 * finished typing — so that export never waits on a network round-trip.
 */
export async function preloadFonts(): Promise<string> {
  if (cache) return cache;
  const faces = await Promise.all(
    FILES.map(async ({ family, url }) => {
      const b64 = await toBase64(url);
      return `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
    }),
  );
  cache = faces.join('');
  return cache;
}

/** Synchronous accessor. Returns '' until `preloadFonts()` has resolved. */
export function fontCss(): string {
  return cache ?? '';
}

export function fontsReady(): boolean {
  return cache !== null;
}
