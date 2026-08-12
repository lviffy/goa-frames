/**
 * HH Goa 2026 brand tokens.
 * Values are lifted verbatim from the live site's stylesheet
 * (hhgoa.com/_next/static/chunks/2gpdh40r3s9bj.css) — do not "improve" them.
 */

export const BRAND = {
  green: '#0B6839',
  deepGreen: '#053F21',
  inkGreen: '#032A16',
  yellow: '#FEE101',
  yellowAlt: '#F9DC01',
  pink: '#FF0080',
  cream: '#FFFBE8',
  white: '#FFFFFF',
  black: '#0A0A0A',
} as const;

export const EVENT = {
  name: 'HACKER HOUSE',
  place: 'GOA, INDIA',
  dates: '28–31 OCT 2026',
  window: 'GOA, INDIA · 28–31 OCT 2026',
  tagline: 'LESS NOISE. MORE SIGNAL.',
  studio: '2:47 pm STUDIO',
  hashtag: '#FrameInGoa',
  cohort: 10000,
  /** The four days, used for the boarding-sequence block. */
  days: ['GENESIS', 'TRIANGLE', 'BUILD', 'LAUNCH'] as const,
} as const;

/** Card is authored at 2x and exported at 1080x1350 (4:5, X's tallest in-feed ratio). */
export const CARD = { w: 1080, h: 1350 } as const;

/** Link-preview images are 1.91:1 — a 4:5 card center-cropped into that is a disaster. */
export const OG = { w: 1200, h: 630 } as const;

/**
 * Ink colourways. Tapping through these is the "render it again" hook —
 * unlike a rarity roll it never claims anything untrue about the builder.
 */
export type ColorwayId = 'monsoon' | 'lowtide' | 'midnight';

export type Colorway = {
  id: ColorwayId;
  label: string;
  /** Header band + stub. */
  ink: string;
  /** Ticket stock. */
  stock: string;
  /** Display type on the stock. */
  display: string;
  /** Type on the ink band. */
  onInk: string;
  /** Accent — stamps, meters, misregistration ghost. */
  accent: string;
  /** Duotone shadow / highlight for the portrait. */
  duoDark: string;
  duoLight: string;
};

export const COLORWAYS: Colorway[] = [
  {
    id: 'monsoon',
    label: 'INK №1 · MONSOON GREEN',
    ink: BRAND.green,
    stock: BRAND.cream,
    display: BRAND.green,
    onInk: BRAND.cream,
    accent: BRAND.pink,
    duoDark: '#04351B',
    duoLight: BRAND.cream,
  },
  {
    id: 'lowtide',
    label: 'INK №2 · LOW TIDE',
    ink: '#0E2A47',
    stock: BRAND.cream,
    display: '#0E2A47',
    onInk: BRAND.cream,
    accent: '#FF5C1A',
    duoDark: '#0A1E33',
    duoLight: BRAND.cream,
  },
  {
    id: 'midnight',
    label: 'INK №3 · MIDNIGHT GOLD',
    ink: '#141210',
    stock: '#F2E4C2',
    display: '#141210',
    onInk: BRAND.yellow,
    accent: BRAND.yellow,
    duoDark: '#1A1712',
    duoLight: '#F2E4C2',
  },
];

export const DEFAULT_COLORWAY: ColorwayId = 'monsoon';

export function colorway(id: ColorwayId): Colorway {
  return COLORWAYS.find((c) => c.id === id) ?? COLORWAYS[0];
}
