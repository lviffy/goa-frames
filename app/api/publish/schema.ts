/**
 * The wire contract between the browser (lib/share.ts) and the publish route.
 *
 * Deliberately a plain module with no 'use client' and no server-only imports,
 * so the client bundle, the route handler and the /c/[id] page can all agree on
 * one set of types without any of them dragging the others into the wrong
 * runtime.
 */

/** Hard ceilings. Vercel caps a route handler request body at ~4.5MB. */
export const MAX_CARD_BYTES = 4_000_000;
export const MAX_OG_BYTES = 3_000_000;
/** Both files plus the metadata field have to fit inside one request. */
export const MAX_TOTAL_BYTES = 4_200_000;
/** Anything smaller than this isn't a real card; it's a truncated upload. */
export const MIN_PNG_BYTES = 1_024;

/** 89 50 4E 47 0D 0A 1A 0A — the PNG signature. Content-type is client-supplied
 *  and therefore a claim, not evidence; this is the evidence. */
export const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export function isPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_MAGIC.length) return false;
  return PNG_MAGIC.every((b, i) => bytes[i] === b);
}

/** The subset of the card that the share page needs to render itself. */
export type PassMeta = {
  id: string;
  handle: string;
  stack: string;
  title: string;
  serial: number;
  colorway: string;
  /** Absolute, public blob URLs. */
  cardUrl: string;
  ogUrl: string;
  /** Blob download URL (forces Content-Disposition: attachment). */
  cardDownloadUrl: string;
  createdAt: string;
};

/** What the client sends in the `meta` form field, JSON-encoded. */
export type PublishMetaInput = {
  handle: string;
  stack: string;
  title: string;
  serial: number;
  colorway: string;
};

export type PublishOk = {
  ok: true;
  id: string;
  /** Canonical share URL, e.g. https://host/c/<id>. */
  url: string;
  cardUrl: string;
  ogUrl: string;
};

/**
 * `not_configured` is not an error — it's the expected answer in local dev and
 * on any deploy without a Blob store attached. It is returned with HTTP 200 on
 * purpose: the client must treat it as "fall back to Web-Share-only", not as a
 * failure worth showing the user or logging as a red line in the console.
 */
export type PublishNotConfigured = {
  ok: false;
  reason: 'not_configured';
  message: string;
};

export type PublishFailure = {
  ok: false;
  reason: 'invalid' | 'too_large' | 'unsupported_type' | 'upload_failed';
  message: string;
};

export type PublishResponse = PublishOk | PublishNotConfigured | PublishFailure;

/** GET /api/publish — lets the UI decide up front whether links are possible. */
export type PublishConfigResponse = {
  ok: true;
  configured: boolean;
  maxCardBytes: number;
  maxOgBytes: number;
};

/** Blob keys. The card id *is* the key prefix — there is no database. */
export const blobKeys = (id: string) => ({
  card: `c/${id}/card.png`,
  og: `c/${id}/og.png`,
  meta: `c/${id}/meta.json`,
});

/** Ids are generated server-side; this is the shape both ends will accept. */
export const ID_PATTERN = /^[0-9a-hjkmnp-z]{10,14}$/;
