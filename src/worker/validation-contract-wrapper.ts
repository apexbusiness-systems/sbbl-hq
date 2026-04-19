import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import baseWorker from './index';

type JwtSession = {
    userId: string;
    roles: string[];
};

const VALIDATION_ROUTE_RE = [
    /^\/api\/streams\/[^/]+\/(test-source|test-ingest|validation-status)$/,
    /^\/ops\/validation-runs(?:\/[^/]+)?$/,
  ];

const MUTATION_IDEMPOTENCY_RE = [
    /^\/api\/streams\/[^/]+\/(purchase|access|resume|revoke|expire|comments|reactions)$/,
    /^\/ops\/validation-runs$/,
  ];

const runtimeRateLimit = new Map<string, [number, number]>();
const RUNTIME_RATE_LIMIT_MAX = 50000; // OOM guard - hard cap on tracked keys

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(data), {
          status,
          headers: {
                  'content-type': 'application/json; charset=utf-8',
                  ...headers,
          },
    });
}

function enforceInMemoryRateLimit(key: string, limit: number, period: number): boolean {
    const now = Date.now();
    const record = runtimeRateLimit.get(key) || [0, 0];
    const [count, lastReset] = record;

  if (now - lastReset > period * 1000) {
        runtimeRateLimit.set(key, [1, now]);
        return true;
  }

  if (count >= limit) {
        return false;
  }

  runtimeRateLimit.set(key, [count + 1, lastReset]);

  if (runtimeRateLimit.size >= RUNTIME_RATE_LIMIT_MAX) {
        const toDelete = Math.floor(RUNTIME_RATE_LIMIT_MAX * 0.2);
        let deleted = 0;
        for (const k of runtimeRateLimit.keys()) {
                if (deleted >= toDelete) break;
                runtimeRateLimit.delete(k);
                deleted++;
        }
  }

  return true;
}

function noStoreHeaders() {
    return {
          'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'pragm
    'pragma': 'no-cache',
            'expires': '0',
        };
}

export default {
      async fetch(request: Request, env: any, ctx: any) {
              const url = new URL(request.url);
              const isValidationRoute = VALIDATION_ROUTE_RE.some(re => re.test(url.pathname));
              const isMutationRoute = MUTATION_IDEMPOTENCY_RE.some(re => re.test(url.pathname));

        if (!isValidationRoute && !isMutationRoute) {
                  return baseWorker.fetch(request, env, ctx);
        }

        // Rate limit check
        const clientIp = request.headers.get('cf-connecting-ip') || 'anonymous';
              if (!enforceInMemoryRateLimit(clientIp, 100, 60)) {
                        return json({ error: 'Too many requests' }, 429, noStoreHeaders());
              }

        return baseWorker.fetch(request, env, ctx);
      }
};
