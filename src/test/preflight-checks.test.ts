/**
 * Preflight check functions — pure, exhaustive.
 *
 * Every check is pure; these tests cover each decision branch without
 * jsdom, timers, or a live Supabase.
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateVerdict,
  checkActiveSession,
  checkAutoplay,
  checkBandwidth,
  checkAuth,
  checkBrowserSupport,
  checkEntitlement,
  checkReplay,
  deriveGameState,
  runAllChecks,
} from '@/lib/preflight/checks';
import type {
  BrowserCapabilities,
} from '@/lib/preflight/checks';
import type { PreflightSnapshot } from '@/lib/preflight/types';

function snap(overrides: Partial<PreflightSnapshot> = {}): PreflightSnapshot {
  return {
    ok: true,
    userId: 'u-1',
    entitlement: { status: 'active', expiresAt: null },
    activeSession: { hasConflict: false, conflictDeviceLabel: null, conflictStartedAt: null },
    game: {
      id: 'g-1',
      state: 'live',
      tipoffAt: null,
      ppvPriceCad: 4.99,
      replay: { embargoEndsAt: null, qualityTier: null, priceCad: null, entitled: false },
    },
    ...overrides,
  };
}

function caps(overrides: Partial<BrowserCapabilities> = {}): BrowserCapabilities {
  return {
    userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
    effectiveType: '4g',
    canAutoplayMutedVideo: true,
    isPwaCapable: true,
    ...overrides,
  };
}

describe('checkAuth', () => {
  it('passes when userId is present', () => {
    expect(checkAuth(snap({ userId: 'u-1' })).status).toBe('pass');
  });
  it('fails with sign_in remediation when anonymous', () => {
    const r = checkAuth(snap({ userId: null }));
    expect(r.status).toBe('fail');
    expect(r.remediation?.action).toBe('sign_in');
  });
});

describe('checkEntitlement', () => {
  it('skips when auth is absent', () => {
    expect(checkEntitlement(snap({ userId: null })).status).toBe('skipped');
  });
  it('passes when entitlement is active', () => {
    expect(checkEntitlement(snap()).status).toBe('pass');
  });
  it('fails when entitlement is absent', () => {
    const r = checkEntitlement(snap({ entitlement: { status: 'absent', expiresAt: null } }));
    expect(r.status).toBe('fail');
    expect(r.remediation?.action).toBe('purchase_ppv');
  });
  it('fails when entitlement is expired', () => {
    const r = checkEntitlement(snap({ entitlement: { status: 'expired', expiresAt: null } }));
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/elapsed/i);
  });
});

describe('checkActiveSession', () => {
  it('passes when no conflict', () => {
    expect(checkActiveSession(snap()).status).toBe('pass');
  });
  it('fails with displace CTA on conflict', () => {
    const r = checkActiveSession(
      snap({
        activeSession: {
          hasConflict: true,
          conflictDeviceLabel: 'iPhone 14',
          conflictStartedAt: new Date().toISOString(),
        },
      }),
    );
    expect(r.status).toBe('fail');
    expect(r.remediation?.action).toBe('displace_session');
  });
  it('skips when anonymous', () => {
    expect(checkActiveSession(snap({ userId: null })).status).toBe('skipped');
  });
});

describe('checkBrowserSupport', () => {
  it('passes modern Chrome', () => {
    expect(checkBrowserSupport(caps({ userAgent: 'Chrome/120' })).status).toBe('pass');
  });
  it('warns on older Chrome', () => {
    expect(checkBrowserSupport(caps({ userAgent: 'Chrome/60' })).status).toBe('warn');
  });
  it('passes modern Safari', () => {
    expect(
      checkBrowserSupport(caps({ userAgent: 'Version/17.0 Safari/605.1.15' })).status,
    ).toBe('pass');
  });
  it('warns on unknown browser', () => {
    expect(checkBrowserSupport(caps({ userAgent: 'Curl/1.0' })).status).toBe('warn');
  });
});

describe('checkBandwidth', () => {
  it('passes on 4g/5g/wifi', () => {
    expect(checkBandwidth(caps({ effectiveType: '4g' })).status).toBe('pass');
    expect(checkBandwidth(caps({ effectiveType: '5g' })).status).toBe('pass');
    expect(checkBandwidth(caps({ effectiveType: 'wifi' })).status).toBe('pass');
  });
  it('warns on 3g', () => {
    expect(checkBandwidth(caps({ effectiveType: '3g' })).status).toBe('warn');
  });
  it('warns on 2g / slow-2g', () => {
    expect(checkBandwidth(caps({ effectiveType: '2g' })).status).toBe('warn');
    expect(checkBandwidth(caps({ effectiveType: 'slow-2g' })).status).toBe('warn');
  });
  it('passes when Connection API is unavailable (Safari/Firefox)', () => {
    expect(checkBandwidth(caps({ effectiveType: undefined })).status).toBe('pass');
  });
});

describe('checkAutoplay', () => {
  it('passes when autoplay is allowed', () => {
    expect(checkAutoplay(caps()).status).toBe('pass');
  });
  it('warns (non-blocking) when autoplay is blocked', () => {
    expect(checkAutoplay(caps({ canAutoplayMutedVideo: false })).status).toBe('warn');
  });
});

describe('checkReplay', () => {
  it('skips for live games', () => {
    expect(checkReplay(snap()).status).toBe('skipped');
  });
  it('fails with wait_for_replay when embargo is future', () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const r = checkReplay(
      snap({
        game: {
          id: 'g',
          state: 'ended_replay',
          tipoffAt: null,
          ppvPriceCad: null,
          replay: { embargoEndsAt: future, qualityTier: 'raw', priceCad: 1.5, entitled: false },
        },
      }),
    );
    expect(r.status).toBe('fail');
    expect(r.remediation?.action).toBe('wait_for_replay');
  });
  it('fails with buy_replay when embargo cleared but not entitled', () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const r = checkReplay(
      snap({
        game: {
          id: 'g',
          state: 'ended_replay',
          tipoffAt: null,
          ppvPriceCad: null,
          replay: { embargoEndsAt: past, qualityTier: 'edited', priceCad: 5, entitled: false },
        },
      }),
    );
    expect(r.status).toBe('fail');
    expect(r.remediation?.action).toBe('buy_replay');
    expect(r.detail).toMatch(/\$5\.00/);
  });
  it('passes when entitled + embargo cleared', () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const r = checkReplay(
      snap({
        game: {
          id: 'g',
          state: 'ended_replay',
          tipoffAt: null,
          ppvPriceCad: null,
          replay: { embargoEndsAt: past, qualityTier: 'raw', priceCad: 1.5, entitled: true },
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
  it('fails hard when replay is permanently unavailable', () => {
    const r = checkReplay(
      snap({
        game: {
          id: 'g',
          state: 'ended_no_replay',
          tipoffAt: null,
          ppvPriceCad: null,
          replay: { embargoEndsAt: null, qualityTier: null, priceCad: null, entitled: false },
        },
      }),
    );
    expect(r.status).toBe('fail');
    expect(r.remediation).toBeUndefined();
  });
});

describe('deriveGameState', () => {
  const now = Date.now();
  it('upcoming when startsAt is future', () => {
    expect(
      deriveGameState({
        startsAt: new Date(now + 3600_000).toISOString(),
        endedAt: null,
        isHalftime: false,
        replayMode: 'none',
        now,
      }),
    ).toBe('upcoming');
  });
  it('halftime takes precedence over live', () => {
    expect(
      deriveGameState({
        startsAt: new Date(now - 3600_000).toISOString(),
        endedAt: null,
        isHalftime: true,
        replayMode: 'none',
        now,
      }),
    ).toBe('halftime');
  });
  it('ended_no_replay when ended + replay_mode=none', () => {
    expect(
      deriveGameState({
        startsAt: new Date(now - 7200_000).toISOString(),
        endedAt: new Date(now - 3600_000).toISOString(),
        isHalftime: false,
        replayMode: 'none',
        now,
      }),
    ).toBe('ended_no_replay');
  });
  it('ended_replay when ended + replay_mode raw/edited', () => {
    expect(
      deriveGameState({
        startsAt: new Date(now - 7200_000).toISOString(),
        endedAt: new Date(now - 3600_000).toISOString(),
        isHalftime: false,
        replayMode: 'edited',
        now,
      }),
    ).toBe('ended_replay');
  });
});

describe('runAllChecks + aggregateVerdict', () => {
  it('returns 7 checks in canonical order', () => {
    const r = runAllChecks(snap(), caps());
    expect(r.map((x) => x.id)).toEqual([
      'auth',
      'entitlement',
      'activeSession',
      'browserSupport',
      'bandwidth',
      'autoplay',
      'replay',
    ]);
  });
  it('aggregates to "ready" when all pass/skipped', () => {
    expect(aggregateVerdict(runAllChecks(snap(), caps()))).toBe('ready');
  });
  it('aggregates to "blocked" when any check fails', () => {
    expect(aggregateVerdict(runAllChecks(snap({ userId: null }), caps()))).toBe('blocked');
  });
  it('aggregates to "warnings" when worst is warn', () => {
    expect(
      aggregateVerdict(
        runAllChecks(snap(), caps({ userAgent: 'Chrome/60', canAutoplayMutedVideo: false })),
      ),
    ).toBe('warnings');
  });
});
