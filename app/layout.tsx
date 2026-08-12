import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Boarding Pass No. 247 — Hacker House Goa 2026',
  description:
    'Upload a photo, get your HH Goa 2026 builder pass. Downloadable, shareable, no signup.',
  openGraph: {
    title: 'Boarding Pass No. 247 — Hacker House Goa 2026',
    description: 'Get issued your builder pass for Hacker House Goa, 28–31 Oct 2026.',
    type: 'website',
    images: ['/og-default.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boarding Pass No. 247 — Hacker House Goa 2026',
    description: 'Get issued your builder pass for Hacker House Goa, 28–31 Oct 2026.',
    images: ['/og-default.png'],
  },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#07120C',
  width: 'device-width',
  initialScale: 1,
  // The dock has small controls; pinch-zoom must stay available.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
