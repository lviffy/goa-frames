import type { ColorwayId } from './brand';

/** How the source photo is framed inside the card's photo window. */
export type PhotoTransform = {
  /** Pan, in fractions of the *window* size. 0,0 = the default framing. */
  x: number;
  y: number;
  /** Multiplier on the cover-fit scale. 1 = exactly cover. */
  zoom: number;
};

export const DEFAULT_TRANSFORM: PhotoTransform = { x: 0, y: 0, zoom: 1 };

export type Photo = {
  /** Decoded, EXIF-corrected, downscaled source, as a data URI (image/jpeg). */
  dataUrl: string;
  width: number;
  height: number;
  transform: PhotoTransform;
};

/** Everything the user actually types or chooses. */
export type BuilderInput = {
  handle: string;
  stack: string;
  colorway: ColorwayId;
  /** Set only when the user re-rolls or edits the generated title. */
  titleOverride?: string;
};

export type Stat = {
  label: string;
  value: string;
  /** Small unit printed after the value, e.g. "LYR", "IST". */
  unit?: string;
  /** 0..1, drives the meter under the value. */
  fill: number;
  /**
   * `derived` = literally computed from what the user typed (honest).
   * `assigned` = drawn from the seed, like a house or a gate number.
   */
  kind: 'derived' | 'assigned';
  /** Rendered as a 24-block day strip rather than a bar. */
  meter?: 'bar' | 'daystrip';
  /** For daystrip: [startHour, endHour) in IST, may wrap midnight. */
  window?: [number, number];
};

/** Everything generated from the input. Pure function of BuilderInput. */
export type Identity = {
  seed: string;
  title: string;
  titleLines: [string, string];
  stats: Stat[];
  serial: number;
  /** Rarity, printed in the CLASS field. Never printed with its pull rate. */
  tier: { code: string; label: string };
  gate: string;
  seat: string;
  boardingDay: number;
  address: string;
  block: string;
  seq: string;
  mrz: [string, string];
};

export type CardData = {
  input: BuilderInput;
  identity: Identity;
  photo: Photo | null;
};

/** Options for the SVG renderer. */
export type RenderOptions = {
  /** Omit the photo and use a placeholder plate. Used before upload. */
  placeholder?: boolean;
  /** Embed base64 fonts. Required for rasterisation; skip for live DOM preview. */
  embedFonts?: boolean;
};
