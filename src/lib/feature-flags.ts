/**
 * Frontend feature-flag helpers.
 *
 * Reads from `VITE_FEATURE_*` env vars via the typed client env. Keeps
 * string → boolean conversion in one place so component code never has
 * to compare against the literal string 'true'.
 *
 * Hindsight from PR 1/2: a flag that is never read is indistinguishable
 * from code that was never written. The canonical-font-guard style is
 * applied here: every flag in env.ts has a getter here, and consumers
 * must import the getter (not the raw env).
 */
import { readClientEnv } from '@/lib/env';

function parseFlag(v: unknown): boolean {
  return v === 'true' || v === true || v === '1' || v === 1;
}

/**
 * Lazy cache so React Strict Mode double-mounts do not re-parse env.
 * readClientEnv is safe to call multiple times but we minimize work.
 */
let _cached: ReturnType<typeof readClientEnv> | null = null;
function env() {
  if (!_cached) _cached = readClientEnv();
  return _cached;
}

/** WS3 — Viewer preflight UX on /live. */
export function isViewerPreflightEnabled(): boolean {
  return parseFlag(env().VITE_FEATURE_SHOW_VIEWER_PREFLIGHT);
}

/** WS4 — Fan token wallet + award flow. */
export function isFanTokenSystemEnabled(): boolean {
  return parseFlag(env().VITE_FEATURE_FAN_TOKEN_SYSTEM);
}

/** WS5 — Biometric overlay on 1v1 / 2v2 games. */
export function isBiometricOverlayEnabled(): boolean {
  return parseFlag(env().VITE_FEATURE_BIOMETRIC_OVERLAY);
}

/** WS6 — Mic Up Series branded overlays. */
export function isMicUpSeriesEnabled(): boolean {
  return parseFlag(env().VITE_FEATURE_MIC_UP_SERIES);
}

/** Test seam — drop the cache so overrides from vi.stubEnv() take effect. */
export function __resetFeatureFlagCacheForTests(): void {
  _cached = null;
}
