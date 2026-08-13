import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BRAND, EVENT, type ColorwayId } from '@/lib/brand';

export const revalidate = 3600;

export type StatelessPassData = {
  handle: string;
  stack: string;
  title: string;
  serial: number;
  colorway: ColorwayId;
};

export function decodePayload(raw: string): StatelessPassData | null {
  try {
    // Base64url decode with unicode support
    const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const jsonStr = decodeURIComponent(
      Buffer.from(padded, 'base64')
        .toString('utf-8')
    );
    const parsed = JSON.parse(jsonStr);

    return {
      handle: typeof parsed.h === 'string' ? parsed.h : (parsed.handle || '@builder'),
      stack: typeof parsed.s === 'string' ? parsed.s : (parsed.stack || 'Builder'),
      title: typeof parsed.t === 'string' ? parsed.t : (parsed.title || 'THE MONSOON ARCHITECT'),
      serial: typeof parsed.n === 'number' ? parsed.n : (parseInt(parsed.serial, 10) || 247),
      colorway: (parsed.c || parsed.colorway || 'monsoon') as ColorwayId,
    };
  } catch {
    return null;
  }
}

type Params = { params: Promise<{ payload: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { payload } = await params;
  const pass = decodePayload(payload);

  if (!pass) {
    return {
      title: 'Pass not found — Hacker House Goa 2026',
      description: 'This boarding pass has expired or never existed. Issue your own.',
      robots: { index: false, follow: true },
    };
  }

  const who = pass.handle?.trim() || 'A builder';
  const serial = String(pass.serial).padStart(4, '0');
  const title = `${pass.title || 'Builder'} · Boarding Pass No. ${serial}`;
  const description = `${who} is locked in for Hacker House Goa 2026. ${EVENT.window}. Issue your own pass in one pass, no signup.`;

  const ogQuery = new URLSearchParams({
    handle: pass.handle,
    stack: pass.stack,
    title: pass.title,
    serial: String(pass.serial),
    colorway: pass.colorway,
  }).toString();

  const ogUrl = `/api/og?${ogQuery}`;

  return {
    title,
    description,
    alternates: { canonical: `/c/p/${payload}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/c/p/${payload}`,
      siteName: 'Hacker House Goa 2026',
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: `${pass.title} — HH Goa 2026 builder pass`,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function StatelessSharedPassPage({ params }: Params) {
  const { payload } = await params;
  const pass = decodePayload(payload);
  if (!pass) notFound();

  const serial = String(pass.serial).padStart(4, '0');
  const line = [pass.title, pass.stack].filter(Boolean).join('  ·  ');

  const ogQuery = new URLSearchParams({
    handle: pass.handle,
    stack: pass.stack,
    title: pass.title,
    serial: String(pass.serial),
    colorway: pass.colorway,
  }).toString();

  const ogUrl = `/api/og?${ogQuery}`;

  return (
    <main style={styles.page}>
      <div style={styles.inner}>
        <p style={styles.kicker}>BOARDING PASS · No. {serial}</p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ogUrl}
          alt={`${pass.title || 'Builder'} — Hacker House Goa 2026 pass, no. ${serial}`}
          width={1200}
          height={630}
          style={styles.card}
        />

        {line ? <p style={styles.line}>{line}</p> : null}
        <p style={styles.window}>{EVENT.window}</p>

        <a href="/" style={styles.cta}>
          MAKE YOUR OWN →
        </a>
        <p style={styles.sub}>
          Upload a photo, get your pass. No signup, no wait. {EVENT.hashtag}
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: `linear-gradient(170deg, ${BRAND.green} 0%, ${BRAND.deepGreen} 60%, ${BRAND.inkGreen} 100%)`,
    color: BRAND.cream,
    display: 'flex',
    justifyContent: 'center',
    padding: '32px 20px 64px',
    fontFamily: "'Victor Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  inner: { width: '100%', maxWidth: 580, textAlign: 'center' },
  kicker: {
    fontSize: 12,
    letterSpacing: '0.24em',
    opacity: 0.7,
    margin: '0 0 16px',
  },
  card: {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: 8,
    boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
  },
  line: {
    fontSize: 13,
    letterSpacing: '0.12em',
    margin: '22px 0 4px',
    color: BRAND.yellow,
  },
  window: {
    fontSize: 12,
    letterSpacing: '0.18em',
    opacity: 0.72,
    margin: '0 0 28px',
  },
  cta: {
    display: 'block',
    background: BRAND.yellow,
    color: BRAND.inkGreen,
    textDecoration: 'none',
    padding: '18px 20px',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '0.16em',
    borderRadius: 4,
  },
  sub: { fontSize: 12, opacity: 0.66, margin: '14px 0 0', lineHeight: 1.6 },
};
