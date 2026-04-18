/**
 * Signed playback token — HMAC-SHA256 over a JWT-shaped payload.
 *
 * Tokens bind a specific user + game + session + asset to a signed URL
 * that the client presents to the playback origin. Signature verification
 * fails fast on any mutation. Expiry is enforced both at mint time (the
 * `exp` claim is clamped to the session's `maxExpiresAt`) and at verify
 * time (clock check against current time).
 *
 * Uses the Web Crypto API — available in Cloudflare Workers natively.
 * No `jose` or `jsonwebtoken` dependency; base64url is hand-rolled to
 * avoid pulling another lib into the worker bundle.
 *
 * Token shape:
 *   base64url(header).base64url(payload).base64url(signature)
 *   header  = { alg: "HS256", typ: "JWT" }
 *   payload = PlaybackTokenClaims
 */

export interface PlaybackTokenClaims {
  /** Token format version. Must be 1. Enables future rotation without breaking verify. */
  v: 1;
  /** Issuer — always 'sbbl-hq'. Short string to keep payload tiny. */
  iss: 'sbbl-hq';
  /** User granted access. */
  userId: string;
  /** Game this token authorizes. Nullable for broadcast-alias sessions. */
  gameId: string | null;
  /** Stream access session row id. */
  sessionId: string;
  /** games.playback_asset_id — opaque identifier for the upstream origin. */
  assetId: string;
  /** 'live' | 'replay' — informs downstream authorization. */
  playbackMode: 'live' | 'replay';
  /** Unix seconds. Rolling session expiry; ≤ `mex`. */
  exp: number;
  /** Unix seconds. Hard session ceiling, never extended by heartbeats. */
  mex: number;
  /** Unix seconds. Issued-at. */
  iat: number;
}

const HEADER_B64 = base64urlEncode(
  new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
);

function base64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Mint a signed playback token. Secret MUST be non-empty — callers
 * whose flag is off should not invoke this at all; an empty secret is
 * a misconfiguration and throws synchronously.
 */
export async function signPlaybackToken(
  claims: PlaybackTokenClaims,
  secret: string,
): Promise<string> {
  if (!secret) throw new Error('PLAYBACK_TOKEN_SECRET missing');
  const payloadB64 = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(claims)),
  );
  const signingInput = `${HEADER_B64}.${payloadB64}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64urlEncode(new Uint8Array(sig))}`;
}

export type VerifyFailure =
  | 'malformed'
  | 'header_mismatch'
  | 'bad_signature'
  | 'expired'
  | 'unsupported_version';

export interface VerifySuccess {
  ok: true;
  claims: PlaybackTokenClaims;
}

export interface VerifyReject {
  ok: false;
  reason: VerifyFailure;
}

/**
 * Verify a signed playback token. Performs, in order:
 *   1. Structural parse (three segments, valid base64url).
 *   2. Header equality with canonical HS256 header.
 *   3. Constant-time HMAC signature check.
 *   4. Version + expiry clock check.
 */
export async function verifyPlaybackToken(
  token: string,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<VerifySuccess | VerifyReject> {
  if (!secret) return { ok: false, reason: 'bad_signature' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [headerB64, payloadB64, sigB64] = parts;
  if (headerB64 !== HEADER_B64) return { ok: false, reason: 'header_mismatch' };

  let claims: PlaybackTokenClaims;
  try {
    const raw = new TextDecoder().decode(base64urlDecode(payloadB64));
    claims = JSON.parse(raw) as PlaybackTokenClaims;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const key = await hmacKey(secret);
  let sig: Uint8Array;
  try {
    sig = base64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sig,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!valid) return { ok: false, reason: 'bad_signature' };
  if (claims.v !== 1) return { ok: false, reason: 'unsupported_version' };
  if (typeof claims.exp !== 'number' || claims.exp <= now) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, claims };
}
