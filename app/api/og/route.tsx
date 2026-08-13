import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { BRAND, COLORWAYS, EVENT, type ColorwayId } from '@/lib/brand';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle')?.slice(0, 30) || '@builder';
  const stack = searchParams.get('stack')?.slice(0, 60) || 'Builder';
  const title = searchParams.get('title')?.slice(0, 50) || 'THE MONSOON ARCHITECT';
  const serialRaw = searchParams.get('serial') || '247';
  const serial = String(parseInt(serialRaw, 10) || 247).padStart(4, '0');
  const cwId = (searchParams.get('colorway') || 'monsoon') as ColorwayId;

  const colorway = COLORWAYS.find((c) => c.id === cwId) || COLORWAYS[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '40px 60px',
          background: `linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.deepGreen} 100%)`,
          fontFamily: 'monospace, sans-serif',
          position: 'relative',
        }}
      >
        {/* Border frame */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            border: `2px solid rgba(255, 251, 232, 0.25)`,
            pointerEvents: 'none',
          }}
        />

        {/* Left Side: Pass Card Mockup */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 440,
            height: 550,
            backgroundColor: colorway.stock,
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            border: '2px solid rgba(0,0,0,0.2)',
            position: 'relative',
          }}
        >
          {/* Card Header Band */}
          <div
            style={{
              backgroundColor: colorway.ink,
              color: colorway.onInk,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 2 }}>
              {EVENT.name}
            </span>
            <span
              style={{
                fontSize: 14,
                backgroundColor: colorway.accent,
                color: '#fff',
                padding: '3px 8px',
                borderRadius: 4,
                fontWeight: 'bold',
              }}
            >
              № {serial}
            </span>
          </div>

          {/* Card Body */}
          <div
            style={{
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 12,
                  color: 'rgba(0,0,0,0.5)',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                PASS HOLDER / HANDLE
              </span>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 'bold',
                  color: colorway.display,
                  letterSpacing: 1,
                  marginBottom: 16,
                }}
              >
                {handle}
              </span>

              <span
                style={{
                  fontSize: 12,
                  color: 'rgba(0,0,0,0.5)',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                TRACK / STACK
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: colorway.display,
                  marginBottom: 16,
                }}
              >
                {stack}
              </span>

              <span
                style={{
                  fontSize: 12,
                  color: 'rgba(0,0,0,0.5)',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                ASSIGNED DESIGNATION
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: colorway.accent,
                  letterSpacing: 0.5,
                }}
              >
                {title}
              </span>
            </div>

            {/* Card Footer Barcode/Event */}
            <div
              style={{
                borderTop: '2px dashed rgba(0,0,0,0.2)',
                paddingTop: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)', letterSpacing: 1 }}>
                {EVENT.place}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: colorway.display,
                }}
              >
                {EVENT.dates}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Headline & Event Branding */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 580,
            justifyContent: 'center',
            paddingLeft: 30,
          }}
        >
          <span
            style={{
              fontSize: 16,
              color: 'rgba(255, 251, 232, 0.75)',
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            BOARDING PASS · № {serial}
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 16 }}>
            <span
              style={{
                fontSize: 72,
                fontWeight: 900,
                color: BRAND.cream,
                lineHeight: 0.9,
                letterSpacing: 2,
              }}
            >
              HACKER
            </span>
            <span
              style={{
                fontSize: 72,
                fontWeight: 900,
                color: BRAND.yellow,
                lineHeight: 0.95,
                letterSpacing: 2,
              }}
            >
              HOUSE
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: 2,
              backgroundColor: 'rgba(255, 251, 232, 0.35)',
              marginBottom: 16,
            }}
          />

          <span
            style={{
              fontSize: 20,
              color: BRAND.cream,
              letterSpacing: 2,
              marginBottom: 10,
            }}
          >
            {EVENT.window}
          </span>

          <span
            style={{
              fontSize: 18,
              color: colorway.accent,
              letterSpacing: 1,
              marginBottom: 16,
            }}
          >
            {title} · {stack}
          </span>

          <span
            style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: BRAND.yellow,
              letterSpacing: 1.5,
            }}
          >
            {EVENT.hashtag}
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
