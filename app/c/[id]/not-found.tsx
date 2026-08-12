/**
 * Shown (with a real 404 status) when /c/<id> points at a pass that isn't in
 * the store: a mistyped link, an expired share, or a deploy with no blob store.
 * Still branded, and still funnels to the tool — a dead link from a post is
 * still someone who came here because of the post.
 */

import { BRAND, EVENT } from '@/lib/brand';

export default function PassNotFound() {
  return (
    <main style={styles.page}>
      <div style={styles.inner}>
        <p style={styles.code}>404 · NO SUCH PASS</p>
        <h1 style={styles.head}>This boarding pass isn&rsquo;t on the manifest.</h1>
        <p style={styles.body}>
          The link may be mistyped, or the pass was never issued. Issuing a new one takes about
          fifteen seconds.
        </p>
        <a href="/" style={styles.cta}>
          MAKE YOUR OWN →
        </a>
        <p style={styles.sub}>
          {EVENT.name} · {EVENT.window} · {EVENT.hashtag}
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: `linear-gradient(170deg, ${BRAND.green} 0%, ${BRAND.inkGreen} 100%)`,
    color: BRAND.cream,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: "'Victor Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  inner: { maxWidth: 420, textAlign: 'center' },
  code: { fontSize: 12, letterSpacing: '0.24em', opacity: 0.7, margin: '0 0 18px' },
  head: {
    fontFamily: "'Imbue', Georgia, serif",
    fontSize: 40,
    lineHeight: 1.05,
    margin: '0 0 14px',
    fontWeight: 700,
  },
  body: { fontSize: 13, lineHeight: 1.7, opacity: 0.75, margin: '0 0 28px' },
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
  sub: { fontSize: 11, letterSpacing: '0.14em', opacity: 0.6, marginTop: 18 },
};
