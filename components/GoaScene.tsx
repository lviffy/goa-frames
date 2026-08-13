/**
 * The stage backdrop: a four-colour silkscreen of a Goa sunrise, built from the
 * brand palette in SVG rather than shipped as a PNG.
 *
 * Two compositions, swapped with CSS at the `sm` breakpoint rather than by
 * measuring the window — a `slice` fit on a 1600-wide scene crops the palms
 * clean off a 390px phone, so the phone gets its own arrangement of the same
 * parts. Both are static; nothing here re-renders.
 */

/**
 * Trig results are rounded before they reach an attribute. `Math.cos`/`Math.sin`
 * are implementation-defined to the last ULP, so Node and Chrome disagree in the
 * 17th digit and React reports a hydration mismatch on every single load.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

const CREAM = '#FFFBE8';
const YELLOW = '#FEE101';
const PINK = '#FF0080';

type PalmProps = {
  /** Base of the trunk. */
  x: number;
  y: number;
  scale: number;
  /** Negative flips the palm to lean the other way. */
  flip?: boolean;
  opacity?: number;
  /** Stroke weight before scaling; thinner palms read as further away. */
  weight?: number;
};

/* One frond, pointing along +x from the crown and drooping at the tip. */
const FROND =
  'M0 0 C 34 -24 82 -22 126 4 C 118 12 108 15 98 13 C 70 5 34 4 0 8 Z';

function Palm({ x, y, scale, flip = false, opacity = 1, weight = 7 }: PalmProps) {
  const angles = [-168, -128, -88, -46, -6, 34];
  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}
      opacity={opacity}
      stroke={CREAM}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {/* Trunk, with the ring ticks every coconut palm has. */}
      <path d="M0 0 C -6 -96 4 -196 46 -276" strokeWidth={weight + 2} />
      <path d="M-9 -40 L 7 -42 M-8 -96 L 9 -99 M-1 -150 L 16 -155 M12 -204 L 28 -211" strokeWidth={weight - 3} opacity={0.75} />
      {/* Coconuts under the crown. */}
      <circle cx={38} cy={-268} r={9} fill={CREAM} stroke="none" />
      <circle cx={56} cy={-262} r={7} fill={CREAM} stroke="none" />
      <g transform="translate(46 -276)">
        {angles.map((a) => (
          <path key={a} d={FROND} transform={`rotate(${a})`} fill="#04351B" fillOpacity={0.55} />
        ))}
      </g>
    </g>
  );
}

function Sun({ x, y, r }: { x: number; y: number; r: number }) {
  const rays = [-84, -66, -48, -30, -12, 12, 30, 48, 66, 84];
  return (
    <g>
      {/* Misregistration ghost — the give-away of a real screen print. */}
      <circle cx={x + 7} cy={y - 5} r={r} fill={PINK} opacity={0.5} />
      <circle cx={x} cy={y} r={r} fill={YELLOW} />
      <g stroke={YELLOW} strokeWidth={5} strokeLinecap="round">
        {rays.map((a, i) => {
          const rad = ((a - 90) * Math.PI) / 180;
          const inner = r + 26 + (i % 3) * 10;
          const outer = inner + (i % 2 ? 46 : 78);
          return (
            <line
              key={a}
              x1={r2(x + Math.cos(rad) * inner)}
              y1={r2(y + Math.sin(rad) * inner)}
              x2={r2(x + Math.cos(rad) * outer)}
              y2={r2(y + Math.sin(rad) * outer)}
            />
          );
        })}
        {/* The two flat rays that skim the waterline. */}
        <line x1={x - r - 100} y1={y - 4} x2={x - r - 30} y2={y - 4} />
        <line x1={x + r + 30} y1={y - 4} x2={x + r + 100} y2={y - 4} />
      </g>
    </g>
  );
}

/** The sun's broken reflection on the water. */
function Reflection({ x, y, w }: { x: number; y: number; w: number }) {
  const bands = [
    [10, 0.9, 1],
    [34, 0.72, 0.9],
    [62, 0.5, 0.85],
    [92, 0.86, 0.7],
    [124, 0.34, 0.6],
    [158, 0.62, 0.5],
    [196, 0.24, 0.36],
  ] as const;
  return (
    <g fill={YELLOW}>
      {bands.map(([dy, width, alpha]) => (
        <rect
          key={dy}
          x={x - (w * width) / 2}
          y={y + dy}
          width={w * width}
          height={dy > 100 ? 9 : 13}
          rx={6}
          opacity={alpha}
        />
      ))}
    </g>
  );
}

function Sea({
  top,
  bottom,
  left,
  right,
  id,
}: {
  top: number;
  bottom: number;
  left: number;
  right: number;
  id: string;
}) {
  const w = right - left;
  const lines = [40, 78, 120, 168, 224];
  return (
    <g>
      <rect x={left} y={top} width={w} height={bottom - top} fill={`url(#sea-${id})`} />
      <g stroke={CREAM} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.42}>
        {lines.map((dy, i) => {
          const y = top + dy;
          const seg = 90 + i * 22;
          return (
            <g key={dy}>
              <path d={`M${left + 40 + i * 30} ${y} q ${seg / 2} -9 ${seg} 0`} />
              <path d={`M${right - 150 - i * 26} ${y + 12} q ${seg / 2} -9 ${seg} 0`} />
            </g>
          );
        })}
      </g>
    </g>
  );
}

/* Both compositions live in one document, so the ids have to be namespaced. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#02150B" />
        <stop offset="46%" stopColor="#063A20" />
        <stop offset="100%" stopColor="#0B6839" />
      </linearGradient>
      <linearGradient id={`sea-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0C7440" />
        <stop offset="100%" stopColor="#043D22" />
      </linearGradient>
      <filter id={`grain-${id}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
  );
}

/*
 * Both viewBoxes are cut to roughly the aspect they'll be shown at, because
 * `slice` crops the overflowing axis and whatever sits there is simply gone.
 * The pass is centred on top of this, so nothing that has to be seen — the sun,
 * the palm crowns — is allowed to sit in the middle third.
 */
function Wide() {
  return (
    <svg
      className="hidden h-full w-full sm:block"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <Defs id="w" />
      <rect width="1600" height="1000" fill="url(#sky-w)" />
      {/* Off-centre, so it clears the pass instead of being hidden behind it. */}
      <Sun x={1252} y={470} r={104} />
      {/* Headland, far side of the bay. */}
      <path d="M0 566 q 120 -46 250 -8 q 90 26 190 8 L440 566 Z" fill="#0E7B45" opacity={0.9} />
      <path d="M1180 566 q 130 -54 250 -14 q 90 28 170 14 L1600 566 Z" fill="#0E7B45" opacity={0.9} />
      <Sea top={566} bottom={1000} left={0} right={1600} id="w" />
      <Reflection x={1252} y={574} w={186} />
      <Palm x={126} y={1030} scale={1.32} weight={8} />
      <Palm x={1512} y={1010} scale={1.24} flip weight={8} />
      <Palm x={330} y={986} scale={0.86} opacity={0.5} weight={7} />
      <Palm x={1318} y={996} scale={0.8} flip opacity={0.45} weight={7} />
      <rect width="1600" height="1000" filter="url(#grain-w)" opacity={0.16} style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

function Narrow() {
  return (
    <svg
      className="h-full w-full sm:hidden"
      viewBox="0 0 460 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <Defs id="n" />
      <rect width="460" height="1000" fill="url(#sky-n)" />
      {/* Off-centre here too. Dead centre it sits directly behind the upload
          plate, and the glass is translucent enough that yellow bleeding
          through drops the kicker below a readable contrast. */}
      <Sun x={344} y={246} r={82} />
      <path d="M0 372 q 70 -30 140 -5 q 40 14 70 5 L210 372 Z" fill="#0E7B45" opacity={0.9} />
      <path d="M322 372 q 62 -32 116 -6 L460 372 Z" fill="#0E7B45" opacity={0.9} />
      <Sea top={372} bottom={1000} left={0} right={460} id="n" />
      <Reflection x={344} y={380} w={146} />
      <Palm x={52} y={1000} scale={1.12} weight={8} />
      <Palm x={430} y={968} scale={1.02} flip weight={8} />
      <rect width="460" height="1000" filter="url(#grain-n)" opacity={0.16} style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

export default function GoaScene() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-[#02150B]" aria-hidden="true">
      <Wide />
      <Narrow />
      {/* Scrim: lifts the top-bar type off the sky and sinks the dock into the water. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_75%_at_50%_42%,transparent_38%,rgba(2,21,11,0.55)_100%)]" />
    </div>
  );
}
