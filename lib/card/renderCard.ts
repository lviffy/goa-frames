import { CARD, EVENT, colorway } from '../brand';
import type { CardData, RenderOptions } from '../types';
import { fontCss } from './fonts';
import { esc } from './util';

/**
 * The single source of truth for what a pass looks like.
 *
 * Returns a standalone SVG string with no <foreignObject> anywhere. That
 * constraint is the whole point: a pure-SVG document rasterises identically
 * through `ctx.drawImage()` in every browser, including iOS Safari, where
 * foreignObject rasterisation is unreliable. The same string drives the live
 * preview, the PNG download and the share image.
 *
 * NOTE: this is the integration skeleton. The full pass artwork — header band,
 * marquee, data page, MRZ, tear-off stub, illustration — is built out in
 * ./sections. Keep the signature stable; everything else imports through here.
 */
export function renderCard(data: CardData, opts: RenderOptions = {}): string {
  const cw = colorway(data.input.colorway);
  const { w, h } = CARD;

  const fonts = opts.embedFonts ? `<style>${fontCss()}</style>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Victor Mono">
${fonts}
<rect width="${w}" height="${h}" fill="${cw.stock}"/>
<text x="60" y="120" font-family="Imbue" font-size="96" font-weight="700" fill="${cw.display}">${esc(EVENT.name)}</text>
<text x="60" y="180" font-size="24" fill="${cw.display}">${esc(data.identity.title)}</text>
</svg>`;
}

/** Convenience for the preview: the SVG as a data URI. */
export function cardDataUri(data: CardData, opts: RenderOptions = {}): string {
  const svg = renderCard(data, opts);
  // encodeURIComponent (not btoa) — the SVG carries arbitrary Unicode from user input.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
