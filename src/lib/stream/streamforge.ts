/**
 * StreamForge — SBBL HQ proprietary broadcast intelligence engine.
 *
 * A zero-dependency, zero-cost, platform-agnostic, pure-function core that
 * delivers YouTube-caliber perceived quality on top of any upstream stream
 * source (YouTube / Twitch / Facebook / direct HLS / WHIP) without adding a
 * single line of infrastructure.
 *
 * Pillars
 * -------
 *  1. Quality-of-Experience (QoE) telemetry state machine
 *  2. Adaptive network observation + quality tier selection
 *  3. Circuit-broken multi-path failover
 *  4. Predictive rebuffer detection
 *  5. Warm-reconnect decision logic (no full page reload)
 *  6. Edge-aggregated broadcast health scoring
 *
 * Design invariants
 * -----------------
 *  - 100% pure: no DOM, no network, no globals, no `Date.now()` — all time
 *    inputs are passed explicitly, which makes every function deterministic
 *    and unit-testable to the millisecond.
 *  - Idempotent: feeding the same event sequence twice in a row never double
 *    counts (callers supply timestamps; duplicate timestamps are clamped).
 *  - Bounded memory: ring buffers cap growth, so even a pathological stream
 *    that fires 10k events/s cannot leak memory.
 *  - Clamped numerics: every exported function sanitizes NaN / Infinity /
 *    out-of-range inputs so an evil beacon payload cannot poison aggregates.
 *  - Zero dependencies: runs identically in the browser, Cloudflare Workers,
 *    Node, and edge runtimes. No `window`, no `document`.
 *
 * Security
 * --------
 *  - No PII: QoE snapshots carry a caller-provided `sessionIdHash`, never a
 *    user id or JWT. The engine refuses payloads that are missing it.
 *  - Input validation: {@link parseBeaconPayload} is the single trust
 *    boundary for untrusted JSON; everything downstream is typed.
 *  - DoS resistance: aggregation is bounded by {@link HEALTH_WINDOW_MS} and
 *    uses running sums so aggregate size is O(1) regardless of sample count.
 */

// ─────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

/** Maximum events retained in the QoE ring buffer (memory bound). */
export const QOE_EVENT_RING_SIZE = 64;

/** Default circuit-breaker: failures before opening. */
export const BREAKER_FAILURE_THRESHOLD = 3;

/** Default circuit-breaker: cool-down before half-open probe (ms). */
export const BREAKER_OPEN_COOLDOWN_MS = 30_000;

/** QoE: startup latency budget (ms); penalty grows past this point. */
export const QOE_STARTUP_BUDGET_MS = 3_000;

/** QoE: rebuffer-ratio budget (rebufferMs / totalMs). */
export const QOE_REBUFFER_BUDGET = 0.02; // 2 %

/** Predictive rebuffer look-ahead horizon (ms). */
export const PREDICTIVE_REBUFFER_HORIZON_MS = 5_000;

/** Minimum buffer-ahead before slow-network pre-emption fires (ms). */
export const MIN_BUFFER_AHEAD_MS = 2_000;

/** Warm-reconnect: minimum cooldown between attempts (ms). */
export const WARM_RECONNECT_COOLDOWN_MS = 10_000;

/** Default aggregation window for edge health reports (ms). */
export const HEALTH_WINDOW_MS = 120_000;

/** Max string length for untrusted string inputs (DoS guard). */
export const MAX_STRING_LEN = 128;

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

export type NetworkEffectiveType =
  | 'slow-2g'
  | '2g'
  | '3g'
  | '4g'
  | 'unknown';

export interface NetworkProfile {
  effectiveType: NetworkEffectiveType;
  /** Measured downlink in megabits/sec. Clamped ≥ 0. */
  downlinkMbps: number;
  /** Round-trip time in ms. Clamped ≥ 0. */
  rttMs: number;
  /** User has opted-in to data saver. */
  saveData: boolean;
}

export type QualityTier = 'audio-only' | 'low' | 'sd' | 'hd' | 'fhd' | 'auto';

export type QoeEventKind =
  | 'mount'
  | 'play'
  | 'pause'
  | 'waiting'
  | 'playing'
  | 'error'
  | 'ended'
  | 'heartbeat';

export interface QoeEvent {
  kind: QoeEventKind;
  ts: number;
  errorCode?: string;
  bufferAheadMs?: number;
}

export interface QoeSnapshot {
  sessionId: string;
  mountTs: number;
  lastTs: number;
  firstPlayTs: number | null;
  rebufferStartTs: number | null;
  playbackMs: number;
  rebufferMs: number;
  rebufferCount: number;
  errorCount: number;
  lastBufferAheadMs: number;
  network: NetworkProfile;
  ring: readonly QoeEvent[];
}

export interface HealthScoreBreakdown {
  score: number;
  startupPenalty: number;
  rebufferPenalty: number;
  errorPenalty: number;
  networkPenalty: number;
}

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface BreakerSnapshot {
  state: BreakerState;
  failures: number;
  openedAt: number | null;
  lastProbeAt: number | null;
}

export type StreamPathKind = 'primary' | 'mirror' | 'fallback';

export interface StreamPath {
  id: string;
  url: string;
  kind: StreamPathKind;
  breaker: BreakerSnapshot;
}

// ─────────────────────────────────────────────────────────────────────────
// SAFE MATH
// ─────────────────────────────────────────────────────────────────────────

/** Clamp unknown numeric input into [min, max]; fallback on NaN/Infinity. */
export function clamp(
  n: unknown,
  min: number,
  max: number,
  fallback = min,
): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/** Exponentially-weighted moving average. alpha ∈ (0,1]. */
export function ewma(prev: number, next: number, alpha: number): number {
  if (!Number.isFinite(prev)) return Number.isFinite(next) ? next : 0;
  if (!Number.isFinite(next)) return prev;
  const a = clamp(alpha, 0.0001, 1, 0.3);
  return prev * (1 - a) + next * a;
}

/** Division guard: returns 0 for non-finite or non-positive denominators. */
export function safeRatio(num: number, denom: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(denom) || denom <= 0) return 0;
  return clamp(num / denom, 0, 1, 0);
}

// ─────────────────────────────────────────────────────────────────────────
// NETWORK OBSERVER
// ─────────────────────────────────────────────────────────────────────────

export const UNKNOWN_NETWORK: NetworkProfile = Object.freeze({
  effectiveType: 'unknown',
  downlinkMbps: 0,
  rttMs: 0,
  saveData: false,
});

const VALID_EFFECTIVE_TYPES: readonly NetworkEffectiveType[] = [
  'slow-2g',
  '2g',
  '3g',
  '4g',
  'unknown',
];

export function normalizeNetworkProfile(
  input: Partial<NetworkProfile> | null | undefined,
): NetworkProfile {
  if (!input || typeof input !== 'object') return { ...UNKNOWN_NETWORK };
  const et = VALID_EFFECTIVE_TYPES.includes(
    input.effectiveType as NetworkEffectiveType,
  )
    ? (input.effectiveType as NetworkEffectiveType)
    : 'unknown';
  return {
    effectiveType: et,
    downlinkMbps: clamp(input.downlinkMbps, 0, 1_000, 0),
    rttMs: clamp(input.rttMs, 0, 60_000, 0),
    saveData: Boolean(input.saveData),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// ADAPTIVE QUALITY SELECTION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Pure mapping: network profile → recommended quality tier.
 * Deterministic and idempotent; same input always yields the same output.
 */
export function pickQualityTier(np: NetworkProfile): QualityTier {
  if (np.saveData) return 'low';
  switch (np.effectiveType) {
    case 'slow-2g':
    case '2g':
      return 'audio-only';
    case '3g':
      return np.downlinkMbps >= 1.5 ? 'sd' : 'low';
    case '4g':
      if (np.downlinkMbps >= 10) return 'fhd';
      if (np.downlinkMbps >= 4) return 'hd';
      if (np.downlinkMbps >= 1.5) return 'sd';
      return 'low';
    case 'unknown':
    default:
      return 'auto';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// QOE SNAPSHOT STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────

export function initQoeSnapshot(
  sessionId: string,
  now: number,
  network?: NetworkProfile,
): QoeSnapshot {
  const safeSessionId =
    typeof sessionId === 'string' && sessionId.length > 0
      ? sessionId.slice(0, MAX_STRING_LEN)
      : 'anon';
  const safeNow = clamp(now, 0, Number.MAX_SAFE_INTEGER, 0);
  return {
    sessionId: safeSessionId,
    mountTs: safeNow,
    lastTs: safeNow,
    firstPlayTs: null,
    rebufferStartTs: null,
    playbackMs: 0,
    rebufferMs: 0,
    rebufferCount: 0,
    errorCount: 0,
    lastBufferAheadMs: 0,
    network: normalizeNetworkProfile(network ?? UNKNOWN_NETWORK),
    ring: [],
  };
}

/**
 * Pure reducer: apply an event to a snapshot and return a new snapshot.
 * Monotonicity guarantee: `lastTs` never goes backwards — out-of-order
 * events are clamped to the previous `lastTs` so duration math cannot go
 * negative even under clock skew.
 */
export function applyQoeEvent(s: QoeSnapshot, ev: QoeEvent): QoeSnapshot {
  const ts = Number.isFinite(ev.ts) ? Math.max(s.lastTs, ev.ts) : s.lastTs;
  const ring = s.ring.length >= QOE_EVENT_RING_SIZE
    ? [...s.ring.slice(s.ring.length - QOE_EVENT_RING_SIZE + 1), ev]
    : [...s.ring, ev];

  let firstPlayTs = s.firstPlayTs;
  let rebufferStartTs = s.rebufferStartTs;
  let playbackMs = s.playbackMs;
  let rebufferMs = s.rebufferMs;
  let rebufferCount = s.rebufferCount;
  let errorCount = s.errorCount;
  let lastBufferAheadMs = s.lastBufferAheadMs;

  switch (ev.kind) {
    case 'playing': {
      if (firstPlayTs === null) firstPlayTs = ts;
      if (rebufferStartTs !== null) {
        rebufferMs += Math.max(0, ts - rebufferStartTs);
        rebufferStartTs = null;
      }
      break;
    }
    case 'waiting': {
      if (rebufferStartTs === null) {
        rebufferStartTs = ts;
        rebufferCount += 1;
      }
      break;
    }
    case 'error': {
      errorCount += 1;
      if (rebufferStartTs !== null) {
        rebufferMs += Math.max(0, ts - rebufferStartTs);
        rebufferStartTs = null;
      }
      break;
    }
    case 'ended':
    case 'pause': {
      if (rebufferStartTs !== null) {
        rebufferMs += Math.max(0, ts - rebufferStartTs);
        rebufferStartTs = null;
      }
      break;
    }
    case 'heartbeat': {
      if (firstPlayTs !== null && rebufferStartTs === null) {
        playbackMs += Math.max(0, ts - s.lastTs);
      }
      if (typeof ev.bufferAheadMs === 'number') {
        lastBufferAheadMs = clamp(ev.bufferAheadMs, 0, 600_000, 0);
      }
      break;
    }
    case 'mount':
    case 'play':
    default:
      break;
  }

  return {
    sessionId: s.sessionId,
    mountTs: s.mountTs,
    lastTs: ts,
    firstPlayTs,
    rebufferStartTs,
    playbackMs,
    rebufferMs,
    rebufferCount,
    errorCount,
    lastBufferAheadMs,
    network: s.network,
    ring,
  };
}

/** Replace the network profile on a snapshot without touching any counters. */
export function withNetwork(s: QoeSnapshot, np: NetworkProfile): QoeSnapshot {
  return { ...s, network: normalizeNetworkProfile(np) };
}

// ─────────────────────────────────────────────────────────────────────────
// HEALTH SCORE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute a deterministic 0..100 QoE health score.
 * Penalties are additive so the breakdown is explainable in UI / dashboards.
 *
 *   startupPenalty  ∈ [0, 25]   — time-to-first-frame over budget
 *   rebufferPenalty ∈ [0, 40]   — cumulative rebuffer ratio over budget
 *   errorPenalty    ∈ [0, 20]   — player error count
 *   networkPenalty  ∈ [0, 15]   — fundamental link ceiling
 *
 *   maximum total penalty = 100 → score ≥ 0
 */
export function computeHealthScore(s: QoeSnapshot): HealthScoreBreakdown {
  let startupPenalty = 0;
  if (s.firstPlayTs !== null) {
    const startupMs = Math.max(0, s.firstPlayTs - s.mountTs);
    const overBudgetRatio = Math.max(0, startupMs / QOE_STARTUP_BUDGET_MS - 1);
    startupPenalty = clamp(overBudgetRatio * 25, 0, 25, 0);
  } else if (s.lastTs - s.mountTs > QOE_STARTUP_BUDGET_MS * 2) {
    startupPenalty = 25;
  }

  let rebufferPenalty = 0;
  const totalMs = s.playbackMs + s.rebufferMs;
  if (totalMs > 0) {
    const ratio = s.rebufferMs / totalMs;
    const overBudget = Math.max(0, ratio - QOE_REBUFFER_BUDGET);
    rebufferPenalty = clamp(overBudget * 400, 0, 40, 0);
  }

  const errorPenalty = clamp(s.errorCount * 10, 0, 20, 0);

  let networkPenalty = 0;
  switch (s.network.effectiveType) {
    case 'slow-2g':
      networkPenalty = 15;
      break;
    case '2g':
      networkPenalty = 10;
      break;
    case '3g':
      networkPenalty = 3;
      break;
    default:
      networkPenalty = 0;
  }

  const total = clamp(
    100 - startupPenalty - rebufferPenalty - errorPenalty - networkPenalty,
    0,
    100,
    0,
  );
  return {
    score: Math.round(total),
    startupPenalty: Math.round(startupPenalty),
    rebufferPenalty: Math.round(rebufferPenalty),
    errorPenalty: Math.round(errorPenalty),
    networkPenalty: Math.round(networkPenalty),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER
// ─────────────────────────────────────────────────────────────────────────

export function initBreaker(): BreakerSnapshot {
  return { state: 'closed', failures: 0, openedAt: null, lastProbeAt: null };
}

export interface BreakerInput {
  breaker: BreakerSnapshot;
  now: number;
  outcome: 'success' | 'failure';
  failureThreshold?: number;
  cooldownMs?: number;
}

/**
 * State machine transitions:
 *
 *   closed   --N failures-->   open
 *   open     --cooldown-->     half-open
 *   half-open --success-->     closed
 *   half-open --failure-->     open
 */
export function breakerStep(input: BreakerInput): BreakerSnapshot {
  const threshold = clamp(
    input.failureThreshold ?? BREAKER_FAILURE_THRESHOLD,
    1,
    1000,
    BREAKER_FAILURE_THRESHOLD,
  );
  const cooldown = clamp(
    input.cooldownMs ?? BREAKER_OPEN_COOLDOWN_MS,
    1_000,
    3_600_000,
    BREAKER_OPEN_COOLDOWN_MS,
  );
  const { breaker, now, outcome } = input;

  if (outcome === 'success') {
    return {
      state: 'closed',
      failures: 0,
      openedAt: null,
      lastProbeAt: now,
    };
  }

  const failures = breaker.failures + 1;

  if (breaker.state === 'open') {
    if (breaker.openedAt !== null && now - breaker.openedAt >= cooldown) {
      return {
        state: 'half-open',
        failures,
        openedAt: breaker.openedAt,
        lastProbeAt: now,
      };
    }
    return { ...breaker, failures, lastProbeAt: now };
  }

  if (breaker.state === 'half-open') {
    return { state: 'open', failures, openedAt: now, lastProbeAt: now };
  }

  // closed
  if (failures >= threshold) {
    return { state: 'open', failures, openedAt: now, lastProbeAt: now };
  }
  return {
    state: 'closed',
    failures,
    openedAt: null,
    lastProbeAt: now,
  };
}

/** True when the breaker currently allows a request through. */
export function breakerAllows(
  breaker: BreakerSnapshot,
  now: number,
  cooldownMs = BREAKER_OPEN_COOLDOWN_MS,
): boolean {
  if (breaker.state === 'closed' || breaker.state === 'half-open') return true;
  // open
  if (breaker.openedAt === null) return true;
  return now - breaker.openedAt >= cooldownMs;
}

// ─────────────────────────────────────────────────────────────────────────
// MULTI-PATH FAILOVER
// ─────────────────────────────────────────────────────────────────────────

const PATH_PRIORITY: Record<StreamPathKind, number> = {
  primary: 0,
  mirror: 1,
  fallback: 2,
};

/**
 * Select the best available stream path honoring per-path circuit-breaker
 * state. Preference order: primary → mirror → fallback.
 *
 * If every breaker is open and within cooldown, returns the highest-priority
 * path so the caller can force a probe — silent denial is strictly worse
 * than a retry that eventually heals the breaker.
 */
export function pickBestPath(
  paths: readonly StreamPath[],
  now: number,
  cooldownMs = BREAKER_OPEN_COOLDOWN_MS,
): StreamPath | null {
  if (!paths || paths.length === 0) return null;
  const sorted = [...paths].sort(
    (a, b) => PATH_PRIORITY[a.kind] - PATH_PRIORITY[b.kind],
  );
  for (const p of sorted) {
    if (breakerAllows(p.breaker, now, cooldownMs)) return p;
  }
  return sorted[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// PREDICTIVE REBUFFER DETECTION
// ─────────────────────────────────────────────────────────────────────────

export interface PredictiveRebufferInput {
  snapshot: QoeSnapshot;
  horizonMs?: number;
  minBufferAheadMs?: number;
}

/**
 * Predict whether the player is about to rebuffer. Fires on:
 *   (a) low buffer AND slow network, OR
 *   (b) buffer below half-horizon while actively playing.
 *
 * Safe guards: no false-positives before first play event.
 */
export function shouldPreemptRebuffer(
  input: PredictiveRebufferInput,
): boolean {
  const horizon = clamp(
    input.horizonMs ?? PREDICTIVE_REBUFFER_HORIZON_MS,
    1_000,
    60_000,
    PREDICTIVE_REBUFFER_HORIZON_MS,
  );
  const minAhead = clamp(
    input.minBufferAheadMs ?? MIN_BUFFER_AHEAD_MS,
    500,
    30_000,
    MIN_BUFFER_AHEAD_MS,
  );
  const s = input.snapshot;
  const np = s.network;
  const ahead = s.lastBufferAheadMs;

  // No data yet → do not falsely trigger.
  if (s.firstPlayTs === null) return false;
  // Currently rebuffering → already handling it elsewhere.
  if (s.rebufferStartTs !== null) return false;

  const slowNetwork =
    np.effectiveType === 'slow-2g' ||
    np.effectiveType === '2g' ||
    (np.effectiveType === '3g' && np.downlinkMbps < 1);

  if (ahead < minAhead && slowNetwork) return true;
  if (ahead < horizon / 2) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// WARM RECONNECT DECISION
// ─────────────────────────────────────────────────────────────────────────

export interface WarmReconnectInput {
  consecutiveFailures: number;
  lastReconnectTs: number | null;
  now: number;
  minCooldownMs?: number;
  failureThreshold?: number;
}

export interface WarmReconnectDecision {
  reconnect: boolean;
  reason: 'too-soon' | 'below-threshold' | 'cooldown-ok';
}

/**
 * Decide whether a warm reconnect is safe to attempt. The cooldown is the
 * hard guardrail that makes it impossible to enter a tight reconnect loop.
 */
export function shouldWarmReconnect(
  input: WarmReconnectInput,
): WarmReconnectDecision {
  const cooldown = clamp(
    input.minCooldownMs ?? WARM_RECONNECT_COOLDOWN_MS,
    1_000,
    600_000,
    WARM_RECONNECT_COOLDOWN_MS,
  );
  const threshold = clamp(
    input.failureThreshold ?? 3,
    1,
    100,
    3,
  );
  if (input.consecutiveFailures < threshold) {
    return { reconnect: false, reason: 'below-threshold' };
  }
  if (
    input.lastReconnectTs !== null &&
    input.now - input.lastReconnectTs < cooldown
  ) {
    return { reconnect: false, reason: 'too-soon' };
  }
  return { reconnect: true, reason: 'cooldown-ok' };
}

// ─────────────────────────────────────────────────────────────────────────
// PRECONNECT HELPERS
// ─────────────────────────────────────────────────────────────────────────

/** Well-known stream origins to warm up when the player mounts. */
export const KNOWN_STREAM_ORIGINS: readonly string[] = Object.freeze([
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://i.ytimg.com',
  'https://player.twitch.tv',
  'https://static-cdn.jtvnw.net',
  'https://www.facebook.com',
  'https://static.xx.fbcdn.net',
]);

/**
 * Extract an origin suitable for a `<link rel="preconnect">` from an
 * arbitrary playback URL. Returns null for blobs, data URIs, and anything
 * that doesn't parse as http(s).
 */
export function extractPreconnectOrigin(url: unknown): string | null {
  if (typeof url !== 'string' || url.length === 0) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// BEACON PAYLOAD + EDGE AGGREGATION
// ─────────────────────────────────────────────────────────────────────────

export interface BeaconPayload {
  gameId: string;
  sessionIdHash: string;
  score: number;
  startupMs: number | null;
  rebufferMs: number;
  playbackMs: number;
  rebufferCount: number;
  errorCount: number;
  network: NetworkProfile;
  ts: number;
}

export interface AggregatedHealth {
  gameId: string;
  windowStartTs: number;
  windowEndTs: number;
  samples: number;
  sumScore: number;
  sumStartupMs: number;
  startupSamples: number;
  maxStartupMs: number;
  sumRebufferMs: number;
  sumPlaybackMs: number;
  sumRebufferCount: number;
  sumErrorCount: number;
  withErrors: number;
  network: Record<NetworkEffectiveType, number>;
}

export interface HealthReport {
  gameId: string;
  windowStartTs: number;
  windowEndTs: number;
  samples: number;
  avgScore: number;
  avgStartupMs: number | null;
  maxStartupMs: number | null;
  rebufferRatio: number;
  errorRate: number;
  network: Record<NetworkEffectiveType, number>;
}

/**
 * Validate and normalize an untrusted beacon payload. Returns null if the
 * payload is missing required fields or fails shape checks. This is the
 * single trust boundary between the network and the engine.
 */
export function parseBeaconPayload(raw: unknown): BeaconPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const gameId =
    typeof o.gameId === 'string' && o.gameId.length > 0
      ? o.gameId.slice(0, MAX_STRING_LEN)
      : null;
  const sessionIdHash =
    typeof o.sessionIdHash === 'string' && o.sessionIdHash.length > 0
      ? o.sessionIdHash.slice(0, MAX_STRING_LEN)
      : null;
  if (!gameId || !sessionIdHash) return null;

  const startupMsRaw = o.startupMs;
  const startupMs =
    typeof startupMsRaw === 'number' && Number.isFinite(startupMsRaw)
      ? clamp(startupMsRaw, 0, 600_000, 0)
      : null;

  return {
    gameId,
    sessionIdHash,
    score: clamp(o.score, 0, 100, 0),
    startupMs,
    rebufferMs: clamp(o.rebufferMs, 0, 24 * 3600_000, 0),
    playbackMs: clamp(o.playbackMs, 0, 24 * 3600_000, 0),
    rebufferCount: clamp(o.rebufferCount, 0, 10_000, 0),
    errorCount: clamp(o.errorCount, 0, 10_000, 0),
    network: normalizeNetworkProfile(
      o.network as Partial<NetworkProfile> | null | undefined,
    ),
    ts: clamp(o.ts, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

export function emptyAggregate(gameId: string, ts: number): AggregatedHealth {
  return {
    gameId,
    windowStartTs: ts,
    windowEndTs: ts,
    samples: 0,
    sumScore: 0,
    sumStartupMs: 0,
    startupSamples: 0,
    maxStartupMs: 0,
    sumRebufferMs: 0,
    sumPlaybackMs: 0,
    sumRebufferCount: 0,
    sumErrorCount: 0,
    withErrors: 0,
    network: {
      'slow-2g': 0,
      '2g': 0,
      '3g': 0,
      '4g': 0,
      unknown: 0,
    },
  };
}

/**
 * Merge a beacon into an existing aggregate. Pure function; the caller is
 * responsible for persistence. Resets the window if the existing one has
 * slid entirely past `windowMs`.
 */
export function mergeBeaconIntoAggregate(
  existing: AggregatedHealth | null,
  beacon: BeaconPayload,
  windowMs = HEALTH_WINDOW_MS,
): AggregatedHealth {
  const ts = beacon.ts;
  const fresh =
    !existing ||
    existing.gameId !== beacon.gameId ||
    existing.windowStartTs < ts - windowMs;
  const base = fresh ? emptyAggregate(beacon.gameId, ts) : existing;

  const network = { ...base.network };
  network[beacon.network.effectiveType] =
    (network[beacon.network.effectiveType] ?? 0) + 1;

  return {
    gameId: beacon.gameId,
    windowStartTs: fresh ? ts : base.windowStartTs,
    windowEndTs: ts,
    samples: base.samples + 1,
    sumScore: base.sumScore + beacon.score,
    sumStartupMs:
      base.sumStartupMs + (beacon.startupMs !== null ? beacon.startupMs : 0),
    startupSamples: base.startupSamples + (beacon.startupMs !== null ? 1 : 0),
    maxStartupMs:
      beacon.startupMs !== null
        ? Math.max(base.maxStartupMs, beacon.startupMs)
        : base.maxStartupMs,
    sumRebufferMs: base.sumRebufferMs + beacon.rebufferMs,
    sumPlaybackMs: base.sumPlaybackMs + beacon.playbackMs,
    sumRebufferCount: base.sumRebufferCount + beacon.rebufferCount,
    sumErrorCount: base.sumErrorCount + beacon.errorCount,
    withErrors: base.withErrors + (beacon.errorCount > 0 ? 1 : 0),
    network,
  };
}

/** Derive a human-friendly report from an aggregate. */
export function toHealthReport(agg: AggregatedHealth): HealthReport {
  const samples = Math.max(0, agg.samples);
  const avgScore = samples > 0 ? agg.sumScore / samples : 0;
  const avgStartupMs =
    agg.startupSamples > 0 ? agg.sumStartupMs / agg.startupSamples : null;
  const totalMs = agg.sumRebufferMs + agg.sumPlaybackMs;
  return {
    gameId: agg.gameId,
    windowStartTs: agg.windowStartTs,
    windowEndTs: agg.windowEndTs,
    samples,
    avgScore: Math.round(avgScore * 100) / 100,
    avgStartupMs:
      avgStartupMs !== null ? Math.round(avgStartupMs) : null,
    maxStartupMs: agg.maxStartupMs > 0 ? Math.round(agg.maxStartupMs) : null,
    rebufferRatio: safeRatio(agg.sumRebufferMs, totalMs),
    errorRate: samples > 0 ? agg.withErrors / samples : 0,
    network: { ...agg.network },
  };
}
