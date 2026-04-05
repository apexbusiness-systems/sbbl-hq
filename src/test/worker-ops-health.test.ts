import { describe, expect, it } from 'vitest';
import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_1234567890',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
  STRIPE_SECRET_KEY: 'stripe-secret-123456789',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-123456789',
  RESEND_API_KEY: 'resend-key-123456789',
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

describe('/ops/health endpoint', () => {
  it('returns 200 with required fields', async () => {
    const res = await worker.fetch(new Request('https://local/ops/health'), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('time');
    expect(body).toHaveProperty('uptime_s');
    expect(body).toHaveProperty('supabase_url');
    // Supabase URL must be redacted (no full URL exposed)
    expect(body.supabase_url).not.toContain('supabase.co');
  });

  it('does not require auth', async () => {
    // No Authorization header — should still return 200
    const res = await worker.fetch(new Request('https://local/ops/health'), env);
    expect(res.status).toBe(200);
  });

  it('includes security headers', async () => {
    const res = await worker.fetch(new Request('https://local/ops/health'), env);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
  });
});

describe('/ops/metrics-lite endpoint', () => {
  it('returns 200 with metric fields', async () => {
    const res = await worker.fetch(new Request('https://local/ops/metrics-lite'), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty('total_requests');
    expect(body).toHaveProperty('status_429_count');
    expect(body).toHaveProperty('status_5xx_count');
    expect(body).toHaveProperty('p95_latency_ms');
    expect(body).toHaveProperty('uptime_s');
    expect(typeof body.total_requests).toBe('number');
  });
});

describe('/api/public-config contract', () => {
  it('returns expected JSON shape', async () => {
    const res = await worker.fetch(new Request('https://local/api/public-config'), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty('appName');
    expect(body).toHaveProperty('defaultLeague');
    expect(body).toHaveProperty('supabaseUrl');
    expect(body).toHaveProperty('supabasePublishableKey');
    expect(typeof body.appName).toBe('string');
  });
});

describe('CSP includes Facebook embed domains', () => {
  it('allows Facebook frame-src for /live page embeds', async () => {
    const res = await worker.fetch(new Request('https://local/api/public-config'), env);
    const csp = res.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain('https://www.facebook.com');
    expect(csp).toContain('https://web.facebook.com');
    expect(csp).toContain('https://www.youtube.com');
  });

  it('allows self-hosted Supabase connect-src', async () => {
    const res = await worker.fetch(new Request('https://local/api/public-config'), env);
    const csp = res.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain('https://*.sbbl-hq.icu');
    expect(csp).toContain('wss://*.sbbl-hq.icu');
  });
});
