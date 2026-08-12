/**
 * /c/<id> — the shared-card page.
 *
 * Its real job is the four <meta> tags at the top of the document. When someone
 * posts this link to X, X's crawler never sees the React below; it reads
 * og:image / twitter:image and renders that. So those must point at the stored
 * 1200×630 OG composition, absolute-URL'd, or the post shows a blank thumbnail
 * and the brief's share requirement is failed outright.
 *
 * Everything visible is the second job: show the card big, and put a
 * "Make your own" in front of everyone who arrives from the post.
 */

import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { head } from '@vercel/blob';
import { BRAND, EVENT } from '@/lib/brand';
import { ID_PATTERN, blobKeys, type PassMeta } from '@/app/api/publish/schema';

/**
 * ISR. X's crawler is impatient and a cached HTML response beats two blob
 * round-trips. Kept short so a card shared seconds after it was published
 * doesn't get a 404 pinned for long.
 */
export const revalidate = 60;

type Params = { params: Promise<{ id: string }> };

/**
 * There is no database: the id is the blob key prefix. `head()` resolves the
 * store's hostname for us, and the meta record carries the absolute card and OG
 * URLs so this is two round-trips, not four.
 *
 * `cache()` means generateMetadata and the page body share one lookup.
 */
const loadPass = cache(async (id: string): Promise<PassMeta | null> => {
  if (!ID_PATTERN.test(id)) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  try {
    const meta = await head(blobKeys(id).meta);
    const res = await fetch(meta.url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const parsed = (await res.json()) as Partial<PassMeta>;
    if (!parsed?.cardUrl || !parsed?.ogUrl) return null;
    return { ...parsed, id } as PassMeta;
  } catch {
    // BlobNotFoundError, a bad token, a transient blob outage — from the
    // visitor's point of view they are all "this pass isn't here".
    return null;
  }
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const pass = await loadPass(id);

  if (!pass) {
    return {
      title: 'Pass not found — Hacker House Goa 2026',
      description: 'This boarding pass has expired or never existed. Issue your own.',
      robots: { index: false, follow: true },
    };
  }

  const who = pass.handle?.trim() || 'A builder';
  const title = `${pass.title || 'Builder'} · Boarding Pass No. ${String(pass.serial).padStart(4, '0')}`;
  const description = `${who} is locked in for Hacker House Goa 2026. ${EVENT.window}. Issue your own pass in one pass, no signup.`;

  return {
    title,
    description,
    alternates: { canonical: `/c/${pass.id}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/c/${pass.id}`,
      siteName: 'Hacker House Goa 2026',
      images: [
        {
          url: pass.ogUrl,
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
      images: [pass.ogUrl],
    },
  };
}

export default async function SharedPassPage({ params }: Params) {
  const { id } = await params;
  const pass = await loadPass(id);
  // Renders app/c/[id]/not-found.tsx with a real 404 status, rather than
  // throwing or serving a 200 that says "nothing here".
  if (!pass) notFound();

  const serial = String(pass.serial).padStart(4, '0');
  const line = [pass.title, pass.stack].filter(Boolean).join('  ·  ');

  return (
    <main style={styles.page}>
      <div style={styles.inner}>
        <p style={styles.kicker}>BOARDING PASS · No. {serial}</p>

        {/* Plain <img>: the source is a blob-store host, and next/image would
            need a remoteImagePattern in next.config.ts, which this layer
            doesn't own. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pass.cardUrl}
          alt={`${pass.title || 'Builder'} — Hacker House Goa 2026 pass, no. ${serial}`}
          width={1080}
          height={1350}
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

        {pass.cardDownloadUrl ? (
          <a href={pass.cardDownloadUrl} style={styles.secondary}>
            Download this pass (PNG)
          </a>
        ) : null}
      </div>
    </main>
  );
}

/**
 * Inline styles on purpose: app/globals.css and its Tailwind theme belong to
 * another layer, and a share page that renders wrong because a token got
 * renamed is a share page that fails in front of everyone who clicked the post.
 */
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
  inner: { width: '100%', maxWidth: 440, textAlign: 'center' },
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
    borderRadius: 4,
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
    borderRadius: 2,
  },
  sub: { fontSize: 12, opacity: 0.66, margin: '14px 0 0', lineHeight: 1.6 },
  secondary: {
    display: 'inline-block',
    marginTop: 18,
    fontSize: 12,
    letterSpacing: '0.08em',
    color: BRAND.cream,
    opacity: 0.7,
  },
};
