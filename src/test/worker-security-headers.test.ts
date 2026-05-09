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
    const perms = res.headers.get('Permissions-Policy') ?? '';
    // Sensitive hardware stays denied.
    expect(perms).toContain('camera=()');
    expect(perms).toContain('microphone=()');
    expect(perms).toContain('geolocation=()');
    // Autoplay / fullscreen / picture-in-picture MUST be delegated to our
    // embed providers — without this, Chrome's default `self` policy blocks
    // embed.twitch.tv from autoplaying even when the SDK passes autoplay=true.
    expect(perms).toMatch(/autoplay=\(self [^)]*"https:\/\/embed\.twitch\.tv"[^)]*\)/);
    expect(perms).toMatch(/autoplay=\(self [^)]*"https:\/\/player\.twitch\.tv"[^)]*\)/);
    expect(perms).toMatch(/autoplay=\(self [^)]*"https:\/\/www\.youtube\.com"[^)]*\)/);
    expect(perms).toMatch(/autoplay=\(self [^)]*"https:\/\/player\.vimeo\.com"[^)]*\)/);
    expect(perms).toMatch(/fullscreen=\(self [^)]*"https:\/\/embed\.twitch\.tv"[^)]*\)/);
    expect(perms).toMatch(/picture-in-picture=\(self [^)]*"https:\/\/player\.twitch\.tv"[^)]*\)/);
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    expect(csp).toContain("default-src 'self'");
    // YouTube iframe API dynamically loads from s.ytimg.com.
    expect(csp).toContain('script-src');
    expect(csp).toContain('script-src-elem');
    expect(csp).toContain('https://s.ytimg.com');
    expect(csp).toContain('https://player.twitch.tv');
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

  // Regression: previously the SPA HTML shell (served from the ASSETS binding)
  // reached the browser with ZERO security headers because wrangler.jsonc's
  // `run_worker_first` was a path allowlist (["/api/*", ...]) that skipped the
  // Worker for SPA routes entirely. Without the Worker in the path, the browser
  // never saw Permissions-Policy or CSP on page loads — breaking Twitch embed
  // autoplay on /live. The fix flips `run_worker_first` to `true`; this test
  // pins the code-side invariant that ASSETS fallback responses are wrapped.
  it('sets security headers on SPA HTML shell served via ASSETS fallback (/live)', async () => {
    const htmlEnv = {
      ...env,
      ASSETS: {
        fetch: (_req: Request) =>
          Promise.resolve(
            new Response('<!doctype html><html><body>spa</body></html>', {
              status: 200,
              headers: { 'content-type': 'text/html; charset=utf-8' },
            }),
          ),
      },
    } as unknown as Env;
    const res = await worker.fetch(new Request('https://local/live'), htmlEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    const livePerms = res.headers.get('Permissions-Policy') ?? '';
    expect(livePerms).toContain('camera=()');
    expect(livePerms).toMatch(/autoplay=\(self [^)]*"https:\/\/embed\.twitch\.tv"[^)]*\)/);
    expect(livePerms).toMatch(/autoplay=\(self [^)]*"https:\/\/player\.twitch\.tv"[^)]*\)/);
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    const csp = res.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain('frame-src');
    expect(csp).toContain('https://player.twitch.tv');
    expect(csp).toContain('https://embed.twitch.tv');
  });

  it('sets security headers on SPA shell for arbitrary client routes (/scores, /store)', async () => {
    const htmlEnv = {
      ...env,
      ASSETS: {
        fetch: (_req: Request) =>
          Promise.resolve(
            new Response('<!doctype html><html></html>', {
              status: 200,
              headers: { 'content-type': 'text/html' },
            }),
          ),
      },
    } as unknown as Env;
    for (const path of ['/scores', '/store', '/leaderboards', '/teams', '/schedules']) {
      const res = await worker.fetch(new Request(`https://local${path}`), htmlEnv);
      expect(res.status, path).toBe(200);
      const pp = res.headers.get('Permissions-Policy') ?? '';
      expect(pp, path).toContain('camera=()');
      expect(pp, path).toMatch(/autoplay=\(self [^)]*"https:\/\/embed\.twitch\.tv"[^)]*\)/);
      expect(res.headers.get('Content-Security-Policy'), path).toContain("default-src 'self'");
    }
  });
});
