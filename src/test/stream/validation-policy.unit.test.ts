import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYBACK_ARTIFACT_TTL_MS,
  ENTITLEMENT_VALIDITY_MS,
  SIX_HOURS_MS,
  computeActiveEntitledViewerCount,
  computeEntitlementExpiry,
  consumeSlidingWindow,
  decideOneDeviceAccess,
  isPlaybackArtifactValid,
  type ExistingSession,
  type SessionFingerprint,
} from "@/lib/stream/validation-policy";

function fp(overrides: Partial<SessionFingerprint> = {}): SessionFingerprint {
  return {
    deviceTokenHash: "device-a",
    installationKeyHash: "install-a",
    userAgentHash: "ua-a",
    ipHash: "ip-a",
    ...overrides,
  };
}

describe("stream validation policy", () => {
  it("allows first access when entitlement is valid", () => {
    const now = Date.now();
    const decision = decideOneDeviceAccess({
      now,
      entitlementExpiresAt: now + ENTITLEMENT_VALIDITY_MS,
      existingSession: null,
      candidateFingerprint: fp(),
    });

    expect(decision.decision).toBe("allow_new");
  });

  it("allows resume only for same-device + same-ip", () => {
    const now = Date.now();
    const existing: ExistingSession = {
      status: "active",
      expiresAt: now + 60_000,
      fingerprint: fp(),
    };

    const same = decideOneDeviceAccess({
      now,
      entitlementExpiresAt: now + ENTITLEMENT_VALIDITY_MS,
      existingSession: existing,
      candidateFingerprint: fp(),
    });
    expect(same.decision).toBe("allow_resume");

    const changedIp = decideOneDeviceAccess({
      now,
      entitlementExpiresAt: now + ENTITLEMENT_VALIDITY_MS,
      existingSession: existing,
      candidateFingerprint: fp({ ipHash: "ip-b" }),
    });
    expect(changedIp.decision).toBe("deny");
    expect(changedIp.reason).toBe("ip_changed");

    const changedDevice = decideOneDeviceAccess({
      now,
      entitlementExpiresAt: now + ENTITLEMENT_VALIDITY_MS,
      existingSession: existing,
      candidateFingerprint: fp({ deviceTokenHash: "device-b" }),
    });
    expect(changedDevice.decision).toBe("deny");
    expect(changedDevice.reason).toBe("device_changed");
  });

  it("denies access after the 48-hour entitlement window", () => {
    const issuedAt = Date.now() - ENTITLEMENT_VALIDITY_MS - 1;
    const expiresAt = computeEntitlementExpiry(issuedAt);

    const decision = decideOneDeviceAccess({
      now: Date.now(),
      entitlementExpiresAt: expiresAt,
      existingSession: null,
      candidateFingerprint: fp(),
    });

    expect(decision.decision).toBe("deny");
    expect(decision.reason).toBe("entitlement_expired");
  });

  it("enforces playback artifact ttl shorter than entitlement", () => {
    const issuedAt = Date.now();
    const entitlementExpiresAt = issuedAt + ENTITLEMENT_VALIDITY_MS;

    expect(
      isPlaybackArtifactValid({
        now: issuedAt + 1_000,
        issuedAt,
        artifactTtlMs: DEFAULT_PLAYBACK_ARTIFACT_TTL_MS,
        entitlementExpiresAt,
      }),
    ).toBe(true);

    expect(
      isPlaybackArtifactValid({
        now: issuedAt + 1_000,
        issuedAt,
        artifactTtlMs: ENTITLEMENT_VALIDITY_MS + 1,
        entitlementExpiresAt,
      }),
    ).toBe(false);
  });

  it("rate-limits comment bursts deterministically", () => {
    const now = Date.now();
    const seed = [now - 1_000, now - 900, now - 800, now - 700, now - 600];

    const blocked = consumeSlidingWindow({
      now,
      windowMs: 5_000,
      limit: 5,
      timestamps: seed,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);

    const allowed = consumeSlidingWindow({
      now: now + 5_100,
      windowMs: 5_000,
      limit: 5,
      timestamps: seed,
    });

    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(4);
  });

  it("deduplicates active viewer count by user id", () => {
    const now = Date.now();
    const viewers = computeActiveEntitledViewerCount(now, [
      { userId: "u1", status: "active", expiresAt: now + 60_000 },
      { userId: "u1", status: "resumable", expiresAt: now + 50_000 },
      { userId: "u2", status: "active", expiresAt: now + 10_000 },
      { userId: "u3", status: "expired", expiresAt: now + 10_000 },
      { userId: "u4", status: "active", expiresAt: now - 1 },
    ]);

    expect(viewers).toBe(2);
  });
});
