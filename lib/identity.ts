import { EVENT } from './brand';
import type { BuilderInput, Identity, Stat } from './types';

/*
 * Everything on the card that isn't the photo or the two typed fields is
 * derived here, deterministically, from `handle|stack`. Same input always
 * produces the same card — refreshing never silently rerolls someone's identity.
 *
 * Two of the four stats are literally computed from what the user typed rather
 * than pulled from the hash. That's deliberate: the card should not invent
 * claims about a person it knows nothing about.
 */

/** xmur3 — small, fast, well-distributed string hash. Returns a 32-bit stream. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** A stable stream of 32-bit values for the seed, indexable by position. */
function stream(seed: string, count = 16): number[] {
  const next = xmur3(seed);
  return Array.from({ length: count }, () => next());
}

const pick = <T,>(arr: readonly T[], n: number): T => arr[n % arr.length];

export function seedOf(input: Pick<BuilderInput, 'handle' | 'stack'>): string {
  return `${input.handle.trim().toLowerCase()}|${input.stack.trim().toLowerCase()}`;
}

/** Split a stack string on the separators people actually type. */
export function stackTokens(stack: string): string[] {
  return stack
    .split(/[·,/|+&]|\s+and\s+/gi)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------- title

const MODIFIERS = [
  'MIDNIGHT', 'MONSOON', 'BAREFOOT', 'UNDOCUMENTED', 'COLD-BREW', 'RELENTLESS',
  'UNSHAKEABLE', 'LAST-CALL', 'OFFLINE', 'RECURSIVE', 'SILENT', 'SALTWATER',
  'THREE-AM', 'IDEMPOTENT', 'BAREMETAL', 'LOW-LATENCY', 'PATIENT', 'FERAL',
  'NOCTURNAL', 'UNBLOCKED', 'HAND-ROLLED', 'DEEP-WATER', 'STUBBORN', 'QUIET',
] as const;

/** Noun pools, routed by what the builder says they work on. */
const NOUN_POOLS: { test: RegExp; nouns: readonly string[] }[] = [
  {
    test: /zk|crypto|proof|circuit|solidity|chain|contract|wallet/i,
    nouns: ['PROVER', 'LOCKSMITH', 'ORACLE', 'CIPHER', 'WITNESS', 'NOTARY'],
  },
  {
    test: /rust|zig|kernel|systems|compiler|embedded|c\+\+|assembly|linker/i,
    nouns: ['COMPILER', 'FOUNDRY', 'ALLOCATOR', 'KERNEL', 'MACHINIST', 'SMELTER'],
  },
  {
    test: /infra|devops|k8s|kubernetes|cloud|sre|platform|distributed|network/i,
    nouns: ['LIGHTHOUSE', 'DISPATCHER', 'PACKETSMITH', 'HARBOURMASTER', 'SIGNALMAN'],
  },
  {
    test: /ml|ai|model|llm|vision|torch|nlp|inference|agent/i,
    nouns: ['CARTOGRAPHER', 'DIVINER', 'TAMER', 'ARCHIVIST', 'ORACLE'],
  },
  {
    test: /design|ui|ux|front|css|motion|brand|type/i,
    nouns: ['DRAUGHTSMAN', 'COMPOSITOR', 'GLASSBLOWER', 'SIGNWRITER', 'PRINTER'],
  },
  {
    test: /data|sql|etl|analytics|pipeline|warehouse/i,
    nouns: ['SURVEYOR', 'DOWSER', 'TIDEKEEPER', 'LEDGERMAN'],
  },
];

const DEFAULT_NOUNS = [
  'ARCHITECT', 'DAEMON', 'NAVIGATOR', 'SHIPWRIGHT', 'CARTOGRAPHER',
  'LANTERN', 'TIDEKEEPER', 'BOATBUILDER',
] as const;

export function generateTitle(input: Pick<BuilderInput, 'handle' | 'stack'>, salt = 0): string {
  const s = stream(seedOf(input) + (salt ? `#${salt}` : ''));
  const pool = NOUN_POOLS.find((p) => p.test.test(input.stack))?.nouns ?? DEFAULT_NOUNS;
  return `THE ${pick(MODIFIERS, s[1])} ${pick(pool, s[2])}`;
}

/** Break the title so the last word gets its own line — the poster-billing look. */
export function splitTitle(title: string): [string, string] {
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return [words[0] ?? '', words.slice(1).join(' ')];
  return [words.slice(0, -1).join(' '), words[words.length - 1]];
}

// ---------------------------------------------------------------- stats

function shipWindow(s: number[]): [number, number] {
  const start = s[5] % 24;
  const span = 4 + (s[6] % 3);
  return [start, (start + span) % 24];
}

export function buildStats(input: Pick<BuilderInput, 'handle' | 'stack'>): Stat[] {
  const s = stream(seedOf(input));
  const tokens = stackTokens(input.stack);

  // Derived: a true count of what they typed.
  const depth = Math.max(1, tokens.length);

  // Derived: unique characters over total. Verifiable by hand, and charming.
  const raw = (input.handle + input.stack).replace(/\s/g, '').toLowerCase();
  const entropy = raw.length ? new Set(raw).size / raw.length : 0;

  // Assigned: a flourish on the brand line, never below 5:1.
  const signal = 5 + (s[3] % 15);

  const [from, to] = shipWindow(s);
  const pad = (n: number) => String(n).padStart(2, '0');

  return [
    {
      label: 'SIGNAL / NOISE',
      value: `${signal}:1`,
      fill: Math.min(1, signal / 20),
      kind: 'assigned',
      meter: 'bar',
    },
    {
      label: 'STACK DEPTH',
      value: pad(depth),
      unit: 'LYR',
      fill: Math.min(1, depth / 6),
      kind: 'derived',
      meter: 'bar',
    },
    {
      label: 'NAME ENTROPY',
      value: entropy.toFixed(2),
      fill: Math.min(1, entropy),
      kind: 'derived',
      meter: 'bar',
    },
    {
      label: 'SHIP WINDOW',
      value: `${pad(from)}–${pad(to)}`,
      unit: 'IST',
      fill: 1,
      kind: 'assigned',
      meter: 'daystrip',
      window: [from, to],
    },
  ];
}

// ---------------------------------------------------------------- tier

/**
 * Rarity, printed in the pass's CLASS field. The pull rate is deliberately
 * never printed on the card — knowing you're a 40% roll deflates the object.
 */
const TIERS = [
  { code: 'BLDR', label: 'BUILDER', upto: 400 },
  { code: 'FOIL', label: 'FOIL', upto: 700 },
  { code: 'PRSM', label: 'PRISM', upto: 880 },
  { code: 'MNSN', label: 'MONSOON', upto: 970 },
  { code: 'GLDN', label: 'GOLDEN HOUR', upto: 995 },
  { code: '247M', label: '247 MYTHIC', upto: 1000 },
] as const;

function tierOf(s: number[]) {
  const roll = s[7] % 1000;
  const t = TIERS.find((x) => roll < x.upto) ?? TIERS[0];
  return { code: t.code, label: t.label };
}

// ---------------------------------------------------------------- MRZ

const mrzSafe = (v: string, len: number) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '<')
    .slice(0, len)
    .padEnd(len, '<');

function buildMrz(handle: string, title: string, stack: string, serial: number): [string, string] {
  const line1 = mrzSafe(`PHH<IND<${handle.replace(/^@/, '')}<<${title.replace(/\s/g, '<')}`, 44);
  const line2 = mrzSafe(
    `B${String(serial).padStart(7, '0')}2026IND<<${stackTokens(stack).join('<')}`,
    44,
  );
  return [line1, line2];
}

// ---------------------------------------------------------------- assemble

export function buildIdentity(input: BuilderInput): Identity {
  const seed = seedOf(input);
  const s = stream(seed);

  const title = input.titleOverride?.trim() || generateTitle(input);
  const serial = 1 + (s[0] % EVENT.cohort);
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  const address = `0x${hex(s[8]).slice(0, 4)}${hex(s[9]).slice(0, 2)}…${hex(s[10]).slice(0, 4)}`;

  return {
    seed,
    title,
    titleLines: splitTitle(title),
    stats: buildStats(input),
    serial,
    tier: tierOf(s),
    gate: `G-${String(s[11] % 24).padStart(2, '0')}`,
    seat: `${1 + (s[12] % 40)}${'ABCDEF'[s[13] % 6]}`,
    boardingDay: s[14] % 4,
    address,
    block: `#${(19_000_000 + (s[4] % 900_000)).toLocaleString('en-US')}`,
    seq: String(1000 + (s[15] % 9000)),
    mrz: buildMrz(input.handle, title, input.stack, serial),
  };
}
