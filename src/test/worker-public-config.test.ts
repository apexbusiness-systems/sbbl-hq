import { describe, expect, it } from 'vitest';
import { handlePublicConfig } from '../worker/routes/public';
import type { HandlerCtx } from '../worker/shared';

// Minimal HandlerCtx for tests — only env is read by handlePublicConfig.
function makeCtx(env: Partial<Env>): HandlerCtx {
  return {
    req: new Request('https://example.test/api/public-config'),
    env: env as Env,
    params: {},
    // admin is unused by this handler.
    admin: undefined as unknown as HandlerCtx['admin'],
  };
}

describe('handlePublicConfig — googleOAuthEnabled capability flag', () => {
  it('returns googleOAuthEnabled=false when the flag is not set (fail-closed default)', async () => {
    const res = await handlePublicConfig(
      makeCtx({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'k' }),
    );
    const body = await res.json();
    expect(body.googleOAuthEnabled).toBe(false);
  });

  it('returns googleOAuthEnabled=true when GOOGLE_OAUTH_ENABLED="true"', async () => {
    const res = await handlePublicConfig(
      makeCtx({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'k',
        GOOGLE_OAUTH_ENABLED: 'true',
      }),
    );
    const body = await res.json();
    expect(body.googleOAuthEnabled).toBe(true);
  });

  it('accepts the legacy FEATURE_GOOGLE_OAUTH alias', async () => {
    const res = await handlePublicConfig(
      makeCtx({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'k',
        FEATURE_GOOGLE_OAUTH: 'true',
      }),
    );
    const body = await res.json();
    expect(body.googleOAuthEnabled).toBe(true);
  });

  it('treats values other than the literal string "true" as false (fail-closed)', async () => {
    for (const value of ['1', 'yes', 'TRUE ', ' true', 'TruE', '', 'false', 'on']) {
      const res = await handlePublicConfig(
        makeCtx({
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'k',
          GOOGLE_OAUTH_ENABLED: value,
        }),
      );
      const body = await res.json();
      // Trims + lowercases before comparing, so "TRUE " and " true" should
      // succeed; everything else must be false.
      const expected = value.trim().toLowerCase() === 'true';
      expect(body.googleOAuthEnabled).toBe(expected);
    }
  });

  it('still returns supabase URL and key from worker env', async () => {
    const res = await handlePublicConfig(
      makeCtx({
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'key-x',
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.supabaseUrl).toBe('https://x.supabase.co');
    expect(body.supabasePublishableKey).toBe('key-x');
  });
});
