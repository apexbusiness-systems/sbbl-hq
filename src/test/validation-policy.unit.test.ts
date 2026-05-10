/**
 * validation-policy.ts — unit test battery.
 *
 * Covers TTL clamping (Fix #5), session access decisions,
 * playback artifact validation, rate limiting, and viewer counting.
 */

import { describe, expect, it } from 'vitest';
import {
  clampArtifactTtl,
  computeActiveEntitledViewerCount,
  computeEntitlementExpiry,
  consumeSlidingWindow,
  decideOneDeviceAccess,
  DEFAULT_PLAYBACK_ARTIFACT_TTL_MS,
  isEntitlementActive,
  isPlaybackArtifactValid,
  MAX_ARTIFACT_TTL_MS,
  MIN_ARTIFACT_TTL_MS,
  sameDevice,
  sameIp,
  SIX_HOURS_MS,
  type SessionFingerprint,
} from '@/lib/stream/validation-policy';

// ─────────────────────────────────────────────────────────────────────────
// clampArtifactTtl (Fix #5)
// ─────────────────────────────────────────────────────────────────────────

describe('clampArtifactTtl', () => {
  it('returns default for zero input', () => {
    expect(clampArtifactTtl(0)).toBe(DEFAULT_PLAYBACK_ARTIFACT_TTL_MS);
  });

  it('returns default for negative input', () => {
    expect(clampArtifactTtl(-5000)).toBe(DEFAULT_PLAYBACK_ARTIFACT_TTL_MS);
  });

  it('returns default for NaN', () => {
    expect(clampArtifactTtl(NaN)).toBe(DEFAULT_PLAYBACK_ARTIFACT_TTL_MS);
  });

  it('returns default for Infinity', () => {
    expect(clampArtifactTtl(Infinity)).toBe(DEFAULT_PLAYBACK_ARTIFACT_TTL_MS);
  });

  it('clamps below MIN_ARTIFACT_TTL_MS to min', () => {
    expect(clampArtifactTtl(1000)).toBe(MIN_ARTIFACT_TTL_MS); // 1s < 1 min
  });

  it('clamps above MAX_ARTIFACT_TTL_MS to max', () => {
    expect(clampArtifactTtl(999_999_999)).toBe(MAX_ARTIFACT_TTL_MS);
  });

  it('passes through value within bounds', () => {
    const tenMinutes = 10 * 60 * 1000;
    expect(clampArtifactTtl(tenMinutes)).toBe(tenMinutes);
  });

  it('passes through exact min boundary', () => {
    expect(clampArtifactTtl(MIN_ARTIFACT_TTL_MS)).toBe(MIN_ARTIFACT_TTL_MS);
  });

  it('passes through exact max boundary', () => {
    expect(clampArtifactTtl(MAX_ARTIFACT_TTL_MS)).toBe(MAX_ARTIFACT_TTL_MS);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Entitlement
// ─────────────────────────────────────────────────────────────────────────

describe('computeEntitlementExpiry', () => {
  it('adds SIX_HOURS_MS to issuedAt', () => {
    expect(computeEntitlementExpiry(1000)).toBe(1000 + SIX_HOURS_MS);
  });
});

describe('isEntitlementActive', () => {
  it('returns true when now < expiresAt', () => {
    expect(isEntitlementActive(100, 200)).toBe(true);
  });

  it('returns false when now >= expiresAt', () => {
    expect(isEntitlementActive(200, 200)).toBe(false);
    expect(isEntitlementActive(300, 200)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Fingerprint matching
// ─────────────────────────────────────────────────────────────────────────

const fpA: SessionFingerprint = {
  deviceTokenHash: 'dev-aaa',
  installationKeyHash: 'inst-aaa',
  userAgentHash: 'ua-aaa',
  ipHash: 'ip-aaa',
};

const fpB: SessionFingerprint = {
  deviceTokenHash: 'dev-bbb',
  installationKeyHash: 'inst-bbb',
  userAgentHash: 'ua-bbb',
  ipHash: 'ip-bbb',
};

describe('sameDevice', () => {
  it('returns true for identical fingerprints', () => {
    expect(sameDevice(fpA, { ...fpA })).toBe(true);
  });

  it('returns false when deviceToken differs', () => {
    expect(sameDevice(fpA, { ...fpA, deviceTokenHash: 'x' })).toBe(false);
  });

  it('returns false when userAgent differs', () => {
    expect(sameDevice(fpA, { ...fpA, userAgentHash: 'x' })).toBe(false);
  });
});

describe('sameIp', () => {
  it('returns true for same ipHash', () => {
    expect(sameIp(fpA, fpA)).toBe(true);
  });

  it('returns false for different ipHash', () => {
    expect(sameIp(fpA, fpB)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Access decisions
// ─────────────────────────────────────────────────────────────────────────

describe('decideOneDeviceAccess', () => {
  it('denies when entitlement expired', () => {
    const d = decideOneDeviceAccess({
      now: 1000,
      entitlementExpiresAt: 500,
      existingSession: null,
      candidateFingerprint: fpA,
    });
    expect(d.decision).toBe('deny');
    expect(d.reason).toBe('entitlement_expired');
  });

  it('allows new session when none exists', () => {
    const d = decideOneDeviceAccess({
      now: 100,
      entitlementExpiresAt: 9999,
      existingSession: null,
      candidateFingerprint: fpA,
    });
    expect(d.decision).toBe('allow_new');
  });

  it('allows resume on same device same IP', () => {
    const d = decideOneDeviceAccess({
      now: 100,
      entitlementExpiresAt: 9999,
      existingSession: {
        status: 'active',
        expiresAt: 9999,
        fingerprint: fpA,
      },
      candidateFingerprint: fpA,
    });
    expect(d.decision).toBe('allow_resume');
    expect(d.reason).toBe('same_device_same_ip');
  });

  it('denies when different device without takeover', () => {
    const d = decideOneDeviceAccess({
      now: 100,
      entitlementExpiresAt: 9999,
      existingSession: {
        status: 'active',
        expiresAt: 9999,
        fingerprint: fpA,
      },
      candidateFingerprint: fpB,
      allowTakeover: false,
    });
    expect(d.decision).toBe('deny');
    expect(d.reason).toBe('device_changed');
  });

  it('challenges when different device with takeover enabled', () => {
    const d = decideOneDeviceAccess({
      now: 100,
      entitlementExpiresAt: 9999,
      existingSession: {
        status: 'active',
        expiresAt: 9999,
        fingerprint: fpA,
      },
      candidateFingerprint: fpB,
      allowTakeover: true,
    });
    expect(d.decision).toBe('challenge');
    expect(d.reason).toBe('different_device');
  });

  it('denies revoked session', () => {
    const d = decideOneDeviceAccess({
      now: 100,
      entitlementExpiresAt: 9999,
      existingSession: {
        status: 'revoked',
        expiresAt: 9999,
        fingerprint: fpA,
      },
      candidateFingerprint: fpA,
    });
    expect(d.decision).toBe('deny');
    expect(d.reason).toBe('session_not_resumable');
  });

  it('allows new session when existing is expired', () => {
    const d = decideOneDeviceAccess({
      now: 100,
      entitlementExpiresAt: 9999,
      existingSession: {
        status: 'active',
        expiresAt: 50,
        fingerprint: fpA,
      },
      candidateFingerprint: fpA,
    });
    expect(d.decision).toBe('allow_new');
    expect(d.reason).toBe('session_expired');
  });

  it('denies when same device but different IP', () => {
    const d = decideOneDeviceAccess({
      now: 100,
      entitlementExpiresAt: 9999,
      existingSession: {
        status: 'active',
        expiresAt: 9999,
        fingerprint: fpA,
      },
      candidateFingerprint: { ...fpA, ipHash: 'ip-different' },
    });
    expect(d.decision).toBe('deny');
    expect(d.reason).toBe('ip_changed');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Playback artifact validation
// ─────────────────────────────────────────────────────────────────────────

describe('isPlaybackArtifactValid', () => {
  it('returns true for valid artifact within TTL and entitlement', () => {
    expect(
      isPlaybackArtifactValid({
        now: 500,
        issuedAt: 0,
        artifactTtlMs: 1000,
        entitlementExpiresAt: 2000,
      }),
    ).toBe(true);
  });

  it('returns false when TTL <= 0', () => {
    expect(
      isPlaybackArtifactValid({
        now: 500,
        issuedAt: 0,
        artifactTtlMs: 0,
        entitlementExpiresAt: 2000,
      }),
    ).toBe(false);
  });

  it('returns false when artifact TTL exceeds entitlement', () => {
    expect(
      isPlaybackArtifactValid({
        now: 0,
        issuedAt: 0,
        artifactTtlMs: 3000,
        entitlementExpiresAt: 2000,
      }),
    ).toBe(false);
  });

  it('returns false when now >= artifact expiry', () => {
    expect(
      isPlaybackArtifactValid({
        now: 1500,
        issuedAt: 0,
        artifactTtlMs: 1000,
        entitlementExpiresAt: 5000,
      }),
    ).toBe(false);
  });

  it('returns false when now >= entitlement expiry', () => {
    expect(
      isPlaybackArtifactValid({
        now: 3000,
        issuedAt: 0,
        artifactTtlMs: 10000,
        entitlementExpiresAt: 2000,
      }),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────

describe('consumeSlidingWindow', () => {
  it('allows when under limit', () => {
    const r = consumeSlidingWindow({
      now: 1000,
      windowMs: 60_000,
      limit: 5,
      timestamps: [500, 700],
    });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
    expect(r.nextTimestamps).toContain(1000);
  });

  it('blocks when at limit', () => {
    const r = consumeSlidingWindow({
      now: 1000,
      windowMs: 60_000,
      limit: 3,
      timestamps: [500, 700, 900],
    });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('drops expired timestamps', () => {
    const r = consumeSlidingWindow({
      now: 100_000,
      windowMs: 60_000,
      limit: 5,
      timestamps: [10_000, 20_000, 80_000, 90_000], // first two expired
    });
    expect(r.allowed).toBe(true);
    expect(r.nextTimestamps).toHaveLength(3); // 80k, 90k, 100k
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Viewer counting
// ─────────────────────────────────────────────────────────────────────────

describe('computeActiveEntitledViewerCount', () => {
  it('counts distinct active users', () => {
    const count = computeActiveEntitledViewerCount(100, [
      { userId: 'u1', status: 'active', expiresAt: 9999 },
      { userId: 'u2', status: 'active', expiresAt: 9999 },
      { userId: 'u1', status: 'resumable', expiresAt: 9999 }, // duplicate
    ]);
    expect(count).toBe(2);
  });

  it('excludes expired sessions', () => {
    const count = computeActiveEntitledViewerCount(100, [
      { userId: 'u1', status: 'active', expiresAt: 50 }, // expired
      { userId: 'u2', status: 'active', expiresAt: 9999 },
    ]);
    expect(count).toBe(1);
  });

  it('excludes revoked/denied sessions', () => {
    const count = computeActiveEntitledViewerCount(100, [
      { userId: 'u1', status: 'revoked', expiresAt: 9999 },
      { userId: 'u2', status: 'denied', expiresAt: 9999 },
      { userId: 'u3', status: 'active', expiresAt: 9999 },
    ]);
    expect(count).toBe(1);
  });

  it('returns 0 for empty sessions', () => {
    expect(computeActiveEntitledViewerCount(100, [])).toBe(0);
  });
});