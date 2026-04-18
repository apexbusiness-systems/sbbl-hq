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
    const csp = res.headers.get('Content-Security-Policy') ?? '';
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    const permissionsPolicy = res.headers.get('Permissions-Policy') ?? '';
    // Hardware capabilities we never use — must remain locked off.
    expect(permissionsPolicy).toContain('camera=()');
    expect(permissionsPolicy).toContain('microphone=()');
    expect(permissionsPolicy).toContain('geolocation=()');
    // Stream embeds (Twitch / YouTube / Vimeo) MUST be allowed to autoplay,
    // go fullscreen, do PIP, and decrypt media — otherwise /live stays black.
    // Regression shield for the 2026-04-18 Twitch autoplay outage.
    for (const directive of ['autoplay', 'fullscreen', 'picture-in-picture', 'encrypted-media']) {
      expect(permissionsPolicy).toContain(`${directive}=(`);
      expect(permissionsPolicy).toMatch(new RegExp(`${directive}=\\([^)]*"https://player\\.twitch\\.tv"`));
      expect(permissionsPolicy).toMatch(new RegExp(`${directive}=\\([^)]*"https://www\\.youtube\\.com"`));
      expect(permissionsPolicy).toMatch(new RegExp(`${directive}=\\([^)]*"https://player\\.vimeo\\.com"`));
    }
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    expect(csp).toContain("default-src 'self'");
    // YouTube iframe API dynamically loads from s.ytimg.com.
    expect(csp).toContain('script-src');
    expect(csp).toContain('script-src-elem');
    expect(csp).toContain('https://s.ytimg.com');
    // YouTube live runtime opens websocket channels on www.youtube.com.
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain('wss://www.youtube.com');
    // Embedded playback requires explicit frame source allowlist.
    expect(csp).toContain('frame-src');
    expect(csp).toContain('https://www.youtube.com');
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
