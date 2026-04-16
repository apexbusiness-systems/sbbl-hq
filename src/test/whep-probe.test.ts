/**
 * whep-probe.test.ts
 *
 * Regression shield for the CORS probe. Covers every branch of the result
 * taxonomy so operator-facing error hints remain actionable.
 */
import { describe, it, expect, vi } from 'vitest';
import { probeWhepCors } from '@/lib/stream/whep-probe';

function mockFetch(impl: typeof fetch): typeof fetch {
  return vi.fn(impl) as unknown as typeof fetch;
}

describe('probeWhepCors — reachability + CORS', () => {
  it('returns ok on 2xx OPTIONS response', async () => {
    const fetchImpl = mockFetch(async () => new Response(null, { status: 204 }));
    const result = await probeWhepCors('https://stream.example.com/whep/live', 1000, fetchImpl);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('accepts 405/501 as reachable (server does not allow OPTIONS but is up)', async () => {
    for (const status of [405, 501]) {
      const fetchImpl = mockFetch(async () => new Response(null, { status }));
      const r = await probeWhepCors('https://stream.example.com/whep/live', 1000, fetchImpl);
      expect(r.ok).toBe(true);
      expect(r.reason).toBe('ok');
    }
  });

  it('reports http_error for 4xx/5xx other than 405/501', async () => {
    const fetchImpl = mockFetch(async () => new Response(null, { status: 503 }));
    const r = await probeWhepCors('https://stream.example.com/whep/live', 1000, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('http_error');
    expect(r.status).toBe(503);
    expect(r.hint).toMatch(/HTTP 503/);
  });

  it('classifies a TypeError as CORS-blocked (most common cause) with actionable hint', async () => {
    const fetchImpl = mockFetch(async () => { throw new TypeError('Failed to fetch'); });
    const r = await probeWhepCors('https://stream.example.com/whep/live', 1000, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cors_blocked');
    expect(r.hint).toMatch(/Access-Control-Allow-Origin/i);
  });

  it('classifies an explicit network-error message as network_unreachable', async () => {
    const fetchImpl = mockFetch(async () => {
      throw new TypeError('NetworkError when attempting to fetch resource');
    });
    const r = await probeWhepCors('https://stream.example.com/whep/live', 1000, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('network_unreachable');
    expect(r.hint).toMatch(/unreachable|DNS|TLS/);
  });

  it('returns timeout when fetch is aborted by our AbortController', async () => {
    const fetchImpl = mockFetch(async (_u, init) => {
      return await new Promise<Response>((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
    });
    const r = await probeWhepCors('https://stream.example.com/whep/live', 10, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('timeout');
    expect(r.hint).toMatch(/did not respond/i);
  });

  it('rejects invalid URLs up front without issuing a request', async () => {
    const fetchImpl = mockFetch(async () => {
      throw new Error('should not be called');
    });
    const r = await probeWhepCors('not a url', 1000, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_url');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects non-http protocols up front', async () => {
    const fetchImpl = mockFetch(async () => new Response(null));
    const r = await probeWhepCors('ws://stream.example.com/whep', 1000, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_url');
    expect(r.hint).toMatch(/http\(s\)/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
