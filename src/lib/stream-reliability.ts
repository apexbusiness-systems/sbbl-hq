export type NetworkTier = 'offline' | 'constrained' | 'standard' | 'high';

export interface StreamRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export const DEFAULT_STREAM_RETRY_POLICY: StreamRetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 1200,
  maxDelayMs: 15000,
  jitterRatio: 0.2,
};

/**
 * Infers connection quality from browser hints.
 * Uses conservative defaults so unsupported platforms fail safe.
 */
export function detectNetworkTier(conn?: { downlink?: number; effectiveType?: string; saveData?: boolean } | null): NetworkTier {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (!conn) return 'standard';
  if (conn.saveData) return 'constrained';
  if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return 'constrained';
  if ((conn.downlink ?? 0) >= 8 && conn.effectiveType === '4g') return 'high';
  return 'standard';
}

/**
 * Exponential backoff with bounded jitter to spread reconnect bursts.
 */
export function computeRetryDelayMs(
  attempt: number,
  policy: StreamRetryPolicy = DEFAULT_STREAM_RETRY_POLICY,
  random = Math.random,
): number {
  const exp = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const jitterFactor = 1 - policy.jitterRatio + random() * policy.jitterRatio * 2;
  return Math.round(Math.max(250, Math.min(policy.maxDelayMs, exp * jitterFactor)));
}

/**
 * Only auto-retry for transient transport failures.
 */
export function isRecoverablePlaybackError(message: string): boolean {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('forbidden') ||
    normalized.includes('unauthorized') ||
    normalized.includes('permission') ||
    normalized.includes('not allowed')
  ) {
    return false;
  }
  return (
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('source') ||
    normalized.includes('media')
  );
}
