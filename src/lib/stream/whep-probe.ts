/**
 * whep-probe.ts
 *
 * Lightweight pre-flight probe for a WHEP endpoint. Surfaces CORS, DNS, and
 * network-reachability failures with actionable hints BEFORE WebRTCPlayer
 * spins up its full negotiation, so operators see a specific error (not a
 * generic "connection failed").
 *
 * Non-blocking by design: a probe failure is advisory. WhepPlayer still falls
 * through to its retry path. Servers that reject OPTIONS with 405/501 are
 * treated as OK (endpoint is reachable and CORS is configured at the layer
 * that matters — the POST preflight).
 */
export type WhepProbeReason =
  | 'ok'
  | 'cors_blocked'
  | 'network_unreachable'
  | 'http_error'
  | 'invalid_url'
  | 'timeout';

export interface WhepProbeResult {
  ok: boolean;
  reason: WhepProbeReason;
  /** Human-readable hint for the UI error overlay. */
  hint?: string;
  /** Upstream HTTP status when reason === 'http_error'. */
  status?: number;
}

const DEFAULT_TIMEOUT_MS = 3500;

/**
 * Probe a WHEP URL for reachability + CORS.
 *
 * Strategy:
 *   1. Parse URL — reject obviously invalid inputs up front.
 *   2. Issue CORS-mode OPTIONS request with a short timeout.
 *   3. Any 2xx/3xx/4xx response proves reachability + CORS (browsers surface
 *      CORS denials as opaque TypeError, never as a response).
 *      - 405/501 on OPTIONS is acceptable: server is reachable and the real
 *        POST preflight will be checked by the player itself.
 *   4. TypeError = CORS block OR network unreachable; fetch(mode:'cors') does
 *      not distinguish, so we classify by error message heuristics.
 *   5. AbortError from our timeout = 'timeout'.
 */
export async function probeWhepCors(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<WhepProbeResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      reason: 'invalid_url',
      hint: 'WHEP URL is not a valid absolute URL.',
    };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      reason: 'invalid_url',
      hint: `WHEP URL must use http(s) protocol, got "${parsed.protocol}".`,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(parsed.toString(), {
      method: 'OPTIONS',
      mode: 'cors',
      signal: controller.signal,
      // Intentionally no body — OPTIONS should be idempotent.
    });
    clearTimeout(timer);

    // 2xx/3xx — CORS preflight OK.
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, reason: 'ok' };
    }
    // 405 Method Not Allowed / 501 Not Implemented — server is reachable +
    // CORS-enabled at the response layer; the actual POST preflight will be
    // evaluated by the browser when the player negotiates. Not a probe failure.
    if (res.status === 405 || res.status === 501) {
      return { ok: true, reason: 'ok' };
    }
    // 5xx or other 4xx — upstream problem worth reporting but not a CORS block.
    return {
      ok: false,
      reason: 'http_error',
      status: res.status,
      hint: `WHEP origin returned HTTP ${res.status} on OPTIONS — check broadcaster health.`,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        reason: 'timeout',
        hint: `WHEP origin did not respond within ${timeoutMs}ms — check network or origin availability.`,
      };
    }
    // TypeError from fetch = CORS block OR network unreachable. The browser
    // deliberately blurs these to prevent cross-origin probing. We classify
    // by message heuristics but always surface a CORS hint because that is
    // by far the most common misconfiguration for a fresh MediaMTX deploy.
    if (err instanceof TypeError) {
      const msg = err.message.toLowerCase();
      if (msg.includes('networkerror') || msg.includes('network request failed')) {
        return {
          ok: false,
          reason: 'network_unreachable',
          hint: 'WHEP origin is unreachable — check DNS, TLS certificate, and broadcaster uptime.',
        };
      }
      return {
        ok: false,
        reason: 'cors_blocked',
        hint:
          'WHEP origin likely missing CORS headers. Add Access-Control-Allow-Origin, ' +
          'Access-Control-Allow-Methods: POST,OPTIONS, and Access-Control-Allow-Headers: Content-Type ' +
          'to your MediaMTX/Caddy config.',
      };
    }
    // Unknown — conservative: treat as network error, do not block playback.
    return {
      ok: false,
      reason: 'network_unreachable',
      hint: 'WHEP origin probe failed for an unknown reason — check broadcaster logs.',
    };
  }
}
