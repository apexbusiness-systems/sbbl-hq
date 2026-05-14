/**
 * SBBL-HQ API Proxy Worker — Circuit Breaker + Active-Active Failover
 * Routes: api.sbbl-hq.icu → EC2 Self-Hosted (primary) | Supabase Cloud (fallback)
 * State:  Cloudflare KV namespace SBBL_BACKEND_STATE
 *
 * Type strategy: this file is excluded from the main app's tsconfig.app.json
 * (it ships as a separate worker via src/api-proxy-worker/wrangler.toml).
 * To keep it self-contained and avoid pulling @cloudflare/workers-types ambient
 * declarations into the React app build, we declare the minimal CF runtime
 * surface we touch as local structural types.
 */

// ── Minimal CF runtime surface (structural types) ────────────────────────────
interface KVNamespace {
  get(key: string, type: 'json'): Promise<unknown>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

export interface Env {
  SBBL_BACKEND_STATE: KVNamespace;
  SELFHOST_ORIGIN_URL: string;   // http://[EC2_IP]:8000
  CLOUD_URL: string;             // https://ezanilxygnpucwkwpsoc.supabase.co
  CLOUD_ANON_KEY: string;
  SELFHOST_ANON_KEY: string;
  FAILOVER_SECRET: string;
  FAILURE_THRESHOLD: string;
  FAILURE_WINDOW_MS: string;
  UPSTREAM_TIMEOUT_MS: string;
  ENVIRONMENT: string;
}

interface BackendState {
  active: 'selfhost' | 'cloud';
  failures: number;
  lastFailure: number;   // epoch ms
  lastSwitch: number;    // epoch ms
  switchCount: number;
}

const DEFAULT_STATE: BackendState = {
  active: 'selfhost',
  failures: 0,
  lastFailure: 0,
  lastSwitch: 0,
  switchCount: 0,
};

const STATE_KEY = 'state';

const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,apikey,x-client-info,Prefer,Range,Accept-Profile,Content-Profile',
  'Access-Control-Expose-Headers': 'Content-Range,Range-Unit,X-Supabase-*',
  'Access-Control-Max-Age': '86400',
};

const ALLOWED_ORIGINS = [
  'https://sbbl-hq.icu',
  'https://www.sbbl-hq.icu',
  'http://localhost:5173',
  'capacitor://localhost',
  'http://localhost',
];

function getSafeCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  const headers: Record<string, string> = { ...BASE_CORS_HEADERS };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

// ── State helpers ─────────────────────────────────────────────────────────────

async function getState(kv: KVNamespace): Promise<BackendState> {
  try {
    const raw = await kv.get(STATE_KEY, 'json');
    return (raw as BackendState) ?? { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function setState(kv: KVNamespace, state: BackendState): Promise<void> {
  await kv.put(STATE_KEY, JSON.stringify(state), { expirationTtl: 86400 });
}

// ── Circuit breaker ───────────────────────────────────────────────────────────

async function recordFailure(env: Env, state: BackendState): Promise<BackendState> {
  const now = Date.now();
  const windowMs = parseInt(env.FAILURE_WINDOW_MS, 10);
  const threshold = parseInt(env.FAILURE_THRESHOLD, 10);

  // Reset failure count if outside window
  const failures =
    now - state.lastFailure < windowMs ? state.failures + 1 : 1;

  const next: BackendState = {
    ...state,
    failures,
    lastFailure: now,
  };

  // Auto-switch: selfhost → cloud only (cloud → selfhost is manual)
  if (failures >= threshold && state.active === 'selfhost') {
    next.active = 'cloud';
    next.failures = 0;
    next.lastSwitch = now;
    next.switchCount = state.switchCount + 1;
    console.error(
      `[SBBL-PROXY] Circuit breaker tripped after ${failures} failures. ` +
      `Switching to cloud. Switch #${next.switchCount}`
    );
  }

  await setState(env.SBBL_BACKEND_STATE, next);
  return next;
}

async function recordSuccess(env: Env, state: BackendState): Promise<void> {
  if (state.failures === 0) return; // nothing to reset
  await setState(env.SBBL_BACKEND_STATE, {
    ...state,
    failures: 0,
  });
}

// ── Request forwarding ────────────────────────────────────────────────────────

function buildUpstreamUrl(originUrl: string, incomingRequest: Request): string {
  const url = new URL(incomingRequest.url);
  // Replace host with upstream, keep path + search
  return `${originUrl.replace(/\/$/, '')}${url.pathname}${url.search}`;
}

async function forwardRequest(
  targetBaseUrl: string,
  request: Request,
  anonKey: string,
  timeoutMs: number
): Promise<Response> {
  const upstreamUrl = buildUpstreamUrl(targetBaseUrl, request);

  // Clone headers, inject apikey if missing (supabase-js expects this)
  const headers = new Headers(request.headers);
  if (!headers.has('apikey') && !headers.has('Authorization')) {
    headers.set('apikey', anonKey);
  }
  // Remove incoming host header so upstream doesn't get confused
  headers.delete('host');
  headers.set('x-forwarded-host', 'api.sbbl-hq.icu');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // `duplex: 'half'` is required by undici (Node 18+) when forwarding a
  // streaming request body. CF Workers ignores it. Cast to RequestInit so
  // DOM-lib RequestInit (which lacks `duplex`) accepts the extra field.
  const init = {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    signal: controller.signal,
    duplex: 'half',
  } as RequestInit;

  try {
    const upstreamResp = await fetch(upstreamUrl, init);
    clearTimeout(timer);
    return upstreamResp;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function addCorsHeaders(response: Response, request: Request): Response {
  const newHeaders = new Headers(response.headers);
  const corsHeaders = getSafeCorsHeaders(request);
  for (const [k, v] of Object.entries(corsHeaders)) {
    newHeaders.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// ── Manual override endpoint ──────────────────────────────────────────────────

async function handleFailoverOverride(
  request: Request,
  env: Env
): Promise<Response> {
  // Validate secret
  const authHeader = request.headers.get('x-failover-secret');
  if (authHeader !== env.FAILOVER_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { target?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const target = body?.target;
  if (target !== 'selfhost' && target !== 'cloud') {
    return new Response(
      JSON.stringify({ error: 'target must be "selfhost" or "cloud"' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const state = await getState(env.SBBL_BACKEND_STATE);
  const next: BackendState = {
    ...state,
    active: target,
    failures: 0,
    lastSwitch: Date.now(),
    switchCount: state.switchCount + 1,
  };
  await setState(env.SBBL_BACKEND_STATE, next);

  return new Response(
    JSON.stringify({ success: true, active: target, switchCount: next.switchCount }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

// ── Health + status endpoint ──────────────────────────────────────────────────

async function handleStatus(env: Env): Promise<Response> {
  const state = await getState(env.SBBL_BACKEND_STATE);
  return new Response(JSON.stringify({ ...state, ts: Date.now() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Main fetch handler ────────────────────────────────────────────────────────

const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getSafeCorsHeaders(request) });
    }

    // Internal ops endpoints (do not proxy)
    if (url.pathname === '/ops/proxy-status') {
      return handleStatus(env);
    }
    if (url.pathname === '/ops/failover' && request.method === 'POST') {
      return handleFailoverOverride(request, env);
    }

    const state = await getState(env.SBBL_BACKEND_STATE);
    const timeoutMs = parseInt(env.UPSTREAM_TIMEOUT_MS, 10);

    const isUsingSelfhost = state.active === 'selfhost';
    const primaryUrl = isUsingSelfhost ? env.SELFHOST_ORIGIN_URL : env.CLOUD_URL;
    const primaryKey = isUsingSelfhost ? env.SELFHOST_ANON_KEY : env.CLOUD_ANON_KEY;
    const fallbackUrl = isUsingSelfhost ? env.CLOUD_URL : null; // cloud never auto-falls back to selfhost
    const fallbackKey = isUsingSelfhost ? env.CLOUD_ANON_KEY : null;

    // Clone request body for potential retry
    const requestClone = request.clone();

    // ── Attempt primary ──
    try {
      const resp = await forwardRequest(primaryUrl, request, primaryKey, timeoutMs);

      if (resp.status >= 500) {
        throw new Error(`Upstream returned ${resp.status}`);
      }

      // Success — reset failure count in background
      ctx.waitUntil(recordSuccess(env, state));

      return addCorsHeaders(resp, request);

    } catch (primaryErr) {
      console.error(`[SBBL-PROXY] Primary (${state.active}) error:`, primaryErr);

      // Update circuit breaker state
      const newState = await recordFailure(env, state);

      // ── Attempt fallback (only selfhost→cloud, never cloud→selfhost) ──
      if (fallbackUrl && fallbackKey) {
        console.warn(`[SBBL-PROXY] Falling back to ${newState.active === 'cloud' ? 'cloud' : 'fallback'}`);
        try {
          const fallbackResp = await forwardRequest(
            fallbackUrl,
            requestClone,
            fallbackKey,
            timeoutMs
          );
          // Tag response to indicate fallback was used
          const taggedHeaders = new Headers(fallbackResp.headers);
          taggedHeaders.set('x-sbbl-backend', 'cloud-fallback');
          return addCorsHeaders(
            new Response(fallbackResp.body, {
              status: fallbackResp.status,
              headers: taggedHeaders,
            }),
            request
          );
        } catch (fallbackErr) {
          console.error('[SBBL-PROXY] Fallback also failed:', fallbackErr);
          const errorHeaders = {
            'Content-Type': 'application/json',
            'Retry-After': '30',
            ...getSafeCorsHeaders(request),
          };
          return new Response(
            JSON.stringify({
              error: 'Both backends unavailable. Please try again in 30 seconds.',
              code: 'SBBL_BOTH_BACKENDS_DOWN',
            }),
            {
              status: 503,
              headers: errorHeaders,
            }
          );
        }
      }

      // Cloud is already active and failed — return 503
      const errorHeaders = {
        'Content-Type': 'application/json',
        'Retry-After': '30',
        ...getSafeCorsHeaders(request),
      };
      return new Response(
        JSON.stringify({
          error: 'Backend unavailable. Our team has been notified.',
          code: 'SBBL_BACKEND_DOWN',
        }),
        {
          status: 503,
          headers: errorHeaders,
        }
      );
    }
  },

  // Scheduled health check — runs every 60 seconds via CF Cron Trigger
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const state = await getState(env.SBBL_BACKEND_STATE);

    // Only auto-recover selfhost if it's been down (active=cloud)
    // Attempt to hit selfhost health endpoint — if it responds, log it (manual restore still required)
    if (state.active === 'cloud') {
      try {
        const resp = await fetch(`${env.SELFHOST_ORIGIN_URL}/auth/v1/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (resp.ok) {
          console.log(
            '[SBBL-PROXY] Selfhost is responding again. ' +
            'Run failover-to-selfhost.sh to restore primary when ready.'
          );
          // Update state to flag selfhost recovery — manual restore still required
          await setState(env.SBBL_BACKEND_STATE, {
            ...state,
            failures: 0, // reset so next manual switch is clean
          });
        }
      } catch {
        // Still down — expected, no action
      }
    }
  },
};

export default handler;
