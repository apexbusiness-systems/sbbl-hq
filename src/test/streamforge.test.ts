/**
 * StreamForge engine unit tests.
 *
 * Every function is deterministic and pure — no mocks, no timers, no DOM.
 * All timestamps are passed explicitly so tests are ms-precise.
 */

import { describe, it, expect } from 'vitest';
import {
  // Safe math
  clamp,
  ewma,
  safeRatio,
  // Network
  normalizeNetworkProfile,
  UNKNOWN_NETWORK,
  pickQualityTier,
  // QoE snapshot
  initQoeSnapshot,
  applyQoeEvent,
  withNetwork,
  computeHealthScore,
  QOE_EVENT_RING_SIZE,
  QOE_STARTUP_BUDGET_MS,
  // Circuit breaker
  initBreaker,
  breakerStep,
  breakerAllows,
  BREAKER_FAILURE_THRESHOLD,
  BREAKER_OPEN_COOLDOWN_MS,
  // Multi-path failover
  pickBestPath,
  // Predictive rebuffer
  shouldPreemptRebuffer,
  // Warm reconnect
  shouldWarmReconnect,
  WARM_RECONNECT_COOLDOWN_MS,
  // Preconnect helpers
  extractPreconnectOrigin,
  KNOWN_STREAM_ORIGINS,
  // Beacon / aggregation
  parseBeaconPayload,
  mergeBeaconIntoAggregate,
  toHealthReport,
  emptyAggregate,
  HEALTH_WINDOW_MS,
  type NetworkProfile,
  type BreakerSnapshot,
  type StreamPath,
  type QoeSnapshot,
} from '@/lib/stream/streamforge';

// ─────────────────────────────────────────────────────────────────────────
// SAFE MATH
// ─────────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('returns value inside range', () => expect(clamp(5, 0, 10)).toBe(5));
  it('clamps to min', () => expect(clamp(-1, 0, 10)).toBe(0));
  it('clamps to max', () => expect(clamp(11, 0, 10)).toBe(10));
  it('uses fallback for NaN', () => expect(clamp(NaN, 0, 10, 3)).toBe(3));
  // Infinity is not finite → fallback is used; fallback=2 is in range → returns 2
  it('uses fallback for Infinity', () => expect(clamp(Infinity, 0, 10, 2)).toBe(2));
  // -Infinity is not finite → fallback is used; fallback=2 is in range → returns 2
  it('uses fallback for -Infinity', () => expect(clamp(-Infinity, 0, 10, 2)).toBe(2));
  it('uses fallback for non-number', () => expect(clamp('x' as unknown as number, 0, 10, 7)).toBe(7));
  it('fallback defaults to min', () => expect(clamp(NaN, 5, 10)).toBe(5));
});

describe('ewma', () => {
  it('returns next when prev is non-finite', () => expect(ewma(NaN, 10, 0.5)).toBe(10));
  it('returns prev when next is non-finite', () => expect(ewma(10, NaN, 0.5)).toBe(10));
  it('blends correctly with alpha=1 (full replacement)', () => expect(ewma(0, 100, 1)).toBe(100));
  it('blends correctly with alpha=0.5', () => expect(ewma(0, 100, 0.5)).toBe(50));
  it('clamps alpha to 0.0001 minimum', () => {
    const result = ewma(0, 100, 0);
    // alpha=0 clamped to 0.0001 → result very close to 0
    expect(result).toBeCloseTo(0.01, 1);
  });
});

describe('safeRatio', () => {
  it('returns num/denom for valid inputs', () => expect(safeRatio(1, 4)).toBe(0.25));
  it('returns 0 for zero denominator', () => expect(safeRatio(5, 0)).toBe(0));
  it('returns 0 for NaN numerator', () => expect(safeRatio(NaN, 4)).toBe(0));
  it('returns 0 for NaN denominator', () => expect(safeRatio(4, NaN)).toBe(0));
  it('clamps result to [0, 1]', () => expect(safeRatio(10, 5)).toBe(1));
  it('returns 0 for negative denominator', () => expect(safeRatio(5, -1)).toBe(0));
});

// ─────────────────────────────────────────────────────────────────────────
// NETWORK PROFILE
// ─────────────────────────────────────────────────────────────────────────

describe('normalizeNetworkProfile', () => {
  it('returns UNKNOWN_NETWORK for null', () =>
    expect(normalizeNetworkProfile(null)).toEqual({ ...UNKNOWN_NETWORK }));

  it('returns UNKNOWN_NETWORK for undefined', () =>
    expect(normalizeNetworkProfile(undefined)).toEqual({ ...UNKNOWN_NETWORK }));

  it('normalizes valid 4g profile', () => {
    const np = normalizeNetworkProfile({
      effectiveType: '4g',
      downlinkMbps: 20,
      rttMs: 15,
      saveData: false,
    });
    expect(np.effectiveType).toBe('4g');
    expect(np.downlinkMbps).toBe(20);
    expect(np.rttMs).toBe(15);
    expect(np.saveData).toBe(false);
  });

  it('coerces unknown effectiveType to "unknown"', () => {
    const np = normalizeNetworkProfile({ effectiveType: 'lte' as never });
    expect(np.effectiveType).toBe('unknown');
  });

  it('clamps downlinkMbps to [0, 1000]', () => {
    expect(normalizeNetworkProfile({ downlinkMbps: -5 }).downlinkMbps).toBe(0);
    expect(normalizeNetworkProfile({ downlinkMbps: 9999 }).downlinkMbps).toBe(1000);
  });

  it('clamps rttMs to [0, 60000]', () => {
    expect(normalizeNetworkProfile({ rttMs: -1 }).rttMs).toBe(0);
    expect(normalizeNetworkProfile({ rttMs: 999999 }).rttMs).toBe(60_000);
  });
});

describe('pickQualityTier', () => {
  const make = (et: NetworkProfile['effectiveType'], dl = 0): NetworkProfile =>
    normalizeNetworkProfile({ effectiveType: et, downlinkMbps: dl, rttMs: 0 });

  it('slow-2g → audio-only', () => expect(pickQualityTier(make('slow-2g'))).toBe('audio-only'));
  it('2g → audio-only', () => expect(pickQualityTier(make('2g'))).toBe('audio-only'));
  it('3g low dl → low', () => expect(pickQualityTier(make('3g', 0.5))).toBe('low'));
  it('3g hi dl → sd', () => expect(pickQualityTier(make('3g', 2))).toBe('sd'));
  it('4g 12 Mbps → fhd', () => expect(pickQualityTier(make('4g', 12))).toBe('fhd'));
  it('4g 5 Mbps → hd', () => expect(pickQualityTier(make('4g', 5))).toBe('hd'));
  it('4g 2 Mbps → sd', () => expect(pickQualityTier(make('4g', 2))).toBe('sd'));
  it('4g 0.5 Mbps → low', () => expect(pickQualityTier(make('4g', 0.5))).toBe('low'));
  it('unknown → auto', () => expect(pickQualityTier(make('unknown'))).toBe('auto'));
  it('saveData overrides to low', () =>
    expect(pickQualityTier({ ...make('4g', 50), saveData: true })).toBe('low'));
});

// ─────────────────────────────────────────────────────────────────────────
// QOE SNAPSHOT STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────

describe('initQoeSnapshot', () => {
  it('creates snapshot with correct defaults', () => {
    const s = initQoeSnapshot('sess1', 1000);
    expect(s.sessionId).toBe('sess1');
    expect(s.mountTs).toBe(1000);
    expect(s.lastTs).toBe(1000);
    expect(s.firstPlayTs).toBeNull();
    expect(s.rebufferStartTs).toBeNull();
    expect(s.playbackMs).toBe(0);
    expect(s.rebufferMs).toBe(0);
    expect(s.errorCount).toBe(0);
    expect(s.ring).toEqual([]);
  });

  it('truncates sessionId to MAX_STRING_LEN', () => {
    const long = 'a'.repeat(200);
    const s = initQoeSnapshot(long, 0);
    expect(s.sessionId.length).toBe(128);
  });

  it('falls back sessionId to "anon" for empty string', () => {
    expect(initQoeSnapshot('', 0).sessionId).toBe('anon');
  });

  it('clamps negative timestamp to 0', () => {
    expect(initQoeSnapshot('s', -100).mountTs).toBe(0);
  });
});

describe('applyQoeEvent', () => {
  const base = (): QoeSnapshot => initQoeSnapshot('s', 0);

  it('records first play on "playing" event', () => {
    const s = applyQoeEvent(base(), { kind: 'playing', ts: 500 });
    expect(s.firstPlayTs).toBe(500);
  });

  it('does not overwrite firstPlayTs on second "playing"', () => {
    let s = applyQoeEvent(base(), { kind: 'playing', ts: 500 });
    s = applyQoeEvent(s, { kind: 'playing', ts: 1000 });
    expect(s.firstPlayTs).toBe(500);
  });

  it('increments rebufferCount on "waiting"', () => {
    const s = applyQoeEvent(base(), { kind: 'waiting', ts: 100 });
    expect(s.rebufferCount).toBe(1);
    expect(s.rebufferStartTs).toBe(100);
  });

  it('does not double-count rebuffer start', () => {
    let s = applyQoeEvent(base(), { kind: 'waiting', ts: 100 });
    s = applyQoeEvent(s, { kind: 'waiting', ts: 200 });
    expect(s.rebufferCount).toBe(1);
  });

  it('accumulates rebufferMs when "playing" ends rebuffer', () => {
    let s = applyQoeEvent(base(), { kind: 'waiting', ts: 100 });
    s = applyQoeEvent(s, { kind: 'playing', ts: 600 });
    expect(s.rebufferMs).toBe(500);
    expect(s.rebufferStartTs).toBeNull();
  });

  it('accumulates rebufferMs when "error" ends rebuffer', () => {
    let s = applyQoeEvent(base(), { kind: 'waiting', ts: 0 });
    s = applyQoeEvent(s, { kind: 'error', ts: 300 });
    expect(s.rebufferMs).toBe(300);
    expect(s.errorCount).toBe(1);
  });

  it('accumulates rebufferMs when "pause" ends rebuffer', () => {
    let s = applyQoeEvent(base(), { kind: 'waiting', ts: 0 });
    s = applyQoeEvent(s, { kind: 'pause', ts: 200 });
    expect(s.rebufferMs).toBe(200);
  });

  it('accumulates playbackMs on heartbeat when playing', () => {
    let s = applyQoeEvent(base(), { kind: 'playing', ts: 0 });
    s = applyQoeEvent(s, { kind: 'heartbeat', ts: 5000 });
    expect(s.playbackMs).toBe(5000);
  });

  it('does not add playbackMs if not yet played', () => {
    let s = applyQoeEvent(base(), { kind: 'heartbeat', ts: 5000 });
    expect(s.playbackMs).toBe(0);
  });

  it('does not add playbackMs during rebuffer', () => {
    let s = applyQoeEvent(base(), { kind: 'playing', ts: 0 });
    s = applyQoeEvent(s, { kind: 'waiting', ts: 1000 });
    s = applyQoeEvent(s, { kind: 'heartbeat', ts: 3000 });
    expect(s.playbackMs).toBe(0);
  });

  it('stores bufferAheadMs from heartbeat', () => {
    let s = applyQoeEvent(base(), { kind: 'heartbeat', ts: 100, bufferAheadMs: 4000 });
    expect(s.lastBufferAheadMs).toBe(4000);
  });

  it('ring buffer caps at QOE_EVENT_RING_SIZE', () => {
    let s = base();
    for (let i = 0; i < QOE_EVENT_RING_SIZE + 10; i++) {
      s = applyQoeEvent(s, { kind: 'heartbeat', ts: i });
    }
    expect(s.ring.length).toBe(QOE_EVENT_RING_SIZE);
  });

  it('clamps out-of-order timestamps (monotonicity)', () => {
    let s = applyQoeEvent(base(), { kind: 'playing', ts: 1000 });
    s = applyQoeEvent(s, { kind: 'heartbeat', ts: 500 }); // out of order
    expect(s.lastTs).toBe(1000);
  });

  it('handles non-finite ts gracefully', () => {
    const s = applyQoeEvent(base(), { kind: 'playing', ts: NaN });
    expect(s.lastTs).toBe(0); // stays at base lastTs
  });
});

describe('withNetwork', () => {
  it('replaces network without touching other fields', () => {
    const base = initQoeSnapshot('s', 0);
    const np: NetworkProfile = normalizeNetworkProfile({ effectiveType: '4g', downlinkMbps: 20 });
    const s = withNetwork(base, np);
    expect(s.network.effectiveType).toBe('4g');
    expect(s.mountTs).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// HEALTH SCORE
// ─────────────────────────────────────────────────────────────────────────

describe('computeHealthScore', () => {
  it('returns 100 for a perfect fresh snapshot', () => {
    // No play yet, no errors, no network penalty, not past startup budget
    const s = initQoeSnapshot('s', 0);
    const h = computeHealthScore(s);
    expect(h.score).toBe(100);
    expect(h.startupPenalty).toBe(0);
    expect(h.rebufferPenalty).toBe(0);
    expect(h.errorPenalty).toBe(0);
  });

  it('applies startup penalty when first play is late', () => {
    // First play at 6s — 2× over the 3s budget → full 25 penalty
    let s = initQoeSnapshot('s', 0);
    s = applyQoeEvent(s, { kind: 'playing', ts: 6_001 });
    const h = computeHealthScore(s);
    expect(h.startupPenalty).toBe(25);
  });

  it('applies max startup penalty when never plays past 2x budget', () => {
    // lastTs - mountTs > 2 * QOE_STARTUP_BUDGET_MS, no play yet
    const s = { ...initQoeSnapshot('s', 0), lastTs: QOE_STARTUP_BUDGET_MS * 2 + 1 };
    const h = computeHealthScore(s);
    expect(h.startupPenalty).toBe(25);
  });

  it('applies rebuffer penalty when rebuffer ratio exceeds budget', () => {
    // 5s playback + 5s rebuffer = 50% rebuffer ratio >> 2% budget
    const s: QoeSnapshot = {
      ...initQoeSnapshot('s', 0),
      firstPlayTs: 0,
      playbackMs: 5_000,
      rebufferMs: 5_000,
    };
    const h = computeHealthScore(s);
    expect(h.rebufferPenalty).toBe(40); // capped at 40
  });

  it('applies error penalty (10 per error, max 20)', () => {
    const s = { ...initQoeSnapshot('s', 0), errorCount: 3 };
    const h = computeHealthScore(s);
    expect(h.errorPenalty).toBe(20); // capped at 20
  });

  it('applies 15 penalty for slow-2g', () => {
    const s = { ...initQoeSnapshot('s', 0) };
    const s2 = withNetwork(s, normalizeNetworkProfile({ effectiveType: 'slow-2g' }));
    expect(computeHealthScore(s2).networkPenalty).toBe(15);
  });

  it('applies 10 penalty for 2g', () => {
    const s = withNetwork(initQoeSnapshot('s', 0), normalizeNetworkProfile({ effectiveType: '2g' }));
    expect(computeHealthScore(s).networkPenalty).toBe(10);
  });

  it('applies 3 penalty for 3g', () => {
    const s = withNetwork(initQoeSnapshot('s', 0), normalizeNetworkProfile({ effectiveType: '3g' }));
    expect(computeHealthScore(s).networkPenalty).toBe(3);
  });

  it('score never goes below 0', () => {
    const s: QoeSnapshot = {
      ...initQoeSnapshot('s', 0),
      firstPlayTs: 99_999,
      errorCount: 10,
      playbackMs: 1,
      rebufferMs: 999,
      network: normalizeNetworkProfile({ effectiveType: 'slow-2g' }),
    };
    const h = computeHealthScore(s);
    expect(h.score).toBeGreaterThanOrEqual(0);
  });

  it('score never exceeds 100', () => {
    const h = computeHealthScore(initQoeSnapshot('s', 0));
    expect(h.score).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER
// ─────────────────────────────────────────────────────────────────────────

describe('breakerStep', () => {
  it('starts closed with 0 failures', () => {
    const b = initBreaker();
    expect(b.state).toBe('closed');
    expect(b.failures).toBe(0);
  });

  it('opens after threshold failures', () => {
    let b = initBreaker();
    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) {
      b = breakerStep({ breaker: b, now: i * 1000, outcome: 'failure' });
    }
    expect(b.state).toBe('open');
  });

  it('resets to closed on success', () => {
    let b = initBreaker();
    b = breakerStep({ breaker: b, now: 0, outcome: 'failure' });
    b = breakerStep({ breaker: b, now: 1, outcome: 'success' });
    expect(b.state).toBe('closed');
    expect(b.failures).toBe(0);
  });

  it('transitions open → half-open after cooldown', () => {
    let b = initBreaker();
    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) {
      b = breakerStep({ breaker: b, now: 0, outcome: 'failure' });
    }
    expect(b.state).toBe('open');
    // Now fail again after the cooldown has elapsed
    b = breakerStep({
      breaker: b,
      now: BREAKER_OPEN_COOLDOWN_MS + 1,
      outcome: 'failure',
    });
    expect(b.state).toBe('half-open');
  });

  it('half-open failure → reopens', () => {
    let b = initBreaker();
    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) {
      b = breakerStep({ breaker: b, now: 0, outcome: 'failure' });
    }
    // Force to half-open
    b = { ...b, state: 'half-open' as const };
    b = breakerStep({ breaker: b, now: 1, outcome: 'failure' });
    expect(b.state).toBe('open');
  });
});

describe('breakerAllows', () => {
  it('allows when closed', () => {
    expect(breakerAllows(initBreaker(), 0)).toBe(true);
  });

  it('blocks when open and within cooldown', () => {
    const b: BreakerSnapshot = { state: 'open', failures: 3, openedAt: 0, lastProbeAt: 0 };
    expect(breakerAllows(b, BREAKER_OPEN_COOLDOWN_MS - 1)).toBe(false);
  });

  it('allows when open but past cooldown', () => {
    const b: BreakerSnapshot = { state: 'open', failures: 3, openedAt: 0, lastProbeAt: 0 };
    expect(breakerAllows(b, BREAKER_OPEN_COOLDOWN_MS + 1)).toBe(true);
  });

  it('allows when half-open', () => {
    const b: BreakerSnapshot = { state: 'half-open', failures: 1, openedAt: 0, lastProbeAt: 0 };
    expect(breakerAllows(b, 0)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// MULTI-PATH FAILOVER
// ─────────────────────────────────────────────────────────────────────────

describe('pickBestPath', () => {
  const mkPath = (kind: StreamPath['kind'], state: BreakerSnapshot['state'] = 'closed'): StreamPath => ({
    id: kind,
    url: `https://${kind}.example.com/stream`,
    kind,
    breaker: { state, failures: state === 'open' ? 3 : 0, openedAt: state === 'open' ? 0 : null, lastProbeAt: null },
  });

  it('returns null for empty list', () => expect(pickBestPath([], 0)).toBeNull());

  it('prefers primary over mirror', () => {
    const paths = [mkPath('mirror'), mkPath('primary')];
    expect(pickBestPath(paths, 0)?.kind).toBe('primary');
  });

  it('skips open primary and returns mirror', () => {
    const paths = [mkPath('primary', 'open'), mkPath('mirror')];
    expect(pickBestPath(paths, 0)?.kind).toBe('mirror');
  });

  it('returns primary even when all are open (force-probe)', () => {
    const paths = [
      mkPath('primary', 'open'),
      mkPath('mirror', 'open'),
      mkPath('fallback', 'open'),
    ];
    expect(pickBestPath(paths, 0)?.kind).toBe('primary');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PREDICTIVE REBUFFER
// ─────────────────────────────────────────────────────────────────────────

describe('shouldPreemptRebuffer', () => {
  const playing = (): QoeSnapshot => {
    let s = initQoeSnapshot('s', 0);
    s = applyQoeEvent(s, { kind: 'playing', ts: 100 });
    return s;
  };

  it('does not fire before first play', () => {
    expect(shouldPreemptRebuffer({ snapshot: initQoeSnapshot('s', 0) })).toBe(false);
  });

  it('does not fire when already rebuffering', () => {
    let s = playing();
    s = applyQoeEvent(s, { kind: 'waiting', ts: 200 });
    expect(shouldPreemptRebuffer({ snapshot: s })).toBe(false);
  });

  it('fires when buffer low on slow network', () => {
    const np = normalizeNetworkProfile({ effectiveType: '2g' });
    const s = withNetwork({ ...playing(), lastBufferAheadMs: 500 }, np);
    expect(shouldPreemptRebuffer({ snapshot: s })).toBe(true);
  });

  it('fires when buffer < half horizon regardless of network', () => {
    // Default horizon = 5000 → half = 2500. Buffer at 1000 triggers.
    const s = { ...playing(), lastBufferAheadMs: 1000 };
    expect(shouldPreemptRebuffer({ snapshot: s })).toBe(true);
  });

  it('does not fire when buffer is comfortable', () => {
    const np = normalizeNetworkProfile({ effectiveType: '4g', downlinkMbps: 20 });
    const s = withNetwork({ ...playing(), lastBufferAheadMs: 10_000 }, np);
    expect(shouldPreemptRebuffer({ snapshot: s })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// WARM RECONNECT
// ─────────────────────────────────────────────────────────────────────────

describe('shouldWarmReconnect', () => {
  it('returns below-threshold when failures < 3', () => {
    const r = shouldWarmReconnect({ consecutiveFailures: 2, lastReconnectTs: null, now: 0 });
    expect(r.reconnect).toBe(false);
    expect(r.reason).toBe('below-threshold');
  });

  it('returns cooldown-ok when first reconnect after threshold', () => {
    const r = shouldWarmReconnect({ consecutiveFailures: 3, lastReconnectTs: null, now: 0 });
    expect(r.reconnect).toBe(true);
    expect(r.reason).toBe('cooldown-ok');
  });

  it('returns too-soon when within cooldown', () => {
    const r = shouldWarmReconnect({
      consecutiveFailures: 5,
      lastReconnectTs: 0,
      now: WARM_RECONNECT_COOLDOWN_MS - 1,
    });
    expect(r.reconnect).toBe(false);
    expect(r.reason).toBe('too-soon');
  });

  it('returns cooldown-ok when past cooldown', () => {
    const r = shouldWarmReconnect({
      consecutiveFailures: 5,
      lastReconnectTs: 0,
      now: WARM_RECONNECT_COOLDOWN_MS + 1,
    });
    expect(r.reconnect).toBe(true);
    expect(r.reason).toBe('cooldown-ok');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PRECONNECT HELPERS
// ─────────────────────────────────────────────────────────────────────────

describe('extractPreconnectOrigin', () => {
  it('extracts https origin', () =>
    expect(extractPreconnectOrigin('https://example.com/stream.m3u8')).toBe('https://example.com'));

  it('extracts http origin', () =>
    expect(extractPreconnectOrigin('http://cdn.example.com/live')).toBe('http://cdn.example.com'));

  it('returns null for data URIs', () =>
    expect(extractPreconnectOrigin('data:text/html,hello')).toBeNull());

  it('returns null for blob URIs', () =>
    expect(extractPreconnectOrigin('blob:https://example.com/abc')).toBeNull());

  it('returns null for non-http schemes', () =>
    expect(extractPreconnectOrigin('rtmp://stream.example.com/live')).toBeNull());

  it('returns null for empty string', () =>
    expect(extractPreconnectOrigin('')).toBeNull());

  it('returns null for non-string', () =>
    expect(extractPreconnectOrigin(42)).toBeNull());

  it('returns null for invalid URL', () =>
    expect(extractPreconnectOrigin('not-a-url')).toBeNull());
});

describe('KNOWN_STREAM_ORIGINS', () => {
  it('is a non-empty frozen array', () => {
    expect(KNOWN_STREAM_ORIGINS.length).toBeGreaterThan(0);
    expect(Object.isFrozen(KNOWN_STREAM_ORIGINS)).toBe(true);
  });

  it('all entries are valid https origins', () => {
    for (const origin of KNOWN_STREAM_ORIGINS) {
      expect(origin).toMatch(/^https:\/\//);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// BEACON PAYLOAD PARSING
// ─────────────────────────────────────────────────────────────────────────

describe('parseBeaconPayload', () => {
  const valid = {
    gameId: 'game-abc',
    sessionIdHash: 'sf-abcdef01',
    score: 87,
    startupMs: 1200,
    rebufferMs: 0,
    playbackMs: 60_000,
    rebufferCount: 0,
    errorCount: 0,
    network: { effectiveType: '4g', downlinkMbps: 20, rttMs: 10, saveData: false },
    ts: 1_700_000_000_000,
  };

  it('returns payload for valid input', () => {
    const p = parseBeaconPayload(valid);
    expect(p).not.toBeNull();
    expect(p!.gameId).toBe('game-abc');
    expect(p!.score).toBe(87);
  });

  it('returns null for null', () => expect(parseBeaconPayload(null)).toBeNull());
  it('returns null for non-object', () => expect(parseBeaconPayload('hello')).toBeNull());
  it('returns null when gameId missing', () => expect(parseBeaconPayload({ ...valid, gameId: '' })).toBeNull());
  it('returns null when sessionIdHash missing', () => expect(parseBeaconPayload({ ...valid, sessionIdHash: '' })).toBeNull());

  it('clamps score to [0, 100]', () => {
    expect(parseBeaconPayload({ ...valid, score: -50 })!.score).toBe(0);
    expect(parseBeaconPayload({ ...valid, score: 999 })!.score).toBe(100);
  });

  it('treats non-finite startupMs as null', () => {
    expect(parseBeaconPayload({ ...valid, startupMs: NaN })!.startupMs).toBeNull();
    expect(parseBeaconPayload({ ...valid, startupMs: null })!.startupMs).toBeNull();
  });

  it('normalizes network inside payload', () => {
    const p = parseBeaconPayload({ ...valid, network: { effectiveType: 'INVALID' } });
    expect(p!.network.effectiveType).toBe('unknown');
  });

  it('truncates gameId to MAX_STRING_LEN', () => {
    const p = parseBeaconPayload({ ...valid, gameId: 'g'.repeat(200) });
    expect(p!.gameId.length).toBe(128);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// BEACON AGGREGATION
// ─────────────────────────────────────────────────────────────────────────

const makeBeacon = (overrides: Partial<ReturnType<typeof makeBeacon>> = {}) => ({
  gameId: 'g1',
  sessionIdHash: 'sf-00000001',
  score: 90,
  startupMs: 1000 as number | null,
  rebufferMs: 0,
  playbackMs: 60_000,
  rebufferCount: 0,
  errorCount: 0,
  network: normalizeNetworkProfile({ effectiveType: '4g', downlinkMbps: 15 }),
  ts: 1_000_000,
  ...overrides,
});

describe('mergeBeaconIntoAggregate', () => {
  it('creates fresh aggregate from null existing', () => {
    const agg = mergeBeaconIntoAggregate(null, makeBeacon());
    expect(agg.samples).toBe(1);
    expect(agg.gameId).toBe('g1');
    expect(agg.sumScore).toBe(90);
    expect(agg.startupSamples).toBe(1);
    expect(agg.sumStartupMs).toBe(1000);
  });

  it('accumulates samples', () => {
    let agg = mergeBeaconIntoAggregate(null, makeBeacon({ ts: 1_000_000 }));
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ ts: 1_010_000 }));
    expect(agg.samples).toBe(2);
    expect(agg.sumScore).toBe(180);
  });

  it('resets window when existing windowStartTs is past the window', () => {
    let agg = mergeBeaconIntoAggregate(null, makeBeacon({ ts: 0 }));
    // Feed a beacon far past the HEALTH_WINDOW_MS
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ ts: HEALTH_WINDOW_MS + 10 }));
    expect(agg.samples).toBe(1); // fresh window
  });

  it('tracks null startupMs correctly (does not count as sample)', () => {
    const agg = mergeBeaconIntoAggregate(null, makeBeacon({ startupMs: null }));
    expect(agg.startupSamples).toBe(0);
    expect(agg.sumStartupMs).toBe(0);
  });

  it('tracks maxStartupMs', () => {
    let agg = mergeBeaconIntoAggregate(null, makeBeacon({ startupMs: 500, ts: 0 }));
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ startupMs: 2000, ts: 1000 }));
    expect(agg.maxStartupMs).toBe(2000);
  });

  it('increments withErrors only when errorCount > 0', () => {
    let agg = mergeBeaconIntoAggregate(null, makeBeacon({ errorCount: 0, ts: 0 }));
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ errorCount: 2, ts: 1000 }));
    expect(agg.withErrors).toBe(1);
  });

  it('increments network counter for effectiveType', () => {
    const agg = mergeBeaconIntoAggregate(null, makeBeacon());
    expect(agg.network['4g']).toBe(1);
  });
});

describe('toHealthReport', () => {
  it('computes avgScore correctly', () => {
    let agg = mergeBeaconIntoAggregate(null, makeBeacon({ score: 80, ts: 0 }));
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ score: 100, ts: 1000 }));
    const r = toHealthReport(agg);
    expect(r.avgScore).toBe(90);
  });

  it('returns null avgStartupMs when no startup samples', () => {
    const agg = mergeBeaconIntoAggregate(null, makeBeacon({ startupMs: null }));
    expect(toHealthReport(agg).avgStartupMs).toBeNull();
  });

  it('computes rebufferRatio', () => {
    const agg = mergeBeaconIntoAggregate(
      null,
      makeBeacon({ rebufferMs: 1000, playbackMs: 9000 }),
    );
    const r = toHealthReport(agg);
    expect(r.rebufferRatio).toBeCloseTo(0.1, 4);
  });

  it('computes errorRate', () => {
    let agg = mergeBeaconIntoAggregate(null, makeBeacon({ errorCount: 0, ts: 0 }));
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ errorCount: 1, ts: 1000 }));
    expect(toHealthReport(agg).errorRate).toBe(0.5);
  });

  it('returns maxStartupMs null when zero', () => {
    const agg = emptyAggregate('g', 0);
    expect(toHealthReport(agg).maxStartupMs).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// INTEGRATION: full session scenario
// ─────────────────────────────────────────────────────────────────────────

describe('full session scenario', () => {
  it('models a clean playback session correctly', () => {
    let s = initQoeSnapshot('viewer-1', 0);

    // Player mounts, then starts playing quickly (1.5 s startup)
    s = applyQoeEvent(s, { kind: 'mount', ts: 0 });
    s = applyQoeEvent(s, { kind: 'play', ts: 100 });
    s = applyQoeEvent(s, { kind: 'playing', ts: 1500 });

    // Smooth playback for 30s
    for (let t = 16_500; t <= 31_500; t += 15_000) {
      s = applyQoeEvent(s, { kind: 'heartbeat', ts: t });
    }

    // Brief rebuffer of 2s
    s = applyQoeEvent(s, { kind: 'waiting', ts: 31_500 });
    s = applyQoeEvent(s, { kind: 'playing', ts: 33_500 });

    // More playback
    s = applyQoeEvent(s, { kind: 'heartbeat', ts: 48_500 });
    s = applyQoeEvent(s, { kind: 'ended', ts: 48_500 });

    const h = computeHealthScore(s);
    // Startup under budget → no penalty
    expect(h.startupPenalty).toBe(0);
    // Rebuffer: 2s / (30s + 2s) ≈ 6.25% — over the 2% budget
    expect(h.rebufferPenalty).toBeGreaterThan(0);
    // No errors
    expect(h.errorPenalty).toBe(0);
    // Score should still be healthy (> 50)
    expect(h.score).toBeGreaterThan(50);
    // Counts
    expect(s.rebufferCount).toBe(1);
    expect(s.rebufferMs).toBe(2000);
    expect(s.firstPlayTs).toBe(1500);
  });
});
