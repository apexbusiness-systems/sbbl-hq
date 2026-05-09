import { createClient } from '@supabase/supabase-js';
import baseWorker from './index';

const MUTATION_IDEMPOTENCY_RE = [
  /^\/api\/streams\/[^/]+\/(purchase|access|resume|revoke|expire|comments|reactions)$/,
  /^\/ops\/validation-runs$/,
];

// Sliding-window buckets keyed by rate-limit token.
const runtimeRateLimit = new Map<string, number[]>();
// OOM guard: evict the oldest entry when the map exceeds this size.
const RUNTIME_RATE_LIMIT_MAX = 50_000;

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

function readIdempotencyKey(req: Request) {
  return req.headers.get('x-idempotency-key') ?? req.headers.get('idempotency-key');
}

function requiresMutationIdempotency(pathname: string, method: string) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;
  return MUTATION_IDEMPOTENCY_RE.some((r) => r.test(pathname));
}

// Sliding-window rate limiter with OOM guard.
function enforceInMemoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = runtimeRateLimit.get(key) ?? [];
  const next = bucket.filter((ts) => now - ts < windowMs);
  if (next.length >= limit) {
    runtimeRateLimit.set(key, next);
    return false;
  }
  next.push(now);
  if (runtimeRateLimit.size >= RUNTIME_RATE_LIMIT_MAX) {
    // Evict the oldest inserted key (Map preserves insertion order).
    const oldest = runtimeRateLimit.keys().next().value;
    if (oldest !== undefined) runtimeRateLimit.delete(oldest);
  }
  runtimeRateLimit.set(key, next);
  return true;
}

function withRequestId(req: Request) {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set('x-request-id', requestId);
  return { requestId, headers };
}

function rewriteRequest(req: Request, targetPath: string) {
  const url = new URL(req.url);
  url.pathname = targetPath;
  return new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    redirect: req.redirect,
  });
}

async function handleOpsValidationRuns(req: Request, env: Env) {
  const url = new URL(req.url);
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === 'POST' && url.pathname === '/ops/validation-runs') {
    const body = (await req.json().catch(() => ({}))) as {
      game_id?: string | null;
      environment?: string;
      source_classification?: string;
    };

    const idempotencyKey = readIdempotencyKey(req);
    if (!idempotencyKey) return json({ ok: false, error: 'idempotency_key_required' }, 400);

    const { data: existing } = await admin
      .from('validation_runs')
      .select('id, status, game_id, environment, source_classification, started_at')
      .eq('summary->>idempotency_key', idempotencyKey)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return json(
        {
          ok: true,
          replay: true,
          validation_run_id: existing.id,
          status: existing.status,
          request_id: requestId,
        },
        200,
        noStoreHeaders(),
      );
    }

    const payload = {
      game_id: body.game_id ?? null,
      environment: body.environment ?? 'staging',
      source_classification: body.source_classification ?? 'sandbox',
      status: 'running',
      started_at: new Date().toISOString(),
      summary: { idempotency_key: idempotencyKey },
    };

    const { data, error } = await admin.from('validation_runs').insert(payload).select('id,status').single();
    if (error) return json({ ok: false, error: 'validation_run_create_failed', request_id: requestId }, 500);

    await admin.from('audit_logs').insert({
      actor: 'system',
      action: 'validation_run_started',
      ref_type: 'validation_runs',
      ref_id: data.id,
      outcome: 'ok',
      metadata: { request_id: requestId },
      idempotency_key: idempotencyKey,
      request_id: requestId,
      occurred_at: new Date().toISOString(),
    });

    return json(
      {
        ok: true,
        replay: false,
        validation_run_id: data.id,
        status: data.status,
        request_id: requestId,
      },
      201,
      noStoreHeaders(),
    );
  }

  if (req.method === 'GET') {
    const match = url.pathname.match(/^\/ops\/validation-runs\/([^/]+)$/);
    if (!match) return new Response('Not Found', { status: 404 });
    const runId = match[1];
    const { data, error } = await admin
      .from('validation_runs')
      .select('id, game_id, environment, source_classification, status, started_at, finished_at, artifact_json_path, artifact_md_path, summary')
      .eq('id', runId)
      .maybeSingle();

    if (error || !data) return json({ ok: false, error: 'not_found', request_id: requestId }, 404);

    return json({ ok: true, run: data, request_id: requestId }, 200, noStoreHeaders());
  }

  return new Response('Method Not Allowed', { status: 405 });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Reject mutations that are missing an idempotency key before touching any route.
    if (requiresMutationIdempotency(url.pathname, req.method) && !readIdempotencyKey(req)) {
      return json({ ok: false, error: 'idempotency_key_required' }, 400);
    }

    // /ops/validation-runs CRUD.
    if (url.pathname.startsWith('/ops/validation-runs')) {
      return handleOpsValidationRuns(req, env);
    }

    const correlation = withRequestId(req);
    const correlatedReq = new Request(req.url, {
      method: req.method,
      headers: correlation.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      redirect: req.redirect,
    });

    // Per-user + per-IP rate limits for high-frequency write paths.
    // User ID is read from the pre-verified header — no JWT call required.
    if (req.method === 'POST' && /^\/api\/streams\/[^/]+\/comments$/.test(url.pathname)) {
      const userId = req.headers.get('x-sbbl-user-id-verified') ?? 'anon';
      const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
      if (!enforceInMemoryRateLimit(`comment:${userId}:${ip}`, 8, 10_000)) {
        return json({ ok: false, error: 'rate_limited' }, 429, noStoreHeaders());
      }
    }

    if (req.method === 'POST' && /^\/api\/streams\/[^/]+\/reactions$/.test(url.pathname)) {
      const userId = req.headers.get('x-sbbl-user-id-verified') ?? 'anon';
      const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
      if (!enforceInMemoryRateLimit(`reaction:${userId}:${ip}`, 20, 10_000)) {
        return json({ ok: false, error: 'rate_limited' }, 429, noStoreHeaders());
      }
    }

    // Stable path aliases — /access and /resume both map to the session endpoint.
    if (req.method === 'POST' && /^\/api\/streams\/[^/]+\/access$/.test(url.pathname)) {
      return baseWorker.fetch(rewriteRequest(correlatedReq, url.pathname.replace('/access', '/session')), env);
    }
    if (req.method === 'POST' && /^\/api\/streams\/[^/]+\/resume$/.test(url.pathname)) {
      return baseWorker.fetch(rewriteRequest(correlatedReq, url.pathname.replace('/resume', '/session')), env);
    }
    if (req.method === 'POST' && /^\/api\/streams\/[^/]+\/reactions$/.test(url.pathname)) {
      return baseWorker.fetch(rewriteRequest(correlatedReq, url.pathname.replace('/reactions', '/react')), env);
    }

    const response = await baseWorker.fetch(correlatedReq, env);

    // Stamp no-store + correlation ID on responses that carry session or
    // entitlement data so CDN/proxies never cache them.
    if (
      /^\/api\/streams\/[^/]+\/(session|access|resume|revoke|expire|purchase)$/.test(url.pathname) ||
      /^\/ops\/validation-runs/.test(url.pathname)
    ) {
      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(noStoreHeaders())) headers.set(k, v);
      headers.set('x-request-id', correlation.requestId);
      return new Response(response.body, { status: response.status, headers });
    }

    return response;
  },
};
