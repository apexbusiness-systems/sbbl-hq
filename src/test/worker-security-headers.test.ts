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

describe('Worker security headers', () => {
  it('sets security headers on /api/public-config', async () => {
    const res = await worker.fetch(new Request('https://local/api/public-config'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('sets security headers on 404 responses (no ASSETS fallback)', async () => {
    // Remove ASSETS to ensure 404 path is reached instead of asset fallback
    const envNoAssets = { ...env, ASSETS: undefined };
    const res = await worker.fetch(new Request('https://local/api/nonexistent-route-xyz'), envNoAssets as unknown as Env);
    expect(res.status).toBe(404);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
  });

  it('sets security headers on error responses', async () => {
    const res = await worker.fetch(new Request('https://local/auth/session'), env);
    expect(res.status).toBe(401);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
