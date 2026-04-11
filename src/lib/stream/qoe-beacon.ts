/**
 * StreamForge QoE beacon shipper.
 *
 * Zero-dependency, fire-and-forget helper for shipping telemetry to the
 * edge worker. Uses `navigator.sendBeacon` when available (preferred for
 * pagehide — survives tab close) and falls back to `fetch({ keepalive })`
 * for interval sends.
 *
 * Design guarantees
 * -----------------
 *  - Never throws: all error paths are swallowed so beacon failures can
 *    never break playback or crash the player.
 *  - Never blocks: sendBeacon is non-blocking by design, and the fetch
 *    fallback is not awaited inside critical rendering paths.
 *  - Never leaks PII: only the caller-supplied `BeaconPayload` is sent —
 *    no cookies, no Authorization header, no user id.
 *  - Idempotent at the transport layer: duplicate beacons are tolerated
 *    server-side by the aggregator (running sums), so retries are safe.
 *  - Bounded size: payload is JSON-stringified and rejected at
 *    MAX_BEACON_BYTES so a malformed snapshot cannot trigger a 413.
 */

import type { BeaconPayload } from '@/lib/stream/streamforge';

/** Maximum serialized beacon size (bytes). */
export const MAX_BEACON_BYTES = 4 * 1024;

export interface BeaconTransport {
  /** Attempts to ship a payload. Returns true on successful enqueue. */
  send(gameId: string, payload: BeaconPayload): boolean;
}

/**
 * Serialize + size-guard a payload. Returns null if serialization fails or
 * the payload exceeds MAX_BEACON_BYTES.
 */
export function serializeBeacon(payload: BeaconPayload): string | null {
  try {
    const json = JSON.stringify(payload);
    if (json.length > MAX_BEACON_BYTES) return null;
    return json;
  } catch {
    return null;
  }
}

/**
 * Default browser transport. Tries `navigator.sendBeacon`, then falls back
 * to `fetch` with `keepalive: true`. All errors are swallowed.
 */
export function createBrowserBeaconTransport(): BeaconTransport {
  return {
    send(gameId: string, payload: BeaconPayload): boolean {
      if (typeof gameId !== 'string' || gameId.length === 0) return false;
      const body = serializeBeacon(payload);
      if (!body) return false;

      const url = `/api/streams/${encodeURIComponent(gameId)}/qoe`;

      // Preferred path: sendBeacon. Survives pagehide, non-blocking.
      try {
        const nav: Navigator | undefined =
          typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav && typeof nav.sendBeacon === 'function') {
          const blob = new Blob([body], { type: 'application/json' });
          if (nav.sendBeacon(url, blob)) return true;
        }
      } catch {
        /* fall through to fetch */
      }

      // Fallback: fetch with keepalive so the request survives page unload.
      try {
        if (typeof fetch === 'function') {
          void fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            keepalive: true,
            credentials: 'omit',
            mode: 'same-origin',
          }).catch(() => {});
          return true;
        }
      } catch {
        /* swallow */
      }
      return false;
    },
  };
}

/** No-op transport for tests and server-side rendering. */
export const NOOP_BEACON_TRANSPORT: BeaconTransport = Object.freeze({
  send(): boolean {
    return false;
  },
});
