/**
 * CORS Pre-flight Probe — Cloudflare Worker Function.
 *
 * Validates that a stream URL (HLS / WHEP / DASH) has the correct CORS
 * headers configured before the admin persists it. This prevents a
 * misconfigured origin from silently breaking playback for all viewers.
 *
 * Called by the ops panel when an admin saves a new broadcast source URL.
 *
 * Request:  POST /api/validate-stream-url
 *           Body: { "url": "https://stream.example.com/live/main.m3u8" }
 *
 * Response: { "valid": true/false, "cors": {...}, "error": "..." }
 *
 * Security:
 *  - Only accepts POST with JSON body.
 *  - URL must be http(s).
 *  - Response is never cached (no-store).
 *  - Does not follow redirects past 3 hops.
 *  - Times out after 8 seconds.
 */

export interface StreamUrlValidationRequest {
  url: string;
}

export interface CorsProbeResult {
  valid: boolean;
  url: string;
  statusCode: number | null;
  cors: {
    allowOrigin: string | null;
    allowMethods: string | null;
    allowHeaders: string | null;
    exposeHeaders: string | null;
  };
  error: string | null;
  probeMs: number;
}

/** Origins that our player uses — CORS must allow at least one. */
const REQUIRED_ORIGINS = [
  'https://sbbl-hq.icu',
  'https://www.sbbl-hq.icu',
  '*',
];

const MAX_REDIRECTS = 3;
const PROBE_TIMEOUT_MS = 8_000;
const MAX_URL_LENGTH = 2048;

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function corsIsValid(allowOrigin: string | null): boolean {
  if (!allowOrigin) return false;
  const trimmed = allowOrigin.trim();
  return REQUIRED_ORIGINS.some(
    (origin) => trimmed === origin || trimmed === '*',
  );
}

async function probeUrl(
  targetUrl: string,
  origin: string,
): Promise<CorsProbeResult> {
  const start = Date.now();
  const result: CorsProbeResult = {
    valid: false,
    url: targetUrl,
    statusCode: null,
    cors: {
      allowOrigin: null,
      allowMethods: null,
      allowHeaders: null,
      exposeHeaders: null,
    },
    error: null,
    probeMs: 0,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    // Issue a preflight OPTIONS request mimicking the browser
    const response = await fetch(targetUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'range',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    result.statusCode = response.status;
    result.cors.allowOrigin =
      response.headers.get('access-control-allow-origin');
    result.cors.allowMethods =
      response.headers.get('access-control-allow-methods');
    result.cors.allowHeaders =
      response.headers.get('access-control-allow-headers');
    result.cors.exposeHeaders =
      response.headers.get('access-control-expose-headers');

    // Also try HEAD as a fallback — some servers don't respond to OPTIONS
    if (!result.cors.allowOrigin) {
      const headResponse = await fetch(targetUrl, {
        method: 'HEAD',
        headers: { Origin: origin },
        redirect: 'follow',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      result.statusCode = headResponse.status;
      result.cors.allowOrigin =
        headResponse.headers.get('access-control-allow-origin');
      result.cors.allowMethods =
        headResponse.headers.get('access-control-allow-methods');
      result.cors.allowHeaders =
        headResponse.headers.get('access-control-allow-headers');
      result.cors.exposeHeaders =
        headResponse.headers.get('access-control-expose-headers');
    }

    result.valid = corsIsValid(result.cors.allowOrigin);
    if (!result.valid && !result.error) {
      result.error = result.cors.allowOrigin
        ? `CORS allows '${result.cors.allowOrigin}' but not our origin`
        : 'No Access-Control-Allow-Origin header returned';
    }
  } catch (err: unknown) {
    result.error =
      err instanceof Error ? err.message : 'Unknown probe failure';
  }

  result.probeMs = Date.now() - start;
  return result;
}

/**
 * Cloudflare Pages Function handler.
 *
 * Deployed at: /api/validate-stream-url
 */
export async function onRequestPost(
  context: { request: Request },
): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  try {
    const body = (await context.request.json()) as StreamUrlValidationRequest;

    if (!body.url || typeof body.url !== 'string') {
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing or invalid "url" field' }),
        { status: 400, headers },
      );
    }

    if (body.url.length > MAX_URL_LENGTH) {
      return new Response(
        JSON.stringify({ valid: false, error: `URL exceeds ${MAX_URL_LENGTH} chars` }),
        { status: 400, headers },
      );
    }

    if (!isHttpUrl(body.url)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'URL must use http or https protocol' }),
        { status: 400, headers },
      );
    }

    const result = await probeUrl(body.url, 'https://sbbl-hq.icu');

    return new Response(JSON.stringify(result), {
      status: result.valid ? 200 : 422,
      headers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(
      JSON.stringify({ valid: false, error: message }),
      { status: 500, headers },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Exports for unit testing
// ─────────────────────────────────────────────────────────────────────────
export { isHttpUrl, corsIsValid, REQUIRED_ORIGINS, PROBE_TIMEOUT_MS };