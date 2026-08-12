#!/usr/bin/env node
/**
 * Font metrics calibration.
 *
 * The SVG renderer has no measurement API, so `lib/card/util.ts` fits text with
 * an arithmetic width table. This script derives that table from the *actual*
 * woff2 files by measuring every glyph in headless Chrome and dumping the
 * result, so the table is measured rather than guessed.
 *
 *   node scripts/measure-fonts.mjs          # prints a TS-ready table
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, '.cardtmp', 'metrics');
mkdirSync(TMP, { recursive: true });

const b64 = (p) => readFileSync(join(ROOT, p)).toString('base64');
const FACE = (family, p, weight) =>
  `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64(p)}) format('woff2');}`;

const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;·—–-_/\\|()[]{}#@&%+*^~<>?!"\'`=$«»✦✓№';

const html = `<meta charset="utf-8"><style>
${FACE('Imbue', 'public/fonts/Imbue-latin.woff2', '100 900')}
${FACE('Victor Mono', 'public/fonts/VictorMono-latin.woff2', '100 900')}
</style><pre id="out">pending</pre><script>
const chars = ${JSON.stringify(CHARS)}.split('');
const c = document.createElement('canvas').getContext('2d');
function table(font) {
  c.font = font;
  const o = {};
  for (const ch of chars) o[ch] = +(c.measureText(ch).width / 100).toFixed(4);
  return o;
}
function metrics(font) {
  c.font = font;
  const m = c.measureText('HXAOgy');
  return {
    ascent: +(m.fontBoundingBoxAscent / 100).toFixed(4),
    descent: +(m.fontBoundingBoxDescent / 100).toFixed(4),
    cap: +(c.measureText('H').actualBoundingBoxAscent / 100).toFixed(4),
    xh: +(c.measureText('x').actualBoundingBoxAscent / 100).toFixed(4),
  };
}
document.fonts.ready.then(async () => {
  await document.fonts.load('100px Imbue');
  await document.fonts.load('700px Imbue');
  await document.fonts.load('100px "Victor Mono"');
  const out = {
    imbue400: table('400 100px Imbue'),
    imbue700: table('700 100px Imbue'),
    mono400: table('400 100px "Victor Mono"'),
    mono700: table('700 100px "Victor Mono"'),
    m: {
      imbue400: metrics('400 100px Imbue'),
      imbue700: metrics('700 100px Imbue'),
      mono400: metrics('400 100px "Victor Mono"'),
    },
  };
  document.getElementById('out').textContent = JSON.stringify(out);
});
</script>`;

const file = join(TMP, 'measure.html');
writeFileSync(file, html);

const dom = execFileSync(
  'google-chrome-stable',
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--virtual-time-budget=6000',
    '--dump-dom',
    `file://${file}`,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
);

const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (!m) throw new Error('no measurement output');
const data = JSON.parse(
  m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'),
);
writeFileSync(join(TMP, 'metrics.json'), JSON.stringify(data, null, 2));
console.log('vertical metrics:', JSON.stringify(data.m, null, 2));
for (const key of ['imbue400', 'imbue700', 'mono400', 'mono700']) {
  const t = data[key];
  const vals = Object.values(t);
  const uniq = new Set(vals.map((v) => v.toFixed(3)));
  console.log(key, 'distinct widths:', uniq.size, 'A=', t.A, 'M=', t.M, 'I=', t.I, 'space=', t[' ']);
}
console.log('\n// paste into lib/card/util.ts');
console.log(JSON.stringify(data.imbue400));
