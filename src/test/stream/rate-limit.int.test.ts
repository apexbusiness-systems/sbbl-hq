import { describe, expect, it } from "vitest";
import {
  computeActiveEntitledViewerCount,
  consumeSlidingWindow,
  decideOneDeviceAccess,
  type ExistingSession,
} from "@/lib/stream/validation-policy";

describe("interaction-layer stream invariants", () => {
  it("keeps one active session when same device resumes", () => {
    const now = Date.now();
    const existing: ExistingSession = {
      status: "active",
      expiresAt: now + 70_000,
      fingerprint: {
        deviceTokenHash: "d1",
        installationKeyHash: "i1",
        userAgentHash: "ua",
        ipHash: "ip",
      },
    };

    const decision = decideOneDeviceAccess({
      now,
      entitlementExpiresAt: now + 48 * 60 * 60 * 1000,
      existingSession: existing,
      candidateFingerprint: {
        deviceTokenHash: "d1",
        installationKeyHash: "i1",
        userAgentHash: "ua",
        ipHash: "ip",
      },
    });

    expect(decision.decision).toBe("allow_resume");

    const viewerCount = computeActiveEntitledViewerCount(now, [
      { userId: "u1", status: "active", expiresAt: now + 60_000 },
      { userId: "u1", status: "resumable", expiresAt: now + 60_000 },
    ]);

    expect(viewerCount).toBe(1);
  });

  it("blocks sustained comment/reaction abuse bursts", () => {
    let timestamps: number[] = [];
    const now = Date.now();
    const perWindowLimit = 8;
    const windowMs = 10_000;

    for (let i = 0; i < perWindowLimit; i += 1) {
      const result = consumeSlidingWindow({
        now: now + i * 200,
        windowMs,
        limit: perWindowLimit,
        timestamps,
      });
      expect(result.allowed).toBe(true);
      timestamps = result.nextTimestamps;
    }

    const blocked = consumeSlidingWindow({
      now: now + perWindowLimit * 200,
      windowMs,
      limit: perWindowLimit,
      timestamps,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
