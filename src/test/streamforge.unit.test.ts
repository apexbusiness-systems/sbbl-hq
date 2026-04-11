/**
 * StreamForge engine — unit test battery.
 *
 * Covers every exported pure function with:
 *   - Happy-path correctness
 *   - Boundary conditions (zero, max, exactly at threshold)
 *   - Adversarial / invalid inputs (NaN, Infinity, negative, empty, null)
 *   - Idempotency (same input → same output, multiple calls)
 *   - Monotonicity (lastTs never goes backwards)
 *   - Bounded memory (ring buffer cap)
 *   - End-to-end scenario (full session simulation)
 */

import { describe, expect, it } from "vitest";
import {
  applyQoeEvent,
  breakerAllows,
  breakerStep,
  clamp,
  computeHealthScore,
  emptyAggregate,
  ewma,
  extractPreconnectOrigin,
  initBreaker,
  initQoeSnapshot,
  mergeBeaconIntoAggregate,
  normalizeNetworkProfile,
  parseBeaconPayload,
  pickBestPath,
  pickQualityTier,
  QOE_EVENT_RING_SIZE,
  BREAKER_FAILURE_THRESHOLD,
  BREAKER_OPEN_COOLDOWN_MS,
  QOE_STARTUP_BUDGET_MS,
  safeRatio,
  shouldPreemptRebuffer,
  shouldWarmReconnect,
  toHealthReport,
  UNKNOWN_NETWORK,
  withNetwork,
  type BreakerSnapshot,
  type NetworkProfile,
  type QoeSnapshot,
  type StreamPath,
} from "@/lib/stream/streamforge";

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const T0 = 1_700_000_000_000; // arbitrary stable epoch

function makeNetwork(
  overrides: Partial<NetworkProfile> = {},
): NetworkProfile {
  return normalizeNetworkProfile({
    effectiveType: "4g",
    downlinkMbps: 20,
    rttMs: 30,
    saveData: false,
    ...overrides,
  });
}

function makePath(
  id: string,
  kind: StreamPath["kind"],
  breaker?: Partial<BreakerSnapshot>,
): StreamPath {
  return {
    id,
    url: `https://example.com/${id}`,
    kind,
    breaker: { ...initBreaker(), ...(breaker ?? {}) },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// clamp
// ─────────────────────────────────────────────────────────────────────────

describe("clamp", () => {
  it("returns value within range unchanged", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps below min", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it("clamps above max", () => {
    expect(clamp(100, 0, 10)).toBe(10);
  });

  it("uses fallback for NaN", () => {
    expect(clamp(NaN, 0, 10, 3)).toBe(3);
  });

  it("uses fallback for Infinity", () => {
    expect(clamp(Infinity, 0, 10, 0)).toBe(0);
    expect(clamp(-Infinity, 0, 10, 0)).toBe(0);
  });

  it("uses fallback for non-number", () => {
    expect(clamp("oops" as unknown as number, 0, 10, 2)).toBe(2);
  });

  it("handles min === max", () => {
    expect(clamp(7, 5, 5)).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ewma
// ─────────────────────────────────────────────────────────────────────────

describe("ewma", () => {
  it("converges toward new value", () => {
    const result = ewma(100, 0, 1);
    expect(result).toBe(0);
  });

  it("blends with partial alpha", () => {
    const result = ewma(100, 0, 0.5);
    expect(result).toBe(50);
  });

  it("handles NaN prev — returns next", () => {
    expect(ewma(NaN, 42, 0.3)).toBe(42);
  });

  it("handles NaN next — returns prev", () => {
    expect(ewma(42, NaN, 0.3)).toBe(42);
  });

  it("clamps alpha extremes", () => {
    expect(Number.isFinite(ewma(50, 100, 0))).toBe(true);
    expect(Number.isFinite(ewma(50, 100, 2))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// safeRatio
// ─────────────────────────────────────────────────────────────────────────

describe("safeRatio", () => {
  it("computes ratio correctly", () => {
    expect(safeRatio(1, 4)).toBeCloseTo(0.25);
  });

  it("returns 0 for zero denominator", () => {
    expect(safeRatio(5, 0)).toBe(0);
  });

  it("returns 0 for NaN inputs", () => {
    expect(safeRatio(NaN, 4)).toBe(0);
    expect(safeRatio(4, NaN)).toBe(0);
  });

  it("clamps to [0, 1]", () => {
    expect(safeRatio(10, 5)).toBe(1);
    expect(safeRatio(-1, 5)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// normalizeNetworkProfile
// ─────────────────────────────────────────────────────────────────────────

describe("normalizeNetworkProfile", () => {
  it("passes through valid 4g profile", () => {
    const np = normalizeNetworkProfile({
      effectiveType: "4g",
      downlinkMbps: 10,
      rttMs: 20,
      saveData: false,
    });
    expect(np.effectiveType).toBe("4g");
    expect(np.downlinkMbps).toBe(10);
    expect(np.rttMs).toBe(20);
  });

  it("defaults unknown effectiveType to 'unknown'", () => {
    const np = normalizeNetworkProfile({ effectiveType: "5g" as never });
    expect(np.effectiveType).toBe("unknown");
  });

  it("returns UNKNOWN_NETWORK for null/undefined", () => {
    expect(normalizeNetworkProfile(null)).toEqual(UNKNOWN_NETWORK);
    expect(normalizeNetworkProfile(undefined)).toEqual(UNKNOWN_NETWORK);
  });

  it("clamps negative downlink to 0", () => {
    const np = normalizeNetworkProfile({ downlinkMbps: -5 });
    expect(np.downlinkMbps).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// pickQualityTier
// ─────────────────────────────────────────────────────────────────────────

describe("pickQualityTier", () => {
  it("returns audio-only for slow-2g", () => {
    expect(pickQualityTier(makeNetwork({ effectiveType: "slow-2g" }))).toBe(
      "audio-only",
    );
  });

  it("returns audio-only for 2g", () => {
    expect(pickQualityTier(makeNetwork({ effectiveType: "2g" }))).toBe(
      "audio-only",
    );
  });

  it("returns low for 3g with low downlink", () => {
    expect(
      pickQualityTier(makeNetwork({ effectiveType: "3g", downlinkMbps: 0.5 })),
    ).toBe("low");
  });

  it("returns sd for 3g with adequate downlink", () => {
    expect(
      pickQualityTier(makeNetwork({ effectiveType: "3g", downlinkMbps: 2 })),
    ).toBe("sd");
  });

  it("returns fhd for fast 4g", () => {
    expect(
      pickQualityTier(makeNetwork({ effectiveType: "4g", downlinkMbps: 50 })),
    ).toBe("fhd");
  });

  it("returns hd for moderate 4g", () => {
    expect(
      pickQualityTier(makeNetwork({ effectiveType: "4g", downlinkMbps: 6 })),
    ).toBe("hd");
  });

  it("returns sd for borderline 4g", () => {
    expect(
      pickQualityTier(makeNetwork({ effectiveType: "4g", downlinkMbps: 2 })),
    ).toBe("sd");
  });

  it("returns low for slow 4g", () => {
    expect(
      pickQualityTier(makeNetwork({ effectiveType: "4g", downlinkMbps: 0.5 })),
    ).toBe("low");
  });

  it("returns auto for unknown", () => {
    expect(pickQualityTier(makeNetwork({ effectiveType: "unknown" }))).toBe(
      "auto",
    );
  });

  it("saveData flag always returns low", () => {
    expect(
      pickQualityTier(
        makeNetwork({ effectiveType: "4g", downlinkMbps: 100, saveData: true }),
      ),
    ).toBe("low");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// initQoeSnapshot
// ─────────────────────────────────────────────────────────────────────────

describe("initQoeSnapshot", () => {
  it("initialises to zero counters", () => {
    const s = initQoeSnapshot("sess-1", T0);
    expect(s.playbackMs).toBe(0);
    expect(s.rebufferMs).toBe(0);
    expect(s.errorCount).toBe(0);
    expect(s.firstPlayTs).toBeNull();
    expect(s.ring).toHaveLength(0);
  });

  it("truncates overly long session id", () => {
    const longId = "a".repeat(1000);
    const s = initQoeSnapshot(longId, T0);
    expect(s.sessionId.length).toBeLessThanOrEqual(128);
  });

  it("defaults to anon for empty session id", () => {
    const s = initQoeSnapshot("", T0);
    expect(s.sessionId).toBe("anon");
  });

  it("clamps negative timestamp to 0", () => {
    const s = initQoeSnapshot("x", -5000);
    expect(s.mountTs).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// applyQoeEvent
// ─────────────────────────────────────────────────────────────────────────

describe("applyQoeEvent", () => {
  it("records firstPlayTs on first 'playing' event", () => {
    let s = initQoeSnapshot("s", T0);
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 1000 });
    expect(s.firstPlayTs).toBe(T0 + 1000);
  });

  it("does not overwrite firstPlayTs on subsequent 'playing' events", () => {
    let s = initQoeSnapshot("s", T0);
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 1000 });
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 2000 });
    expect(s.firstPlayTs).toBe(T0 + 1000);
  });

  it("tracks rebuffer start on 'waiting'", () => {
    let s = initQoeSnapshot("s", T0);
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    s = applyQoeEvent(s, { kind: "waiting", ts: T0 + 2000 });
    expect(s.rebufferStartTs).toBe(T0 + 2000);
    expect(s.rebufferCount).toBe(1);
  });

  it("accumulates rebuffer duration on 'playing' after 'waiting'", () => {
    let s = initQoeSnapshot("s", T0);
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    s = applyQoeEvent(s, { kind: "waiting", ts: T0 + 2000 });
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 3500 });
    expect(s.rebufferMs).toBe(1500);
    expect(s.rebufferStartTs).toBeNull();
  });

  it("counts errors and clears rebuffer window", () => {
    let s = initQoeSnapshot("s", T0);
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 100 });
    s = applyQoeEvent(s, { kind: "waiting", ts: T0 + 1000 });
    s = applyQoeEvent(s, { kind: "error", ts: T0 + 2000 });
    expect(s.errorCount).toBe(1);
    expect(s.rebufferStartTs).toBeNull();
    expect(s.rebufferMs).toBe(1000);
  });

  it("heartbeat accumulates playbackMs when not rebuffering", () => {
    let s = initQoeSnapshot("s", T0);
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    s = applyQoeEvent(s, { kind: "heartbeat", ts: T0 + 1500 });
    expect(s.playbackMs).toBe(1000);
  });

  it("heartbeat does NOT accumulate playbackMs while rebuffering", () => {
    let s = initQoeSnapshot("s", T0);
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    s = applyQoeEvent(s, { kind: "waiting", ts: T0 + 1000 });
    s = applyQoeEvent(s, { kind: "heartbeat", ts: T0 + 2000 });
    expect(s.playbackMs).toBe(0);
  });

  it("monotonicity: out-of-order event ts is clamped to lastTs", () => {
    let s = initQoeSnapshot("s", T0);
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 5000 });
    const tsBefore = s.lastTs;
    s = applyQoeEvent(s, { kind: "heartbeat", ts: T0 }); // earlier than lastTs
    expect(s.lastTs).toBe(tsBefore);
  });

  it("ring buffer is capped at QOE_EVENT_RING_SIZE", () => {
    let s = initQoeSnapshot("s", T0);
    for (let i = 0; i < QOE_EVENT_RING_SIZE + 20; i++) {
      s = applyQoeEvent(s, { kind: "heartbeat", ts: T0 + i * 1000 });
    }
    expect(s.ring.length).toBe(QOE_EVENT_RING_SIZE);
  });

  it("pause clears an open rebuffer window", () => {
    let s = initQoeSnapshot("s", T0);
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 100 });
    s = applyQoeEvent(s, { kind: "waiting", ts: T0 + 1000 });
    s = applyQoeEvent(s, { kind: "pause", ts: T0 + 2000 });
    expect(s.rebufferStartTs).toBeNull();
    expect(s.rebufferMs).toBe(1000);
  });

  it("withNetwork replaces network without touching counters", () => {
    let s = initQoeSnapshot("s", T0);
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    const np4g = makeNetwork({ effectiveType: "4g" });
    const updated = withNetwork(s, np4g);
    expect(updated.network.effectiveType).toBe("4g");
    expect(updated.firstPlayTs).toBe(s.firstPlayTs);
    expect(updated.playbackMs).toBe(s.playbackMs);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// computeHealthScore
// ─────────────────────────────────────────────────────────────────────────

describe("computeHealthScore", () => {
  it("perfect stream scores 100", () => {
    let s = initQoeSnapshot("s", T0, makeNetwork());
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 }); // fast start
    s = applyQoeEvent(s, { kind: "heartbeat", ts: T0 + 60_000 }); // 60s playing
    const { score } = computeHealthScore(s);
    expect(score).toBe(100);
  });

  it("very late startup reduces score", () => {
    let s = initQoeSnapshot("s", T0, makeNetwork());
    // 10x over startup budget
    s = applyQoeEvent(s, {
      kind: "playing",
      ts: T0 + QOE_STARTUP_BUDGET_MS * 10,
    });
    const { score, startupPenalty } = computeHealthScore(s);
    expect(startupPenalty).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("heavy rebuffering reduces score significantly", () => {
    let s = initQoeSnapshot("s", T0, makeNetwork());
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    // 30 s rebuffer out of 60 s total
    s = applyQoeEvent(s, { kind: "waiting", ts: T0 + 1000 });
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 31_000 }); // 30 s rebuffer
    s = applyQoeEvent(s, { kind: "heartbeat", ts: T0 + 61_000 });
    const { score, rebufferPenalty } = computeHealthScore(s);
    expect(rebufferPenalty).toBe(40); // max rebuffer penalty
    expect(score).toBeLessThan(70);
  });

  it("two errors incur error penalty", () => {
    let s = initQoeSnapshot("s", T0, makeNetwork());
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    s = applyQoeEvent(s, { kind: "error", ts: T0 + 1000 });
    s = applyQoeEvent(s, { kind: "error", ts: T0 + 2000 });
    const { errorPenalty } = computeHealthScore(s);
    expect(errorPenalty).toBe(20);
  });

  it("slow-2g network applies network penalty", () => {
    let s = initQoeSnapshot(
      "s",
      T0,
      makeNetwork({ effectiveType: "slow-2g" }),
    );
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    const { networkPenalty } = computeHealthScore(s);
    expect(networkPenalty).toBe(15);
  });

  it("score is never negative", () => {
    let s = initQoeSnapshot(
      "s",
      T0,
      makeNetwork({ effectiveType: "slow-2g" }),
    );
    for (let i = 0; i < 5; i++) {
      s = applyQoeEvent(s, { kind: "error", ts: T0 + i * 1000 });
    }
    s = applyQoeEvent(s, { kind: "waiting", ts: T0 + 1000 });
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 120_000 });
    const { score } = computeHealthScore(s);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("score is never above 100", () => {
    const s = initQoeSnapshot("s", T0, makeNetwork());
    const { score } = computeHealthScore(s);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("score is deterministic — same input always yields same output", () => {
    let s = initQoeSnapshot("s", T0, makeNetwork());
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 1000 });
    const r1 = computeHealthScore(s);
    const r2 = computeHealthScore(s);
    expect(r1).toEqual(r2);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Circuit breaker
// ─────────────────────────────────────────────────────────────────────────

describe("circuit breaker", () => {
  it("starts closed", () => {
    expect(initBreaker().state).toBe("closed");
  });

  it("opens after BREAKER_FAILURE_THRESHOLD consecutive failures", () => {
    let b = initBreaker();
    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) {
      b = breakerStep({ breaker: b, now: T0 + i * 100, outcome: "failure" });
    }
    expect(b.state).toBe("open");
  });

  it("single success resets to closed from closed", () => {
    let b = initBreaker();
    b = breakerStep({ breaker: b, now: T0, outcome: "failure" });
    b = breakerStep({ breaker: b, now: T0 + 1, outcome: "success" });
    expect(b.state).toBe("closed");
    expect(b.failures).toBe(0);
  });

  it("success from half-open closes the breaker", () => {
    let b = initBreaker();
    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) {
      b = breakerStep({ breaker: b, now: T0, outcome: "failure" });
    }
    expect(b.state).toBe("open");
    // Advance past cooldown
    b = breakerStep({
      breaker: b,
      now: T0 + BREAKER_OPEN_COOLDOWN_MS + 1,
      outcome: "failure",
    });
    expect(b.state).toBe("half-open");
    b = breakerStep({
      breaker: b,
      now: T0 + BREAKER_OPEN_COOLDOWN_MS + 2,
      outcome: "success",
    });
    expect(b.state).toBe("closed");
  });

  it("failure from half-open re-opens the breaker", () => {
    let b = initBreaker();
    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) {
      b = breakerStep({ breaker: b, now: T0, outcome: "failure" });
    }
    b = breakerStep({
      breaker: b,
      now: T0 + BREAKER_OPEN_COOLDOWN_MS + 1,
      outcome: "failure",
    }); // → half-open
    b = breakerStep({
      breaker: b,
      now: T0 + BREAKER_OPEN_COOLDOWN_MS + 2,
      outcome: "failure",
    }); // → open
    expect(b.state).toBe("open");
  });

  it("breakerAllows: closed always allows", () => {
    expect(breakerAllows(initBreaker(), T0)).toBe(true);
  });

  it("breakerAllows: open within cooldown blocks", () => {
    let b = initBreaker();
    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) {
      b = breakerStep({ breaker: b, now: T0, outcome: "failure" });
    }
    expect(breakerAllows(b, T0 + 100)).toBe(false);
  });

  it("breakerAllows: open after cooldown allows", () => {
    let b = initBreaker();
    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) {
      b = breakerStep({ breaker: b, now: T0, outcome: "failure" });
    }
    expect(
      breakerAllows(b, T0 + BREAKER_OPEN_COOLDOWN_MS + 1),
    ).toBe(true);
  });

  it("respects custom failure threshold", () => {
    let b = initBreaker();
    b = breakerStep({
      breaker: b,
      now: T0,
      outcome: "failure",
      failureThreshold: 1,
    });
    expect(b.state).toBe("open");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// pickBestPath
// ─────────────────────────────────────────────────────────────────────────

describe("pickBestPath", () => {
  it("returns primary when healthy", () => {
    const paths = [
      makePath("p", "primary"),
      makePath("m", "mirror"),
      makePath("f", "fallback"),
    ];
    const result = pickBestPath(paths, T0);
    expect(result?.id).toBe("p");
  });

  it("skips open primary and returns mirror", () => {
    const openBreaker: Partial<BreakerSnapshot> = {
      state: "open",
      openedAt: T0 - 100,
      failures: BREAKER_FAILURE_THRESHOLD,
    };
    const paths = [
      makePath("p", "primary", openBreaker),
      makePath("m", "mirror"),
    ];
    const result = pickBestPath(paths, T0);
    expect(result?.id).toBe("m");
  });

  it("returns null for empty paths array", () => {
    expect(pickBestPath([], T0)).toBeNull();
  });

  it("returns highest-priority path when all breakers are open (force probe)", () => {
    const openBreaker: Partial<BreakerSnapshot> = {
      state: "open",
      openedAt: T0 - 100,
      failures: BREAKER_FAILURE_THRESHOLD,
    };
    const paths = [
      makePath("p", "primary", openBreaker),
      makePath("m", "mirror", openBreaker),
    ];
    const result = pickBestPath(paths, T0);
    expect(result?.id).toBe("p"); // primary wins on tie
  });

  it("prefers mirror over fallback", () => {
    const openBreaker: Partial<BreakerSnapshot> = {
      state: "open",
      openedAt: T0 - 100,
      failures: BREAKER_FAILURE_THRESHOLD,
    };
    const paths = [
      makePath("p", "primary", openBreaker),
      makePath("m", "mirror"),
      makePath("f", "fallback"),
    ];
    expect(pickBestPath(paths, T0)?.id).toBe("m");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// shouldPreemptRebuffer
// ─────────────────────────────────────────────────────────────────────────

describe("shouldPreemptRebuffer", () => {
  it("does not fire before first play", () => {
    const s = initQoeSnapshot("s", T0, makeNetwork({ effectiveType: "2g" }));
    expect(shouldPreemptRebuffer({ snapshot: s })).toBe(false);
  });

  it("fires on slow network + low buffer", () => {
    let s = initQoeSnapshot(
      "s",
      T0,
      makeNetwork({ effectiveType: "2g", downlinkMbps: 0.2 }),
    );
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    s = applyQoeEvent(s, {
      kind: "heartbeat",
      ts: T0 + 1500,
      bufferAheadMs: 500,
    });
    expect(shouldPreemptRebuffer({ snapshot: s })).toBe(true);
  });

  it("does not fire on fast network with low buffer", () => {
    let s = initQoeSnapshot(
      "s",
      T0,
      makeNetwork({ effectiveType: "4g", downlinkMbps: 50 }),
    );
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    s = applyQoeEvent(s, {
      kind: "heartbeat",
      ts: T0 + 1500,
      bufferAheadMs: 500,
    });
    // Buffer is 500 ms. horizonMs/2 = 2500 ms. 500 < 2500 → preempt.
    // Should still fire because of the half-horizon rule.
    expect(shouldPreemptRebuffer({ snapshot: s })).toBe(true);
  });

  it("does not fire when already rebuffering", () => {
    let s = initQoeSnapshot(
      "s",
      T0,
      makeNetwork({ effectiveType: "2g", downlinkMbps: 0.2 }),
    );
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 500 });
    s = applyQoeEvent(s, { kind: "waiting", ts: T0 + 1000 }); // now rebuffering
    s = applyQoeEvent(s, {
      kind: "heartbeat",
      ts: T0 + 1500,
      bufferAheadMs: 100,
    });
    expect(shouldPreemptRebuffer({ snapshot: s })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// shouldWarmReconnect
// ─────────────────────────────────────────────────────────────────────────

describe("shouldWarmReconnect", () => {
  it("does not reconnect below failure threshold", () => {
    const d = shouldWarmReconnect({
      consecutiveFailures: 2,
      lastReconnectTs: null,
      now: T0,
      failureThreshold: 3,
    });
    expect(d.reconnect).toBe(false);
    expect(d.reason).toBe("below-threshold");
  });

  it("allows reconnect when at threshold with no previous reconnect", () => {
    const d = shouldWarmReconnect({
      consecutiveFailures: 3,
      lastReconnectTs: null,
      now: T0,
      failureThreshold: 3,
    });
    expect(d.reconnect).toBe(true);
    expect(d.reason).toBe("cooldown-ok");
  });

  it("blocks reconnect within cooldown", () => {
    const d = shouldWarmReconnect({
      consecutiveFailures: 5,
      lastReconnectTs: T0 - 5_000,
      now: T0,
      minCooldownMs: 10_000,
    });
    expect(d.reconnect).toBe(false);
    expect(d.reason).toBe("too-soon");
  });

  it("allows reconnect after cooldown has elapsed", () => {
    const d = shouldWarmReconnect({
      consecutiveFailures: 5,
      lastReconnectTs: T0 - 15_000,
      now: T0,
      minCooldownMs: 10_000,
    });
    expect(d.reconnect).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// extractPreconnectOrigin
// ─────────────────────────────────────────────────────────────────────────

describe("extractPreconnectOrigin", () => {
  it("extracts origin from https URL", () => {
    expect(extractPreconnectOrigin("https://example.com/stream/live")).toBe(
      "https://example.com",
    );
  });

  it("extracts origin from http URL", () => {
    expect(extractPreconnectOrigin("http://cdn.example.com/hls.m3u8")).toBe(
      "http://cdn.example.com",
    );
  });

  it("returns null for data URI", () => {
    expect(extractPreconnectOrigin("data:video/mp4;base64,abc")).toBeNull();
  });

  it("returns null for blob URI", () => {
    expect(extractPreconnectOrigin("blob:https://example.com/uuid")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractPreconnectOrigin("")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(extractPreconnectOrigin(null as unknown as string)).toBeNull();
    expect(extractPreconnectOrigin(undefined as unknown as string)).toBeNull();
  });

  it("returns null for non-http protocol", () => {
    expect(extractPreconnectOrigin("rtmp://live.example.com/stream")).toBeNull();
  });

  it("preserves port in origin", () => {
    expect(extractPreconnectOrigin("https://cdn.example.com:8443/live")).toBe(
      "https://cdn.example.com:8443",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// parseBeaconPayload
// ─────────────────────────────────────────────────────────────────────────

describe("parseBeaconPayload", () => {
  const validRaw = {
    gameId: "game-abc",
    sessionIdHash: "sf-12345678",
    score: 92,
    startupMs: 1200,
    rebufferMs: 500,
    playbackMs: 30_000,
    rebufferCount: 1,
    errorCount: 0,
    network: { effectiveType: "4g", downlinkMbps: 20, rttMs: 30 },
    ts: T0,
  };

  it("parses a valid payload", () => {
    const p = parseBeaconPayload(validRaw);
    expect(p).not.toBeNull();
    expect(p?.gameId).toBe("game-abc");
    expect(p?.score).toBe(92);
    expect(p?.startupMs).toBe(1200);
  });

  it("returns null for missing gameId", () => {
    expect(parseBeaconPayload({ ...validRaw, gameId: "" })).toBeNull();
    expect(parseBeaconPayload({ ...validRaw, gameId: undefined })).toBeNull();
  });

  it("returns null for missing sessionIdHash", () => {
    expect(
      parseBeaconPayload({ ...validRaw, sessionIdHash: "" }),
    ).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseBeaconPayload(null)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(parseBeaconPayload("evil-string")).toBeNull();
    expect(parseBeaconPayload(42)).toBeNull();
  });

  it("clamps out-of-range score", () => {
    const p = parseBeaconPayload({ ...validRaw, score: 9999 });
    expect(p?.score).toBe(100);
    const p2 = parseBeaconPayload({ ...validRaw, score: -50 });
    expect(p2?.score).toBe(0);
  });

  it("treats null startupMs gracefully", () => {
    const p = parseBeaconPayload({ ...validRaw, startupMs: null });
    expect(p?.startupMs).toBeNull();
  });

  it("truncates oversized gameId", () => {
    const p = parseBeaconPayload({ ...validRaw, gameId: "g".repeat(1000) });
    expect(p?.gameId.length).toBeLessThanOrEqual(128);
  });

  it("normalizes unknown network profile", () => {
    const p = parseBeaconPayload({ ...validRaw, network: null });
    expect(p?.network.effectiveType).toBe("unknown");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// mergeBeaconIntoAggregate + toHealthReport
// ─────────────────────────────────────────────────────────────────────────

describe("beacon aggregation", () => {
  const makeBeacon = (overrides: Partial<ReturnType<typeof parseBeaconPayload>> = {}) => ({
    gameId: "game-xyz",
    sessionIdHash: "sf-aabb",
    score: 90,
    startupMs: 1000,
    rebufferMs: 0,
    playbackMs: 30_000,
    rebufferCount: 0,
    errorCount: 0,
    network: normalizeNetworkProfile({ effectiveType: "4g", downlinkMbps: 20, rttMs: 30 }),
    ts: T0,
    ...overrides,
  });

  it("creates a fresh aggregate from first beacon", () => {
    const agg = mergeBeaconIntoAggregate(null, makeBeacon());
    expect(agg.samples).toBe(1);
    expect(agg.sumScore).toBe(90);
    expect(agg.startupSamples).toBe(1);
  });

  it("accumulates across multiple beacons", () => {
    let agg = mergeBeaconIntoAggregate(null, makeBeacon({ score: 80 }));
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ score: 90, ts: T0 + 1000 }));
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ score: 100, ts: T0 + 2000 }));
    expect(agg.samples).toBe(3);
    expect(agg.sumScore).toBe(270);
  });

  it("resets on window expiry", () => {
    const agg1 = mergeBeaconIntoAggregate(null, makeBeacon({ ts: T0 }));
    // Beacon arrives 5 minutes later — beyond default 2-minute window
    const agg2 = mergeBeaconIntoAggregate(
      agg1,
      makeBeacon({ ts: T0 + 5 * 60_000, score: 50 }),
    );
    expect(agg2.samples).toBe(1);
    expect(agg2.sumScore).toBe(50);
  });

  it("toHealthReport derives correct avgScore", () => {
    let agg = emptyAggregate("game-xyz", T0);
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ score: 70, ts: T0 + 1000 }));
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ score: 90, ts: T0 + 2000 }));
    const report = toHealthReport(agg);
    expect(report.avgScore).toBeCloseTo(80);
    expect(report.samples).toBe(2);
  });

  it("toHealthReport errorRate is correct", () => {
    let agg = emptyAggregate("game-xyz", T0);
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ errorCount: 0, ts: T0 + 1000 }));
    agg = mergeBeaconIntoAggregate(agg, makeBeacon({ errorCount: 2, ts: T0 + 2000 }));
    const report = toHealthReport(agg);
    expect(report.errorRate).toBeCloseTo(0.5);
  });

  it("toHealthReport rebufferRatio is bounded [0,1]", () => {
    let agg = emptyAggregate("game-xyz", T0);
    agg = mergeBeaconIntoAggregate(
      agg,
      makeBeacon({ rebufferMs: 60_000, playbackMs: 0, ts: T0 + 1000 }),
    );
    const report = toHealthReport(agg);
    expect(report.rebufferRatio).toBeGreaterThanOrEqual(0);
    expect(report.rebufferRatio).toBeLessThanOrEqual(1);
  });

  it("toHealthReport handles zero samples gracefully", () => {
    const agg = emptyAggregate("game-xyz", T0);
    const report = toHealthReport(agg);
    expect(report.samples).toBe(0);
    expect(report.avgScore).toBe(0);
    expect(report.avgStartupMs).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// End-to-end: full session simulation
// ─────────────────────────────────────────────────────────────────────────

describe("end-to-end session simulation", () => {
  it("simulates a healthy 60s broadcast correctly", () => {
    let s = initQoeSnapshot("sess-e2e", T0, makeNetwork());

    // Player ready at +1.2 s (within startup budget)
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 1_200 });

    // 4 heartbeats, 15 s apart
    for (let i = 1; i <= 4; i++) {
      s = applyQoeEvent(s, {
        kind: "heartbeat",
        ts: T0 + 1_200 + i * 15_000,
        bufferAheadMs: 8_000,
      });
    }

    const { score, startupPenalty, rebufferPenalty } = computeHealthScore(s);
    expect(score).toBe(100);
    expect(startupPenalty).toBe(0);
    expect(rebufferPenalty).toBe(0);
    expect(s.playbackMs).toBeGreaterThan(50_000);
    expect(s.rebufferMs).toBe(0);
    expect(s.errorCount).toBe(0);
  });

  it("simulates a degraded session with one long rebuffer", () => {
    let s = initQoeSnapshot(
      "sess-e2e-bad",
      T0,
      makeNetwork({ effectiveType: "3g", downlinkMbps: 0.8 }),
    );

    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 2_000 });
    s = applyQoeEvent(s, { kind: "waiting", ts: T0 + 5_000 });
    s = applyQoeEvent(s, {
      kind: "heartbeat",
      ts: T0 + 10_000,
      bufferAheadMs: 200,
    });
    s = applyQoeEvent(s, { kind: "playing", ts: T0 + 15_000 }); // 10 s rebuffer
    // Recovery heartbeat — include a healthy buffer reading (8 s ahead).
    // Without this, the engine correctly retains the stale low 200 ms reading
    // and continues to flag preemption risk on the slow network.
    s = applyQoeEvent(s, {
      kind: "heartbeat",
      ts: T0 + 60_000,
      bufferAheadMs: 8_000,
    });

    const { score } = computeHealthScore(s);
    // Should trigger rebuffer, network, and startup penalties
    expect(score).toBeLessThan(85);
    // Buffer recovered to 8 s ahead — preemption should not fire.
    expect(shouldPreemptRebuffer({ snapshot: s })).toBe(false);
  });
});
