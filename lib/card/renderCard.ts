import { CARD, EVENT, colorway, type Colorway } from '../brand';
import { photoRect } from '../photo';
import type { CardData, RenderOptions } from '../types';
import { fontCss } from './fonts';
import { goaMark } from './goa';
import {
  capOf,
  ellipsize,
  esc,
  familyOf,
  fitSize,
  measure,
  n2,
  trackTo,
  weightOf,
  wrapText,
  type Face,
} from './util';

/**
 * BOARDING PASS No. 247 — the single source of truth for what a pass looks like.
 *
 * Returns a standalone SVG string with no <foreignObject> anywhere. That
 * constraint is the whole point: a pure-SVG document rasterises identically
 * through `ctx.drawImage()` in every browser, including iOS Safari, where
 * foreignObject rasterisation is unreliable. The same string drives the live
 * preview, the PNG download and the share image — there is no second renderer
 * to drift out of sync.
 *
 * Everything is arithmetic against measured font metrics (./metrics) because
 * SVG has no text wrapping and no off-DOM measurement API.
 */

// ---------------------------------------------------------------------------
// Geometry — all in card units (1080 x 1350)
// ---------------------------------------------------------------------------

const W = CARD.w;
const H = CARD.h;
/** Outer margin. Everything on the stock hangs off this. */
const M = 52;
/** Working width between the margins. */
const CW_ = W - M * 2;

const HEADER_H = 164;
const MARQUEE = { y: HEADER_H, h: 30 } as const;

/** The portrait window. Arched top — the Goan doorway, not a passport box. */
export const PHOTO_WINDOW = { x: M, y: 226, w: 608, h: 640 } as const;
const ARCH_R = 190;

/** The data column beside the portrait. */
const COL = { x: 692, y: PHOTO_WINDOW.y, w: W - M - 692, h: PHOTO_WINDOW.h } as const;

const TITLE_TOP = 898;
const RULE_Y = 1092;
const STATS_Y = 1112;
const PERF_Y = 1214;

/**
 * Where the sun sits behind the head. Sized so its rays clear the panel edges —
 * a disc much wider than this loses them off the sides and the ring stops
 * reading as a sun and starts reading as a crosshair over someone's face.
 */
const SUN = {
  cx: PHOTO_WINDOW.x + PHOTO_WINDOW.w / 2,
  cy: PHOTO_WINDOW.y + PHOTO_WINDOW.h * 0.38,
  r: 216,
} as const;

// ---------------------------------------------------------------------------
// Small SVG helpers
// ---------------------------------------------------------------------------

type TextOpts = {
  x: number;
  y: number;
  face: Face;
  size: number;
  fill: string;
  tracking?: number;
  anchor?: 'start' | 'middle' | 'end';
  opacity?: number;
};

function text(content: string, o: TextOpts): string {
  const a: string[] = [
    `x="${n2(o.x)}"`,
    `y="${n2(o.y)}"`,
    `font-family="${familyOf(o.face)}"`,
    `font-weight="${weightOf(o.face)}"`,
    `font-size="${n2(o.size)}"`,
    `fill="${o.fill}"`,
  ];
  if (o.tracking) a.push(`letter-spacing="${n2(o.tracking)}"`);
  if (o.anchor && o.anchor !== 'start') a.push(`text-anchor="${o.anchor}"`);
  if (o.opacity !== undefined && o.opacity < 1) a.push(`fill-opacity="${n2(o.opacity)}"`);
  return `<text ${a.join(' ')}>${esc(content)}</text>`;
}

/** The recurring small-caps field label. Every block on the card starts with one. */
function label(x: number, y: number, s: string, fill: string, anchor?: TextOpts['anchor']): string {
  return text(s.toUpperCase(), {
    x,
    y,
    face: 'mono400',
    size: 13,
    fill,
    tracking: 2.8,
    anchor,
    opacity: 0.62,
  });
}

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  opacity?: number,
): string {
  const op = opacity !== undefined && opacity < 1 ? ` fill-opacity="${n2(opacity)}"` : '';
  return `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" fill="${fill}"${op}/>`;
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width = 2,
  opacity = 1,
  dash?: string,
): string {
  const d = dash ? ` stroke-dasharray="${dash}"` : '';
  const op = opacity < 1 ? ` stroke-opacity="${n2(opacity)}"` : '';
  return `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="${stroke}" stroke-width="${n2(width)}"${op}${d}/>`;
}

/** #rrggbb -> "r g b" in 0..1, for feComponentTransfer table values. */
function rgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Registration cross — the printer's alignment mark. Pure decoration, pure truth. */
function regMark(cx: number, cy: number, stroke: string, size = 13, opacity = 0.4): string {
  return `<g stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="1.5">
<line x1="${n2(cx - size)}" y1="${n2(cy)}" x2="${n2(cx + size)}" y2="${n2(cy)}"/>
<line x1="${n2(cx)}" y1="${n2(cy - size)}" x2="${n2(cx)}" y2="${n2(cy + size)}"/>
<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(size * 0.45)}" fill="none"/>
</g>`;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** Ink band: the wordmark, and the marque the whole design is named after. */
function header(cw: Colorway): string {
  const ticks: string[] = [];
  for (let x = M; x < W - M; x += 16) {
    ticks.push(line(x, HEADER_H - 14, x, HEADER_H - 8, cw.onInk, 1, 0.3));
  }

  return `<g>
${rect(0, 0, W, HEADER_H, cw.ink)}
${rect(0, 0, W, 7, cw.accent)}
${text('BOARDING PASS', { x: M, y: 58, face: 'mono400', size: 18, fill: cw.onInk, tracking: 5.6, opacity: 0.72 })}
${text('HH GOA · 2026', { x: W - M, y: 58, face: 'mono400', size: 16, fill: cw.onInk, tracking: 4, anchor: 'end', opacity: 0.72 })}
${text(EVENT.name, { x: M, y: 138, face: 'imbue700', size: 98, fill: cw.onInk })}
${text('No. 247', { x: W - M, y: 138, face: 'imbue700', size: 64, fill: cw.accent, anchor: 'end' })}
${ticks.join('')}
</g>`;
}

/** The tagline strip. Runs off both edges, so it reads as a printed roll. */
function marquee(cw: Colorway): string {
  const unit = `${EVENT.tagline}   ·   ${EVENT.hashtag}   ·   ${EVENT.studio}   ·   `;
  const size = 15;
  const tracking = 2.4;
  const unitW = measure(unit, 'mono700', tracking) * size;
  const reps = Math.ceil((W + 200) / Math.max(1, unitW)) + 1;

  return `<g>
${rect(0, MARQUEE.y, W, MARQUEE.h, cw.ink)}
${line(0, MARQUEE.y + 0.5, W, MARQUEE.y + 0.5, cw.accent, 1, 0.45)}
<svg x="0" y="${MARQUEE.y}" width="${W}" height="${MARQUEE.h}">
${text(unit.repeat(reps), { x: -80, y: 20, face: 'mono700', size, fill: cw.accent, tracking })}
</svg>
${line(0, MARQUEE.y + MARQUEE.h - 0.5, W, MARQUEE.y + MARQUEE.h - 0.5, cw.accent, 1, 0.45)}
</g>`;
}

/** The arched portrait window, as a path. */
function archPath(): string {
  const { x, y, w, h } = PHOTO_WINDOW;
  const r = Math.min(ARCH_R, w / 2);
  return `M${n2(x)} ${n2(y + h)} L${n2(x)} ${n2(y + r)} A${n2(r)} ${n2(r)} 0 0 1 ${n2(x + r)} ${n2(y)} L${n2(x + w - r)} ${n2(y)} A${n2(r)} ${n2(r)} 0 0 1 ${n2(x + w)} ${n2(y + r)} L${n2(x + w)} ${n2(y + h)} Z`;
}

/** The entry stamp: the event's own Devanagari wordmark, struck over the edge. */
function entryStamp(cw: Colorway): string {
  const cx = 596;
  const cy = 806;
  const r = 88;
  return `<g transform="rotate(-11 ${cx} ${cy})" opacity="0.94">
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cw.accent}" stroke-width="4.5"/>
<circle cx="${cx}" cy="${cy}" r="${r - 11}" fill="none" stroke="${cw.accent}" stroke-width="1.5" stroke-dasharray="5 5"/>
${text('ENTRY', { x: cx, y: cy - 56, face: 'mono700', size: 13, fill: cw.accent, tracking: 3, anchor: 'middle' })}
${goaMark(cx, cy - 2, 72, cw.accent, 1.1)}
${text('28.10.26', { x: cx, y: cy + 58, face: 'mono700', size: 13, fill: cw.accent, tracking: 1.6, anchor: 'middle' })}
</g>`;
}

/**
 * The portrait.
 *
 * Layered, not filtered-in-place: the untouched photo sits underneath and an
 * inked duotone copy sits over it at 45%, masked so the sun disc stays clear.
 * Skin still reads as skin — every concept that duotoned the whole frame turned
 * faces green, and the face is the one part of this card that is actually the
 * builder's. If a rasteriser drops the SVG filter, the top layer renders as an
 * unfiltered copy of the layer beneath it and the card is merely flatter.
 */
function portrait(data: CardData, cw: Colorway, placeholder: boolean): string {
  const { x, y, w, h } = PHOTO_WINDOW;
  const arch = archPath();

  const rays: string[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const r0 = SUN.r + 14;
    const r1 = SUN.r + (i % 4 === 0 ? 40 : 24);
    rays.push(
      line(
        SUN.cx + Math.cos(a) * r0,
        SUN.cy + Math.sin(a) * r0,
        SUN.cx + Math.cos(a) * r1,
        SUN.cy + Math.sin(a) * r1,
        cw.accent,
        3,
        0.75,
      ),
    );
  }

  let photoLayers: string;
  if (data.photo && !placeholder) {
    const r = photoRect(data.photo.width, data.photo.height, w, h, data.photo.transform);
    const href = esc(data.photo.dataUrl);
    const img = (extra: string) =>
      `<image x="${n2(x + r.x)}" y="${n2(y + r.y)}" width="${n2(r.width)}" height="${n2(r.height)}" preserveAspectRatio="none" href="${href}" xlink:href="${href}"${extra}/>`;
    photoLayers = `${img('')}${img(` filter="url(#duo)" opacity="0.45" mask="url(#sunmask)"`)}`;
  } else {
    photoLayers = `${rect(x, y, w, h, cw.stock)}
<circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r}" fill="${cw.accent}" fill-opacity="0.16"/>
${text('ADD YOUR PHOTO', { x: SUN.cx, y: SUN.cy + 6, face: 'mono700', size: 22, fill: cw.display, tracking: 3, anchor: 'middle', opacity: 0.6 })}`;
  }

  return `<g>
<path d="${arch}" fill="${cw.ink}"/>
<g clip-path="url(#archclip)">
${photoLayers}
<circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r}" fill="none" stroke="${cw.accent}" stroke-width="2.5" stroke-opacity="0.5"/>
${rays.join('')}
</g>
<path d="${arch}" fill="none" stroke="${cw.display}" stroke-width="3"/>
${entryStamp(cw)}
</g>`;
}

/** The data column: the fields a pass actually carries. */
function column(data: CardData, cw: Colorway): string {
  const { identity, input } = data;
  const ink = cw.display;
  const out: string[] = [];
  let cy = COL.y;
  const push = (h: number) => {
    const y = cy;
    cy += h;
    return y;
  };
  const rule = (y: number) => line(COL.x, y, COL.x + COL.w, y, ink, 1, 0.16);

  // PASSENGER
  {
    const y = push(76);
    const size = fitSize(input.handle, COL.w, 'mono700', 16, 30);
    out.push(
      label(COL.x, y + 14, 'Passenger', ink),
      text(ellipsize(input.handle, COL.w, 'mono700', size), {
        x: COL.x,
        y: y + 54,
        face: 'mono700',
        size,
        fill: ink,
      }),
      rule(y + 68),
    );
  }

  // WORKING ON
  {
    const lines = wrapText(input.stack, COL.w, 'mono400', 19, 2);
    const y = push(38 + lines.length * 26 + 18);
    out.push(label(COL.x, y + 14, 'Working on', ink));
    lines.forEach((l, i) => {
      out.push(
        text(l, { x: COL.x, y: y + 44 + i * 26, face: 'mono400', size: 19, fill: ink, opacity: 0.9 }),
      );
    });
    out.push(rule(y + 38 + lines.length * 26 + 8));
  }

  // CLASS — the rarity tier. Its pull rate is deliberately never printed.
  {
    const y = push(80);
    const size = fitSize(identity.tier.label, COL.w, 'imbue700', 26, 50);
    out.push(
      label(COL.x, y + 14, 'Class', ink),
      text(identity.tier.label, { x: COL.x, y: y + 60, face: 'imbue700', size, fill: cw.accent }),
      rule(y + 72),
    );
  }

  // GATE / SEAT
  {
    const y = push(76);
    const half = COL.w / 2;
    out.push(
      label(COL.x, y + 14, 'Gate', ink),
      label(COL.x + half, y + 14, 'Seat', ink),
      text(identity.gate, { x: COL.x, y: y + 58, face: 'imbue700', size: 42, fill: ink }),
      text(identity.seat, { x: COL.x + half, y: y + 58, face: 'imbue700', size: 42, fill: ink }),
      rule(y + 68),
    );
  }

  // SERIAL
  {
    const y = push(68);
    const serial = `${String(identity.serial).padStart(4, '0')} / ${EVENT.cohort.toLocaleString('en-US')}`;
    out.push(
      label(COL.x, y + 14, 'Serial', ink),
      text(serial, {
        x: COL.x,
        y: y + 48,
        face: 'mono700',
        size: fitSize(serial, COL.w, 'mono700', 16, 24),
        fill: ink,
      }),
      rule(y + 60),
    );
  }

  // BOARDING — the four days, with the assigned one struck through in ink.
  {
    const y = push(84);
    out.push(label(COL.x, y + 14, 'Boarding', ink));
    const gap = 7;
    const cwid = (COL.w - gap * 3) / 4;
    EVENT.days.forEach((day, i) => {
      const cxp = COL.x + i * (cwid + gap);
      const on = i === identity.boardingDay;
      out.push(
        on
          ? rect(cxp, y + 26, cwid, 34, ink)
          : `<rect x="${n2(cxp)}" y="${n2(y + 26)}" width="${n2(cwid)}" height="34" fill="none" stroke="${ink}" stroke-opacity="0.28" stroke-width="1.5"/>`,
        text(day, {
          x: cxp + cwid / 2,
          y: y + 48,
          face: on ? 'mono700' : 'mono400',
          size: 10,
          fill: on ? cw.stock : ink,
          tracking: 0.4,
          anchor: 'middle',
          opacity: on ? 1 : 0.62,
        }),
      );
    });
  }

  // ISSUED TO — the on-chain-flavoured identifiers, kept small and honest.
  {
    const y = push(76);
    out.push(
      label(COL.x, y + 14, 'Issued', ink),
      text(identity.address, { x: COL.x, y: y + 42, face: 'mono700', size: 19, fill: ink }),
      text(`BLOCK ${identity.block}`, {
        x: COL.x,
        y: y + 66,
        face: 'mono400',
        size: 14,
        fill: ink,
        opacity: 0.6,
      }),
    );
  }

  // Barcode, bottom-anchored so the column always ends flush with the portrait.
  {
    const by = COL.y + COL.h - 76;
    const src = identity.mrz[1];
    const bars: string[] = [];
    let bx = COL.x;
    for (let i = 0; bx < COL.x + COL.w - 2; i++) {
      const c = src.charCodeAt(i % src.length);
      const bw = 1.5 + (c % 4) * 1.6;
      if (i % 2 === 0) bars.push(rect(bx, by, bw, 52, ink));
      bx += bw + 1.6;
    }
    out.push(
      `<g>${bars.join('')}</g>`,
      text(`SEQ ${identity.seq}`, {
        x: COL.x,
        y: by + 72,
        face: 'mono400',
        size: 13,
        fill: ink,
        tracking: 2.4,
        opacity: 0.6,
      }),
    );
  }

  return `<g>${out.join('')}</g>`;
}

/**
 * The generated title, set as poster billing: two lines, flush left and right,
 * with the accent plate printed a hair out of register underneath. That
 * misregistration is the single cheapest thing on this card and the one that
 * makes it look screen-printed rather than exported.
 */
function title(data: CardData, cw: Colorway): string {
  const [a, b] = data.identity.titleLines;
  const sizeFor = (s: string) => (s ? fitSize(s, CW_, 'imbue700', 40, 104) : 104);
  const size = Math.min(sizeFor(a), sizeFor(b));
  const wA = measure(a, 'imbue700') * size;
  const wB = measure(b, 'imbue700') * size;
  const target = Math.max(wA, wB);

  const cap = capOf('imbue700') * size;
  const y1 = TITLE_TOP + cap;
  const y2 = y1 + size * 1.0;

  const draw = (s: string, y: number, fill: string, dx = 0, dy = 0, opacity = 1) =>
    s
      ? text(s, {
          x: M + dx,
          y: y + dy,
          face: 'imbue700',
          size,
          fill,
          tracking: trackTo(s, target, size, 'imbue700'),
          opacity,
        })
      : '';

  return `<g>
${draw(a, y1, cw.accent, 6, 6, 0.5)}${draw(b, y2, cw.accent, 6, 6, 0.5)}
${draw(a, y1, cw.display)}${draw(b, y2, cw.display)}
</g>`;
}

/** The four stats, across the foot of the data page. */
function stats(data: CardData, cw: Colorway): string {
  const ink = cw.display;
  const items = data.identity.stats;
  const gap = 22;
  const w = (CW_ - gap * (items.length - 1)) / items.length;

  return `<g>${items
    .map((s, i) => {
      const x = M + i * (w + gap);
      const size = fitSize(s.value, w - (s.unit ? 34 : 0), 'imbue700', 22, 44);
      const vw = measure(s.value, 'imbue700') * size;

      let meter: string;
      if (s.meter === 'daystrip' && s.window) {
        // 24 blocks, one an hour, lit across the shipping window. Wraps midnight.
        const [from, to] = s.window;
        const bw = (w - 23 * 2) / 24;
        const blocks: string[] = [];
        for (let hkey = 0; hkey < 24; hkey++) {
          const on = from <= to ? hkey >= from && hkey < to : hkey >= from || hkey < to;
          blocks.push(
            rect(x + hkey * (bw + 2), STATS_Y + 70, bw, 9, on ? cw.accent : ink, on ? 1 : 0.16),
          );
        }
        meter = blocks.join('');
      } else {
        meter = `${rect(x, STATS_Y + 70, w, 9, ink, 0.14)}${rect(x, STATS_Y + 70, w * Math.max(0, Math.min(1, s.fill)), 9, cw.accent)}`;
      }

      return `${label(x, STATS_Y + 13, s.label, ink)}
${text(s.value, { x, y: STATS_Y + 58, face: 'imbue700', size, fill: ink })}
${s.unit ? text(s.unit, { x: x + vw + 8, y: STATS_Y + 58, face: 'mono400', size: 14, fill: ink, opacity: 0.55 }) : ''}
${meter}`;
    })
    .join('')}</g>`;
}

/** The tear-off stub: perforation, machine-readable zone, hashtag. */
function stub(data: CardData, cw: Colorway): string {
  const [l1, l2] = data.identity.mrz;
  const size = 26;

  return `<g>
${rect(0, PERF_Y, W, H - PERF_Y, cw.ink)}
${line(0, PERF_Y, W, PERF_Y, cw.stock, 3, 1, '2 10')}
<circle cx="0" cy="${PERF_Y}" r="15" fill="${cw.stock}"/>
<circle cx="${W}" cy="${PERF_Y}" r="15" fill="${cw.stock}"/>
${text('MACHINE READABLE ZONE — DO NOT WRITE BELOW THIS LINE', { x: M, y: PERF_Y + 36, face: 'mono400', size: 12, fill: cw.onInk, tracking: 2.2, opacity: 0.5 })}
${text(l1, { x: M, y: PERF_Y + 76, face: 'mono700', size, fill: cw.onInk, opacity: 0.92 })}
${text(l2, { x: M, y: PERF_Y + 110, face: 'mono700', size, fill: cw.onInk, opacity: 0.92 })}
${text(EVENT.hashtag, { x: W - M, y: PERF_Y + 76, face: 'mono700', size: 24, fill: cw.accent, anchor: 'end' })}
${text('hhgoa.com', { x: W - M, y: PERF_Y + 110, face: 'mono400', size: 17, fill: cw.onInk, anchor: 'end', opacity: 0.6 })}
</g>`;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function renderCard(data: CardData, opts: RenderOptions = {}): string {
  const cw = colorway(data.input.colorway);
  const placeholder = !!opts.placeholder || !data.photo;

  const [dr, dg, db] = rgb01(cw.duoDark);
  const [lr, lg, lb] = rgb01(cw.duoLight);

  const fonts = opts.embedFonts ? `<style>${fontCss()}</style>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Victor Mono">
${fonts}
<defs>
<clipPath id="archclip"><path d="${archPath()}"/></clipPath>
<!--
  The duotone is masked out inside the sun so skin reads as skin. The falloff
  is a gradient rather than a hard-edged circle: a hard edge draws a crisp arc
  straight across whatever it crosses — in practice a jaw or a shoulder — and
  reads as a mistake. Ramped over the last 14% it reads as light instead.
  A gradient beats feGaussianBlur here because filters inside masks are the
  first thing a rasteriser drops.
-->
<radialGradient id="sunfall">
<stop offset="0.86" stop-color="#000"/>
<stop offset="1" stop-color="#fff"/>
</radialGradient>
<mask id="sunmask">
<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
<circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r}" fill="url(#sunfall)"/>
</mask>
<filter id="duo" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"/>
<feComponentTransfer>
<feFuncR type="table" tableValues="${n2(dr)} ${n2(lr)}"/>
<feFuncG type="table" tableValues="${n2(dg)} ${n2(lg)}"/>
<feFuncB type="table" tableValues="${n2(db)} ${n2(lb)}"/>
</feComponentTransfer>
</filter>
</defs>

<rect width="${W}" height="${H}" fill="${cw.stock}"/>

<!-- The marque, ghosted into the stock. Depth without another asset. -->
${text('247', { x: W - 24, y: 1104, face: 'imbue700', size: 400, fill: cw.display, anchor: 'end', opacity: 0.035 })}

${header(cw)}
${marquee(cw)}
${portrait(data, cw, placeholder)}
${column(data, cw)}
${line(M, RULE_Y, W - M, RULE_Y, cw.display, 2, 0.3)}
${title(data, cw)}
${stats(data, cw)}
${stub(data, cw)}

${regMark(26, HEADER_H + 62, cw.display)}
${regMark(W - 26, HEADER_H + 62, cw.display)}
${regMark(26, PERF_Y - 30, cw.display)}
${regMark(W - 26, PERF_Y - 30, cw.display)}
</svg>`;
}

/** Convenience for the preview: the SVG as a data URI. */
export function cardDataUri(data: CardData, opts: RenderOptions = {}): string {
  const svg = renderCard(data, opts);
  // encodeURIComponent (not btoa) — the SVG carries arbitrary Unicode from user input.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
