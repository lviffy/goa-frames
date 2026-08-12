/**
 * POST /api/publish — store one rendered pass so it has a public URL.
 *
 * This route exists for exactly one reason: X will not accept an image through
 * the `intent/post` URL. If a user shares a link instead of attaching the file,
 * the link's OG image has to be the card, which means the PNG must already be
 * public before the composer opens.
 *
 * There is no database. The card id *is* the blob key prefix.
 *
 * GET /api/publish reports whether a store is attached, so the UI can decide up
 * front whether to offer link sharing at all.
 */

import { put } from '@vercel/blob';
import type { NextRequest } from 'next/server';
import {
  MAX_CARD_BYTES,
  MAX_OG_BYTES,
  MAX_TOTAL_BYTES,
  MIN_PNG_BYTES,
  blobKeys,
  isPngSignature,
  type PassMeta,
  type PublishConfigResponse,
  type PublishMetaInput,
  type PublishResponse,
} from './schema';

export const runtime = 'nodejs';

/** A month of browser caching; the id is immutable so nothing can go stale. */
const CACHE_MAX_AGE = 60 * 60 * 24 * 30;

function isConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function json(body: PublishResponse | PublishConfigResponse, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

/**
 * The "no store attached" answer, returned with HTTP 200 on purpose.
 *
 * Local dev and any deploy without a Blob store hit this path constantly, and
 * it is not a failure: the client falls back to Web-Share-only, which still
 * satisfies the brief on mobile. A 4xx/5xx here would paint red lines in the
 * console, trip error reporting, and tempt the UI into showing the user a
 * problem they cannot act on.
 */
function notConfigured(): Response {
  return Response.json(
    {
      ok: false,
      reason: 'not_configured',
      message:
        'No blob store is attached to this deployment, so share links are unavailable. The download and direct image share still work.',
    } satisfies PublishResponse,
    { status: 200, headers: { 'cache-control': 'no-store', 'x-publish': 'not-configured' } },
  );
}

function invalid(
  reason: 'invalid' | 'too_large' | 'unsupported_type' | 'upload_failed',
  message: string,
  status: number,
): Response {
  return json({ ok: false, reason, message }, status);
}

// ---------------------------------------------------------------- ids

/** Crockford-ish: no i, l, o — an id can end up read aloud or typed. */
const ALPHABET = '0123456789abcdefghjkmnpqrstuvwxyz';

function shortId(len = 12): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

// ---------------------------------------------------------------- validation

/** C0 controls + DEL. This text ends up inside <meta> tags on the share page. */
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // Strip control characters — this text is echoed into <meta> tags later.
  return value.replace(CONTROL_CHARS, '').trim().slice(0, max);
}

function parseMeta(raw: unknown): PublishMetaInput | null {
  if (typeof raw !== 'string' || raw.length > 4_000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const m = parsed as Record<string, unknown>;
  const serial = Number(m.serial);
  return {
    handle: clean(m.handle, 64),
    stack: clean(m.stack, 96),
    title: clean(m.title, 96),
    serial: Number.isFinite(serial) ? Math.abs(Math.trunc(serial)) % 1_000_000 : 0,
    colorway: clean(m.colorway, 24) || 'monsoon',
  };
}

type FileCheck = { ok: true; blob: Blob } | { ok: false; response: Response };

async function checkPng(
  value: FormDataEntryValue | null,
  field: string,
  maxBytes: number,
): Promise<FileCheck> {
  if (!value || typeof value === 'string' || typeof (value as Blob).arrayBuffer !== 'function') {
    return { ok: false, response: invalid('invalid', `Missing the \`${field}\` image.`, 400) };
  }
  const blob = value as Blob;

  if (blob.size < MIN_PNG_BYTES) {
    return {
      ok: false,
      response: invalid('invalid', `The \`${field}\` image is empty or truncated.`, 400),
    };
  }
  if (blob.size > maxBytes) {
    return {
      ok: false,
      response: invalid(
        'too_large',
        `The \`${field}\` image is ${Math.round(blob.size / 1024)}KB; the limit is ${Math.round(maxBytes / 1024)}KB.`,
        413,
      ),
    };
  }
  // The declared content-type is a claim; the signature is the evidence.
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (!isPngSignature(head)) {
    return {
      ok: false,
      response: invalid('unsupported_type', `The \`${field}\` upload is not a PNG.`, 415),
    };
  }
  return { ok: true, blob };
}

// ---------------------------------------------------------------- origin

/** Where /c/<id> lives. Explicit env wins; otherwise trust the proxy headers. */
function siteOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

// ---------------------------------------------------------------- handlers

export async function GET(): Promise<Response> {
  return json({
    ok: true,
    configured: isConfigured(),
    maxCardBytes: MAX_CARD_BYTES,
    maxOgBytes: MAX_OG_BYTES,
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!isConfigured()) return notConfigured();

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return invalid('invalid', 'Expected a multipart/form-data body.', 415);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return invalid(
      'invalid',
      err instanceof Error && /too large|body exceeded/i.test(err.message)
        ? 'The upload was larger than this endpoint accepts.'
        : 'The upload could not be read.',
      400,
    );
  }

  const card = await checkPng(form.get('card'), 'card', MAX_CARD_BYTES);
  if (!card.ok) return card.response;
  const og = await checkPng(form.get('og'), 'og', MAX_OG_BYTES);
  if (!og.ok) return og.response;

  if (card.blob.size + og.blob.size > MAX_TOTAL_BYTES) {
    return invalid('too_large', 'The two images together exceed the upload limit.', 413);
  }

  const meta = parseMeta(form.get('meta'));
  if (!meta) return invalid('invalid', 'The `meta` field was missing or malformed.', 400);

  const id = shortId();
  const keys = blobKeys(id);
  const opts = {
    access: 'public' as const,
    addRandomSuffix: false,
    contentType: 'image/png',
    cacheControlMaxAge: CACHE_MAX_AGE,
  };

  try {
    const [cardPut, ogPut] = await Promise.all([
      put(keys.card, card.blob, opts),
      put(keys.og, og.blob, opts),
    ]);

    const record: PassMeta = {
      id,
      handle: meta.handle,
      stack: meta.stack,
      title: meta.title,
      serial: meta.serial,
      colorway: meta.colorway,
      cardUrl: cardPut.url,
      ogUrl: ogPut.url,
      cardDownloadUrl: cardPut.downloadUrl,
      createdAt: new Date().toISOString(),
    };

    await put(keys.meta, JSON.stringify(record), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: CACHE_MAX_AGE,
    });

    return json({
      ok: true,
      id,
      url: `${siteOrigin(req)}/c/${id}`,
      cardUrl: cardPut.url,
      ogUrl: ogPut.url,
    });
  } catch (err) {
    // A token that exists but doesn't work (revoked, wrong store, suspended) is
    // indistinguishable from no store at all as far as the user is concerned —
    // degrade to Web-Share-only rather than showing an error nobody can fix.
    const name = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : '';
    if (/BlobAccess|BlobStoreNotFound|BlobStoreSuspended|token/i.test(`${name} ${message}`)) {
      return notConfigured();
    }
    console.error('[publish] blob upload failed', err);
    return invalid('upload_failed', 'The pass could not be stored. Try again in a moment.', 502);
  }
}
