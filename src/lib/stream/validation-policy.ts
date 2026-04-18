import { ENTITLEMENT_MS } from "@/lib/constants/ENTITLEMENT_CONSTANTS";

/** Hard ceiling for a single playback session (6h). */
export const SIX_HOURS_MS = ENTITLEMENT_MS.VIEWING_SESSION_MAX;
/** Canonical entitlement validity post-purchase (48h). */
export const ENTITLEMENT_VALIDITY_MS = ENTITLEMENT_MS.ENTITLEMENT_VALIDITY;
export const DEFAULT_PLAYBACK_ARTIFACT_TTL_MS = 10 * 60 * 1000;

export type SessionStatus = "active" | "resumable" | "expired" | "revoked" | "denied";

export interface SessionFingerprint {
  deviceTokenHash: string;
  installationKeyHash: string | null;
  userAgentHash: string;
  ipHash: string;
}

export interface ExistingSession {
  status: SessionStatus;
  expiresAt: number;
  fingerprint: SessionFingerprint;
}

export interface AccessDecisionInput {
  now: number;
  entitlementExpiresAt: number;
  existingSession: ExistingSession | null;
  candidateFingerprint: SessionFingerprint;
  allowTakeover?: boolean;
}

export interface AccessDecision {
  decision: "allow_new" | "allow_resume" | "deny" | "challenge";
  reason:
    | "no_existing_session"
    | "entitlement_expired"
    | "same_device_same_ip"
    | "different_device"
    | "session_not_resumable"
    | "session_expired"
    | "ip_changed"
    | "device_changed";
}

export interface PlaybackArtifactInput {
  now: number;
  issuedAt: number;
  artifactTtlMs: number;
  entitlementExpiresAt: number;
}

export function computeEntitlementExpiry(issuedAt: number): number {
  return issuedAt + ENTITLEMENT_VALIDITY_MS;
}

export function isEntitlementActive(now: number, entitlementExpiresAt: number): boolean {
  return now < entitlementExpiresAt;
}

export function sameDevice(a: SessionFingerprint, b: SessionFingerprint): boolean {
  const installMatch = a.installationKeyHash === b.installationKeyHash;
  return (
    a.deviceTokenHash === b.deviceTokenHash &&
    a.userAgentHash === b.userAgentHash &&
    installMatch
  );
}

export function sameIp(a: SessionFingerprint, b: SessionFingerprint): boolean {
  return a.ipHash === b.ipHash;
}

export function decideOneDeviceAccess(input: AccessDecisionInput): AccessDecision {
  const {
    now,
    entitlementExpiresAt,
    existingSession,
    candidateFingerprint,
    allowTakeover = false,
  } = input;

  if (!isEntitlementActive(now, entitlementExpiresAt)) {
    return { decision: "deny", reason: "entitlement_expired" };
  }

  if (!existingSession) {
    return { decision: "allow_new", reason: "no_existing_session" };
  }

  if (existingSession.expiresAt <= now) {
    return { decision: "allow_new", reason: "session_expired" };
  }

  if (existingSession.status === "revoked" || existingSession.status === "denied") {
    return { decision: "deny", reason: "session_not_resumable" };
  }

  const sameDeviceResult = sameDevice(existingSession.fingerprint, candidateFingerprint);
  const sameIpResult = sameIp(existingSession.fingerprint, candidateFingerprint);

  if (sameDeviceResult && sameIpResult) {
    return { decision: "allow_resume", reason: "same_device_same_ip" };
  }

  if (!sameDeviceResult && allowTakeover) {
    return { decision: "challenge", reason: "different_device" };
  }

  if (!sameDeviceResult) {
    return { decision: "deny", reason: "device_changed" };
  }

  return { decision: "deny", reason: "ip_changed" };
}

export function isPlaybackArtifactValid(input: PlaybackArtifactInput): boolean {
  const { now, issuedAt, artifactTtlMs, entitlementExpiresAt } = input;
  const artifactExpiresAt = issuedAt + artifactTtlMs;
  if (artifactTtlMs <= 0) return false;
  if (artifactExpiresAt > entitlementExpiresAt) return false;
  return now < artifactExpiresAt && now < entitlementExpiresAt;
}

export interface RateLimitWindow {
  now: number;
  windowMs: number;
  limit: number;
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  nextTimestamps: number[];
  remaining: number;
}

export function consumeSlidingWindow(input: RateLimitWindow): RateLimitResult {
  const { now, windowMs, limit, timestamps } = input;
  const recent = timestamps.filter((ts) => now - ts < windowMs);
  if (recent.length >= limit) {
    return {
      allowed: false,
      nextTimestamps: recent,
      remaining: 0,
    };
  }

  const next = [...recent, now];
  return {
    allowed: true,
    nextTimestamps: next,
    remaining: Math.max(0, limit - next.length),
  };
}

export interface ViewerSession {
  userId: string;
  status: SessionStatus;
  expiresAt: number;
}

export function computeActiveEntitledViewerCount(now: number, sessions: ViewerSession[]): number {
  const activeUsers = new Set<string>();
  for (const session of sessions) {
    if (session.status !== "active" && session.status !== "resumable") continue;
    if (session.expiresAt <= now) continue;
    activeUsers.add(session.userId);
  }
  return activeUsers.size;
}
