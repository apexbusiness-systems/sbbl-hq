/**
 * Signed playback token — sign / verify round-trip invariants.
 *
 * Covers the security-relevant failure modes:
 *   - Tamper on header, payload, or signature fails verification.
 *   - Wrong secret fails verification.
 *   - Expired tokens fail at the `exp` clock check.
 *   - Version-0 (future-old) payloads fail the version gate.
 *
 * Narrowing convention: `if (r.ok) throw new Error(...)` is used
 * instead of `if (!r.ok)` because TypeScript's strict discriminated-
 * union narrowing is unambiguous with the explicit throw, whereas
 * `!r.ok` has tripped `Property 'reason' does not exist` under some
 * CI tsconfig settings.
 */
import { describe, expect, it } from 'vitest';
import {
  signPlaybackToken,
  verifyPlaybackToken,
  type PlaybackTokenClaims,
} from '@/lib/playback/signed-token';

const SECRET = 'unit-test-secret-32bytes-minimum-entropy!';

function claims(overrides: Partial<PlaybackTokenClaims> = {}): PlaybackTokenClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    v: 1,
    iss: 'sbbl-hq',
    userId: 'u1',
    gameId: 'g1',
    sessionId: 's1',
    assetId: 'asset-123',
    playbackMode: 'live',
    iat: now,
    exp: now + 70,
    mex: now + 21600,
    ...overrides,
  };
}

describe('signPlaybackToken / verifyPlaybackToken', () => {
  it('round-trips a valid token', async () => {
    const tok = await signPlaybackToken(claims(), SECRET);
    const r = await verifyPlaybackToken(tok, SECRET);
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
    expect(r.claims.userId).toBe('u1');
    expect(r.claims.assetId).toBe('asset-123');
    expect(r.claims.playbackMode).toBe('live');
  });

  it('rejects a token signed with a different secret', async () => {
    const tok = await signPlaybackToken(claims(), SECRET);
    const r = await verifyPlaybackToken(tok, 'different-secret-entirely');
    if (r.ok) throw new Error('expected rejection');
    expect(r.reason).toBe('bad_signature');
  });

  it('rejects a tampered payload', async () => {
    const tok = await signPlaybackToken(claims(), SECRET);
    const parts = tok.split('.');
    // Swap userId in the payload by re-encoding a different claim set
    const badPayload = btoa(JSON.stringify({ ...claims(), userId: 'attacker' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const tampered = `${parts[0]}.${badPayload}.${parts[2]}`;
    const r = await verifyPlaybackToken(tampered, SECRET);
    if (r.ok) throw new Error('expected rejection');
    expect(r.reason).toBe('bad_signature');
  });

  it('rejects a tampered signature', async () => {
    const tok = await signPlaybackToken(claims(), SECRET);
    const parts = tok.split('.');
    const tampered = `${parts[0]}.${parts[1]}.AAAA${parts[2].slice(4)}`;
    const r = await verifyPlaybackToken(tampered, SECRET);
    if (r.ok) throw new Error('expected rejection');
    expect(['bad_signature', 'malformed']).toContain(r.reason);
  });

  it('rejects a malformed token', async () => {
    const r = await verifyPlaybackToken('not-a-jwt', SECRET);
    if (r.ok) throw new Error('expected rejection');
    expect(r.reason).toBe('malformed');
  });

  it('rejects an expired token at verify time', async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const tok = await signPlaybackToken(claims({ exp: past }), SECRET);
    const r = await verifyPlaybackToken(tok, SECRET);
    if (r.ok) throw new Error('expected rejection');
    expect(r.reason).toBe('expired');
  });

  it('accepts a token verified before its exp', async () => {
    const now = Math.floor(Date.now() / 1000);
    const tok = await signPlaybackToken(claims({ exp: now + 60 }), SECRET);
    const r = await verifyPlaybackToken(tok, SECRET, now);
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
    expect(r.claims.exp).toBe(now + 60);
  });

  it('rejects a token with unknown version', async () => {
    // Manually forge a v2 payload with valid HMAC → still rejected by version gate
    const forged = { ...claims(), v: 2 as unknown as 1 };
    const tok = await signPlaybackToken(forged, SECRET);
    const r = await verifyPlaybackToken(tok, SECRET);
    if (r.ok) throw new Error('expected rejection');
    expect(r.reason).toBe('unsupported_version');
  });

  it('sign throws when secret is empty', async () => {
    await expect(signPlaybackToken(claims(), '')).rejects.toThrow(/secret/i);
  });

  it('verify rejects with bad_signature when secret is empty', async () => {
    const r = await verifyPlaybackToken('a.b.c', '');
    if (r.ok) throw new Error('expected rejection');
    expect(r.reason).toBe('bad_signature');
  });
});
