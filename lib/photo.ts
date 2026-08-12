import { DEFAULT_TRANSFORM } from './types';
import type { Photo, PhotoTransform } from './types';

/**
 * Photo intake.
 *
 * One entry point — `loadPhoto(file)` — that takes whatever a phone hands us
 * and returns something the renderer can draw without thinking: an upright,
 * downscaled, EXIF-corrected JPEG data URI plus its real pixel size.
 *
 * The brief is explicit that people will not crop first and that most of them
 * are on a phone, so every branch here exists because a real photo breaks
 * without it: HEIC from an iPhone that desktop browsers cannot decode, EXIF
 * orientation that leaves selfies lying on their side, 4000px originals that
 * turn a "near-instant" card into a progress bar.
 *
 * Everything browser-specific is feature-detected with a working fallback,
 * because the failure mode of a missing guard here is a blank card.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Longest edge of the processed image, in pixels. */
export const MAX_EDGE = 1400;

/** JPEG quality for the processed image. The card is printed-looking; 0.86 is invisible. */
export const JPEG_QUALITY = 0.86;

/** Anything larger than this is refused before we try to decode it. */
export const MAX_FILE_BYTES = 40 * 1024 * 1024;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type PhotoErrorCode =
  | 'no-file'
  | 'not-an-image'
  | 'empty-file'
  | 'too-large'
  | 'decode-failed'
  | 'heic-failed'
  | 'no-canvas';

/**
 * Every rejection path throws one of these. `.message` is written to be shown
 * to a human verbatim: what went wrong, then what to do about it.
 */
export class PhotoError extends Error {
  readonly code: PhotoErrorCode;
  constructor(code: PhotoErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options as ErrorOptions);
    this.name = 'PhotoError';
    this.code = code;
    // Keeps `instanceof PhotoError` working when TS downlevels to ES5-ish output.
    Object.setPrototypeOf(this, PhotoError.prototype);
  }
}

export function isPhotoError(e: unknown): e is PhotoError {
  return e instanceof PhotoError || (typeof e === 'object' && e !== null && (e as PhotoError).name === 'PhotoError');
}

/** Turns anything thrown by `loadPhoto` into a sentence worth showing a user. */
export function photoErrorMessage(e: unknown): string {
  if (isPhotoError(e)) return e.message;
  return "Something went wrong reading that photo. Try a different one, or a JPG if you have it.";
}

// ---------------------------------------------------------------------------
// Public geometry helpers (pure — these are the ones under test)
// ---------------------------------------------------------------------------

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);
const finite = (n: number, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback);

/**
 * Scale at which an image exactly covers a box: no letterboxing, overflow on
 * at most one axis. This is the `1` that `PhotoTransform.zoom` multiplies.
 */
export function coverScale(imgW: number, imgH: number, boxW: number, boxH: number): number {
  if (!(imgW > 0) || !(imgH > 0) || !(boxW > 0) || !(boxH > 0)) return 1;
  return Math.max(boxW / imgW, boxH / imgH);
}

/**
 * Keeps a transform legal.
 *
 * Zoom is clamped to [1, 4] — below 1 the photo would no longer cover its
 * window and the card would show a gap. Pan is measured in fractions of the
 * *window*, and is bounded by however much overflow the current zoom actually
 * produces: at zoom 1 a photo that exactly covers has zero slack on its tight
 * axis, so dragging it simply cannot open a gap. Zoom in and the slack appears.
 */
export function clampTransform(
  t: PhotoTransform,
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): PhotoTransform {
  const zoom = clamp(finite(t?.zoom, 1), MIN_ZOOM, MAX_ZOOM);
  const s = coverScale(imgW, imgH, boxW, boxH) * zoom;
  const drawnW = imgW * s;
  const drawnH = imgH * s;
  // Half the overflow, expressed as a fraction of the window.
  const maxX = boxW > 0 ? Math.max(0, (drawnW - boxW) / 2 / boxW) : 0;
  const maxY = boxH > 0 ? Math.max(0, (drawnH - boxH) / 2 / boxH) : 0;
  return {
    x: clamp(finite(t?.x, 0), -maxX, maxX),
    y: clamp(finite(t?.y, 0), -maxY, maxY),
    zoom,
  };
}

/**
 * The rectangle to draw the photo at, in window coordinates (0,0 = window
 * top-left). Feed straight into `<image x y width height>` inside a clipPath,
 * or into `ctx.drawImage`. Clamps as it goes, so it is always gap-free.
 */
export function photoRect(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  t: PhotoTransform = DEFAULT_TRANSFORM,
): { x: number; y: number; width: number; height: number } {
  const c = clampTransform(t, imgW, imgH, boxW, boxH);
  const s = coverScale(imgW, imgH, boxW, boxH) * c.zoom;
  const width = imgW * s;
  const height = imgH * s;
  return {
    x: (boxW - width) / 2 + c.x * boxW,
    y: (boxH - height) / 2 + c.y * boxH,
    width,
    height,
  };
}

/**
 * A starting transform that puts a chosen point of the *image* at a chosen
 * height of the *window*.
 *
 * Default: the image's upper third lands slightly above the window's middle.
 * Faces sit in the upper third of nearly every photo, so a naive centre crop
 * decapitates people in landscape shots — this is the heuristic from the plan,
 * expressed as a transform instead of a `preserveAspectRatio` string so the
 * user can still drag away from it.
 */
export function biasTransform(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  focusY = 1 / 3,
  targetY = 0.42,
  zoom = 1,
): PhotoTransform {
  const s = coverScale(imgW, imgH, boxW, boxH) * zoom;
  const r = boxH > 0 ? (imgH * s) / boxH : 1;
  // top + focusY*drawnH = targetY*boxH, where top = (boxH - drawnH)/2 + y*boxH
  const y = targetY - focusY * r - (1 - r) / 2;
  return clampTransform({ x: 0, y, zoom }, imgW, imgH, boxW, boxH);
}

// ---------------------------------------------------------------------------
// loadPhoto
// ---------------------------------------------------------------------------

/**
 * Decode → orient → downscale → re-encode. Returns a `Photo` whose width and
 * height are those of the *processed* image, so every consumer can treat
 * `dataUrl` as the truth and forget the original file existed.
 *
 * Throws `PhotoError` with a user-showable `.message`.
 */
export async function loadPhoto(file: File): Promise<Photo> {
  validateFile(file);

  const { source, width, height, orientationApplied, blob } = await decode(file);

  // Only photos that actually carry a rotation tag pay for the orientation
  // probe; the upright-JPEG common case costs one 256KB header read.
  let orientation = 1;
  if (!orientationApplied) {
    const exif = await readExifOrientation(blob).catch(() => 1);
    if (exif > 1 && !(await createImageBitmapHonoursExif())) orientation = exif;
  }

  try {
    const { dataUrl, width: outW, height: outH } = await processToJpeg(source, width, height, orientation);
    return { dataUrl, width: outW, height: outH, transform: { ...DEFAULT_TRANSFORM } };
  } finally {
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      // Free the decoded pixels immediately; a 12MP bitmap is ~48MB of RAM and
      // phones are the target platform.
      try { source.close(); } catch { /* not fatal */ }
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Validation
// ---------------------------------------------------------------------------

const HEIC_EXT = /\.(heic|heif|hif)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|avif|heic|heif|hif|tiff?)$/i;

function looksLikeImage(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  // iOS and some Android file pickers hand over HEIC (and occasionally JPEG)
  // with an empty MIME type. Fall back to the extension before refusing.
  if (type === '' || type === 'application/octet-stream') return IMAGE_EXT.test(file.name || '');
  return false;
}

function looksLikeHeic(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  return type.includes('heic') || type.includes('heif') || HEIC_EXT.test(file.name || '');
}

function describeFile(file: File): string {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('video/')) return 'a video';
  if (type === 'application/pdf') return 'a PDF';
  const ext = /\.([a-z0-9]{1,5})$/i.exec(file.name || '')?.[1];
  if (ext) return `a .${ext.toLowerCase()} file`;
  if (type) return `a ${type} file`;
  return 'not a photo';
}

function validateFile(file: File): void {
  if (!file) {
    throw new PhotoError('no-file', 'No photo was selected. Pick one and try again.');
  }
  if (!looksLikeImage(file)) {
    throw new PhotoError(
      'not-an-image',
      `That's ${describeFile(file)}, and we need a photo. Try a JPG or PNG, or pick something straight from your camera roll.`,
    );
  }
  if (file.size === 0) {
    throw new PhotoError('empty-file', "That file came through empty. Try picking the photo again.");
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024));
    throw new PhotoError(
      'too-large',
      `That photo is about ${mb}MB — too big to process in the browser. Try a smaller one, or take a fresh shot instead of using the original file.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2 + 3. Decode, with the HEIC fallback and the EXIF question
// ---------------------------------------------------------------------------

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** True when the decoder definitely rotated the pixels for us already. */
  orientationApplied: boolean;
  /** The blob the pixels actually came from — for HEIC that's the converted JPEG. */
  blob: Blob;
};

async function decode(file: File): Promise<Decoded> {
  // Fast path: the browser decodes it and honours EXIF while doing so.
  try {
    return await decodeBlob(file);
  } catch (firstError) {
    // Slow path. The overwhelmingly likely cause is HEIC on desktop Chrome or
    // Firefox — iOS Safari transcodes HEIC to JPEG during upload, desktop does
    // not. `heic-to` is ~1MB of wasm, so it is imported *here* and nowhere
    // else: the 95% JPEG/PNG case never downloads it.
    const jpeg = await heicToJpeg(file, firstError);
    try {
      return await decodeBlob(jpeg);
    } catch (secondError) {
      throw new PhotoError(
        'decode-failed',
        "We couldn't open that photo. It may be damaged, or in a format this browser doesn't understand — try saving it as a JPG and uploading again.",
        { cause: secondError },
      );
    }
  }
}

async function heicToJpeg(file: File, cause: unknown): Promise<Blob> {
  let mod: typeof import('heic-to');
  try {
    mod = await import('heic-to');
  } catch (e) {
    throw new PhotoError(
      looksLikeHeic(file) ? 'heic-failed' : 'decode-failed',
      "We couldn't open that photo — the converter we need didn't load. Check your connection and try again, or upload a JPG.",
      { cause: e },
    );
  }

  let isHeic = false;
  try {
    isHeic = await mod.isHeic(file);
  } catch {
    isHeic = looksLikeHeic(file);
  }
  if (!isHeic) {
    throw new PhotoError(
      'decode-failed',
      "We couldn't open that photo. It may be damaged, or in a format this browser doesn't understand — try saving it as a JPG and uploading again.",
      { cause },
    );
  }

  try {
    // 0.94 here, not 0.86: this is an intermediate, and the final re-encode
    // after downscaling is where the quality budget actually gets spent.
    return await mod.heicTo({ blob: file, type: 'image/jpeg', quality: 0.94 });
  } catch (e) {
    throw new PhotoError(
      'heic-failed',
      "This looks like an iPhone HEIC photo and we couldn't convert it here. On your iPhone, Settings → Camera → Formats → 'Most Compatible' saves JPGs instead — or just send the photo to yourself first, which converts it.",
      { cause: e },
    );
  }
}

async function decodeBlob(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      // Some engines reject the options bag rather than ignoring it.
      bmp = await createImageBitmap(blob);
    }
    if (!bmp || bmp.width === 0 || bmp.height === 0) throw new Error('empty bitmap');
    return { source: bmp, width: bmp.width, height: bmp.height, orientationApplied: false, blob };
  }
  // No createImageBitmap at all (very old Safari). <img> decoding is universal,
  // and every current engine defaults to `image-orientation: from-image` there.
  const img = await decodeViaImageElement(blob);
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    orientationApplied: true,
    blob,
  };
}

function decodeViaImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      reject(new Error('no DOM available to decode with'));
      return;
    }
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    const done = (fn: () => void) => {
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(url);
      fn();
    };
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) done(() => reject(new Error('zero-size image')));
      else done(() => resolve(img));
    };
    img.onerror = () => done(() => reject(new Error('image element failed to decode')));
    img.src = url;
  });
}

/**
 * Does this engine actually honour `{ imageOrientation: 'from-image' }`?
 *
 * The option is silently ignored by some builds, which is exactly the sideways
 * iPhone photo everyone complains about. Rather than trust it, encode a 3×2
 * JPEG at runtime, splice in an EXIF block that says "orientation 6" (rotate
 * 90° CW), decode it back and see whether the dimensions came out swapped.
 *
 * Runs at most once per session, lazily, and only when a photo actually
 * carries a non-default orientation — the common path never pays for it.
 * If the probe itself fails we assume support (true), because a wrong "false"
 * would double-rotate the photo, which is worse than not rotating it.
 */
let orientationProbe: Promise<boolean> | null = null;
function createImageBitmapHonoursExif(): Promise<boolean> {
  if (!orientationProbe) orientationProbe = runOrientationProbe().catch(() => true);
  return orientationProbe;
}

async function runOrientationProbe(): Promise<boolean> {
  const surface = makeSurface(3, 2);
  if (!surface) return true;
  surface.ctx.fillStyle = '#808080';
  surface.ctx.fillRect(0, 0, 3, 2);
  const blob = await surfaceToBlob(surface, 'image/jpeg', 0.5);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return true;

  // APP1 / "Exif\0\0" / little-endian TIFF / one IFD entry: 0x0112 = 6.
  const app1 = new Uint8Array([
    0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
  const spliced = new Uint8Array(bytes.length + app1.length);
  spliced.set(bytes.subarray(0, 2), 0);
  spliced.set(app1, 2);
  spliced.set(bytes.subarray(2), 2 + app1.length);

  const bmp = await createImageBitmap(new Blob([spliced], { type: 'image/jpeg' }), {
    imageOrientation: 'from-image',
  });
  const swapped = bmp.width === 2 && bmp.height === 3;
  try { bmp.close(); } catch { /* ignore */ }
  return swapped;
}

/**
 * Reads the EXIF orientation tag (1–8) straight out of the JPEG bytes.
 * Used only as the fallback for engines that ignore `imageOrientation`.
 * Returns 1 for "upright, or we couldn't tell", which is always safe.
 */
export async function readExifOrientation(blob: Blob): Promise<number> {
  // The APP1 block lives in the first few KB; 256KB is generous even for files
  // with a large embedded thumbnail, and avoids reading a 30MB photo twice.
  const head = blob.slice(0, 256 * 1024);
  const view = new DataView(await head.arrayBuffer());
  if (view.byteLength < 4) return 1;
  if (view.getUint16(0, false) !== 0xffd8) return 1; // not a JPEG

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset++; // resync over padding
      continue;
    }
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) return 1; // start of scan — no EXIF before the pixels
    const size = view.getUint16(offset + 2, false);
    if (size < 2) return 1;
    if (marker === 0xe1 && offset + 10 <= view.byteLength) {
      const exif = view.getUint32(offset + 4, false);
      if (exif === 0x45786966) {
        const o = readOrientationFromTiff(view, offset + 10);
        if (o) return o;
      }
    }
    offset += 2 + size;
  }
  return 1;
}

function readOrientationFromTiff(view: DataView, tiff: number): number | null {
  if (tiff + 8 > view.byteLength) return null;
  const endian = view.getUint16(tiff, false);
  const little = endian === 0x4949;
  if (!little && endian !== 0x4d4d) return null;
  if (view.getUint16(tiff + 2, little) !== 0x002a) return null;

  const ifd = tiff + view.getUint32(tiff + 4, little);
  if (ifd + 2 > view.byteLength) return null;
  const count = view.getUint16(ifd, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) return null;
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4 + 5. Orient, downscale, encode
// ---------------------------------------------------------------------------

type Surface = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
};

function makeSurface(w: number, h: number): Surface | null {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (ctx) return { canvas, ctx: ctx as OffscreenCanvasRenderingContext2D };
    } catch {
      // Safari shipped OffscreenCanvas with a WebGL-only 2d context for a
      // while. Fall through to the DOM canvas.
    }
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

async function surfaceToBlob(s: Surface, type: string, quality: number): Promise<Blob> {
  const canvas = s.canvas;
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type, quality });
  }
  const el = canvas as HTMLCanvasElement;
  return new Promise<Blob>((resolve, reject) => {
    el.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      type,
      quality,
    );
  });
}

async function surfaceToDataUrl(s: Surface, type: string, quality: number): Promise<string> {
  const canvas = s.canvas;
  if (!(typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas)) {
    // Synchronous and allocation-light — preferred where it exists.
    return (canvas as HTMLCanvasElement).toDataURL(type, quality);
  }
  const blob = await surfaceToBlob(s, type, quality);
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error('FileReader failed'));
    fr.readAsDataURL(blob);
  });
}

/** Sizes to pass through, each at most a 2× reduction, ending exactly at `scale`. */
function halvingSteps(scale: number): number[] {
  const out: number[] = [];
  let s = 1;
  while (s * 0.5 > scale) {
    s *= 0.5;
    out.push(s);
  }
  out.push(scale);
  return out;
}

/** Orientation 5–8 rotate by 90°, so the upright image has swapped dimensions. */
const swapsAxes = (o: number) => o >= 5 && o <= 8;

/**
 * `transform(a,b,c,d,e,f)` that maps the raw decoded pixels onto an upright
 * canvas. `dw`/`dh` are the *drawn* (pre-rotation) dimensions; for 5–8 the
 * canvas itself is dh × dw.
 */
function applyOrientation(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  o: number,
  dw: number,
  dh: number,
): void {
  switch (o) {
    case 2: ctx.transform(-1, 0, 0, 1, dw, 0); break;   // mirror
    case 3: ctx.transform(-1, 0, 0, -1, dw, dh); break; // 180°
    case 4: ctx.transform(1, 0, 0, -1, 0, dh); break;   // flip
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;     // transpose
    case 6: ctx.transform(0, 1, -1, 0, dh, 0); break;   // 90° CW
    case 7: ctx.transform(0, -1, -1, 0, dh, dw); break; // transverse
    case 8: ctx.transform(0, -1, 1, 0, 0, dw); break;   // 90° CCW
    default: break;                                     // 1, or unknown
  }
}

async function processToJpeg(
  source: CanvasImageSource,
  rawW: number,
  rawH: number,
  orientation: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const swap = swapsAxes(orientation);
  const uprightW = swap ? rawH : rawW;
  const uprightH = swap ? rawW : rawH;

  const longEdge = Math.max(uprightW, uprightH);
  const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;

  // One pass when we can; halving passes when the reduction is more than 2×,
  // because a single big downscale aliases badly (bilinear only samples 2×2).
  const steps = halvingSteps(scale);

  let src: CanvasImageSource = source;
  let last: Surface | null = null;
  let outW = uprightW;
  let outH = uprightH;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    outW = Math.max(1, Math.round(uprightW * s));
    outH = Math.max(1, Math.round(uprightH * s));
    const surface = makeSurface(outW, outH);
    if (!surface) {
      throw new PhotoError(
        'no-canvas',
        "This browser can't process images, so we can't build your card here. Try Chrome, Safari or Firefox.",
      );
    }
    const { ctx } = surface;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // JPEG has no alpha: flatten onto white so PNGs with transparency don't
    // come out with black fringes.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);

    if (i === 0 && orientation > 1) {
      // Fold the rotation into the first pass — it costs nothing extra.
      const drawnW = Math.max(1, Math.round(rawW * s));
      const drawnH = Math.max(1, Math.round(rawH * s));
      ctx.save();
      applyOrientation(ctx, orientation, drawnW, drawnH);
      ctx.drawImage(src, 0, 0, drawnW, drawnH);
      ctx.restore();
    } else {
      ctx.drawImage(src, 0, 0, outW, outH);
    }

    src = surface.canvas as CanvasImageSource;
    last = surface;
  }

  if (!last) {
    throw new PhotoError(
      'no-canvas',
      "This browser can't process images, so we can't build your card here. Try Chrome, Safari or Firefox.",
    );
  }

  const dataUrl = await surfaceToDataUrl(last, 'image/jpeg', JPEG_QUALITY);
  // Release the intermediate surface on engines that keep it alive.
  if (!(typeof OffscreenCanvas !== 'undefined' && last.canvas instanceof OffscreenCanvas)) {
    (last.canvas as HTMLCanvasElement).width = 1;
    (last.canvas as HTMLCanvasElement).height = 1;
  }
  return { dataUrl, width: outW, height: outH };
}

// ---------------------------------------------------------------------------
// Optional: face bias
// ---------------------------------------------------------------------------

type FaceBox = { boundingBox: { x: number; y: number; width: number; height: number } };
type FaceDetectorLike = { detect(src: CanvasImageSource | Blob): Promise<FaceBox[]> };

/**
 * Vertical centre of the largest detected face, as a fraction of image height,
 * for use as `focusY` in `biasTransform`. Returns `null` when there is no
 * detector, no face, or the detector takes too long.
 *
 * Chrome-only (`FaceDetector`), best-effort, and hard-capped by a timeout: a
 * hanging detector must never be able to delay the card appearing. Callers
 * should render with the top-third heuristic immediately and only nudge the
 * framing if this resolves.
 */
export async function detectFaceBias(
  source: CanvasImageSource | Blob,
  imgH: number,
  timeoutMs = 250,
): Promise<number | null> {
  const Ctor = (globalThis as unknown as { FaceDetector?: new (o?: object) => FaceDetectorLike }).FaceDetector;
  if (typeof Ctor !== 'function' || !(imgH > 0)) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const detector = new Ctor({ fastMode: true, maxDetectedFaces: 5 });
    const detection = detector.detect(source);
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const faces = await Promise.race([detection.catch(() => null), timeout]);
    if (!faces || faces.length === 0) return null;

    let best = faces[0];
    for (const f of faces) {
      const a = f.boundingBox.width * f.boundingBox.height;
      if (a > best.boundingBox.width * best.boundingBox.height) best = f;
    }
    const b = best.boundingBox;
    // Aim slightly above the face's centre — eyes, not chin.
    const centre = (b.y + b.height * 0.45) / imgH;
    return Number.isFinite(centre) ? clamp(centre, 0, 1) : null;
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Self-test for the pure geometry (no DOM required)
// ---------------------------------------------------------------------------

/**
 * Pure-function checks for `coverScale` / `clampTransform` / `photoRect`.
 * Kept in-module so it compiles with the app and cannot drift from it.
 * Not imported by any component, so it tree-shakes out of the bundle.
 */
export function __test(): { passed: number; failed: number; failures: string[] } {
  const failures: string[] = [];
  let passed = 0;
  const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
  const check = (name: string, cond: boolean, detail = '') => {
    if (cond) passed++;
    else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  };

  // --- coverScale ---------------------------------------------------------
  check('cover: square into square', near(coverScale(100, 100, 50, 50), 0.5));
  check('cover: landscape into portrait box uses height', near(coverScale(1400, 1050, 600, 800), 800 / 1050));
  check('cover: portrait into landscape box uses width', near(coverScale(1050, 1400, 800, 600), 800 / 1050));
  check('cover: upscales when image is smaller than box', near(coverScale(100, 100, 400, 200), 4));
  check('cover: zero image is 1, not Infinity', coverScale(0, 0, 600, 800) === 1);
  check('cover: zero box is 1, not 0', coverScale(600, 800, 0, 0) === 1);
  check('cover: NaN is 1', coverScale(NaN, 100, 100, 100) === 1);

  // --- clampTransform: zoom ----------------------------------------------
  check('zoom: floor is 1', clampTransform({ x: 0, y: 0, zoom: 0.2 }, 100, 100, 50, 50).zoom === 1);
  check('zoom: ceiling is 4', clampTransform({ x: 0, y: 0, zoom: 99 }, 100, 100, 50, 50).zoom === 4);
  check('zoom: NaN falls back to 1', clampTransform({ x: 0, y: 0, zoom: NaN }, 100, 100, 50, 50).zoom === 1);
  check('pan: NaN falls back to 0', clampTransform({ x: NaN, y: NaN, zoom: 2 }, 100, 100, 50, 50).x === 0);

  // --- clampTransform: pan bounds ----------------------------------------
  // Exact cover at zoom 1: no slack on either axis, so no pan at all.
  {
    const t = clampTransform({ x: 0.9, y: -0.9, zoom: 1 }, 100, 100, 50, 50);
    check('pan: exact cover at zoom 1 is pinned', t.x === 0 && t.y === 0, JSON.stringify(t));
  }
  // 4:3 landscape into a 3:4 portrait window: slack horizontally only.
  {
    const t = clampTransform({ x: 5, y: 5, zoom: 1 }, 1400, 1050, 600, 800);
    const drawnW = 1400 * (800 / 1050);
    check('pan: landscape in portrait box, x bound', near(t.x, (drawnW - 600) / 2 / 600), JSON.stringify(t));
    check('pan: landscape in portrait box, y pinned', t.y === 0, JSON.stringify(t));
    const neg = clampTransform({ x: -5, y: -5, zoom: 1 }, 1400, 1050, 600, 800);
    check('pan: bounds are symmetric', near(neg.x, -t.x));
  }
  // Zooming in opens slack on the previously pinned axis.
  {
    const t = clampTransform({ x: 0, y: 5, zoom: 2 }, 1400, 1050, 600, 800);
    const drawnH = 1050 * (800 / 1050) * 2;
    check('pan: zoom 2 opens vertical slack', near(t.y, (drawnH - 800) / 2 / 800) && t.y > 0, JSON.stringify(t));
  }
  // Doubling zoom more than doubles the pannable range (overflow grows by the
  // full drawn size, not by the box).
  {
    const a = clampTransform({ x: 9, y: 0, zoom: 1 }, 1400, 1050, 600, 800).x;
    const b = clampTransform({ x: 9, y: 0, zoom: 2 }, 1400, 1050, 600, 800).x;
    check('pan: range grows with zoom', b > a * 2);
  }
  // In-range values survive untouched.
  {
    const t = clampTransform({ x: 0.1, y: 0.05, zoom: 1.5 }, 1000, 1000, 400, 400);
    check('pan: in-range value is preserved', t.x === 0.1 && t.y === 0.05 && t.zoom === 1.5);
  }
  // Degenerate inputs must not produce NaN.
  {
    const t = clampTransform({ x: 0.5, y: 0.5, zoom: 2 }, 0, 0, 0, 0);
    check('degenerate: no NaN', Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.zoom));
  }

  // --- photoRect: the gap-free invariant ----------------------------------
  {
    const cases: Array<[number, number, number, number]> = [
      [1400, 1050, 600, 800],  // landscape into portrait
      [1050, 1400, 800, 600],  // portrait into landscape
      [1400, 1400, 600, 800],  // square into portrait
      [400, 1400, 600, 800],   // very tall panorama
      [1400, 300, 600, 800],   // very wide panorama
    ];
    for (const [iw, ih, bw, bh] of cases) {
      for (const zoom of [1, 1.7, 4]) {
        for (const [x, y] of [[0, 0], [9, 9], [-9, -9], [0.2, -0.3]]) {
          const r = photoRect(iw, ih, bw, bh, { x, y, zoom });
          const covers = r.x <= 1e-9 && r.y <= 1e-9 && r.x + r.width >= bw - 1e-9 && r.y + r.height >= bh - 1e-9;
          check(
            `photoRect covers ${iw}x${ih} in ${bw}x${bh} @${zoom} (${x},${y})`,
            covers,
            JSON.stringify(r),
          );
        }
      }
    }
  }

  // --- biasTransform ------------------------------------------------------
  {
    // Landscape into a portrait window: no vertical slack, so the bias has to
    // give up rather than open a gap.
    const t = biasTransform(1400, 1050, 600, 800);
    check('bias: cannot open a gap', t.y === 0, JSON.stringify(t));
    // Portrait into a landscape window: plenty of slack, bias moves the image
    // down (positive y) so the upper third lands near the middle.
    const u = biasTransform(1050, 1400, 800, 600);
    check('bias: portrait in landscape box biases toward the top', u.y > 0, JSON.stringify(u));
    const r = photoRect(1050, 1400, 800, 600, u);
    check('bias: still gap-free', r.y <= 1e-9 && r.y + r.height >= 600 - 1e-9, JSON.stringify(r));
  }

  return { passed, failed: failures.length, failures };
}
