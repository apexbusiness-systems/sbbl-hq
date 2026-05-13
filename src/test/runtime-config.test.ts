import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mock createClient so we can observe what URL/key it receives ───────────
const createClientSpy = vi.fn().mockReturnValue({
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  },
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientSpy(...args),
}));

describe('runtime-config', () => {
  beforeEach(() => {
    vi.resetModules();
    createClientSpy.mockClear();
  });

  it('falls back to build env when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { getRuntimeConfig } = await import('@/lib/runtime-config');
    const config = await getRuntimeConfig();
    expect(config.appName).toBe('SBBL HQ');
  });

  it('uses fetched config when available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        supabaseUrl: 'https://test.supabase.co',
        supabasePublishableKey: 'test-key-123',
        appName: 'TEST APP',
        defaultLeague: 'WBL',
      }),
    }));
    const { getRuntimeConfig } = await import('@/lib/runtime-config');
    const config = await getRuntimeConfig();
    expect(config.supabaseUrl).toBe('https://test.supabase.co');
    expect(config.appName).toBe('TEST APP');
  });

  it('defaults googleOAuthEnabled to false when the worker does not send the flag', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        supabaseUrl: 'https://test.supabase.co',
        supabasePublishableKey: 'test-key-123',
      }),
    }));
    const { getRuntimeConfig } = await import('@/lib/runtime-config');
    const config = await getRuntimeConfig();
    expect(config.googleOAuthEnabled).toBe(false);
  });

  it('respects googleOAuthEnabled=true from the worker', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        supabaseUrl: 'https://test.supabase.co',
        supabasePublishableKey: 'test-key-123',
        googleOAuthEnabled: true,
      }),
    }));
    const { getRuntimeConfig } = await import('@/lib/runtime-config');
    const config = await getRuntimeConfig();
    expect(config.googleOAuthEnabled).toBe(true);
  });

  it('coerces non-boolean googleOAuthEnabled to false (fails closed)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        supabaseUrl: 'https://test.supabase.co',
        supabasePublishableKey: 'test-key-123',
        // Worker MUST send a boolean; if it accidentally sends a string, we
        // must NOT treat it as enabled.
        googleOAuthEnabled: 'true' as unknown as boolean,
      }),
    }));
    const { getRuntimeConfig } = await import('@/lib/runtime-config');
    const config = await getRuntimeConfig();
    expect(config.googleOAuthEnabled).toBe(false);
  });

  it('does not silently boot a Supabase client from committed prod fallback creds', async () => {
    // When env is empty AND the public-config fetch fails, the config must
    // resolve to nulls — never to baked-in production fallbacks.
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { getRuntimeConfig } = await import('@/lib/runtime-config');
    const config = await getRuntimeConfig();
    expect(config.supabaseUrl).toBeNull();
    expect(config.supabasePublishableKey).toBeNull();
  });
});

describe('runtime-config → Supabase client init (login chain)', () => {
  beforeEach(() => {
    vi.resetModules();
    createClientSpy.mockClear();
    // Simulate NO build-time env vars — forces runtime config fallback
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  });

  it('initSupabaseClient creates client from /api/public-config when no build-time vars', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        supabaseUrl: 'https://runtime.supabase.co',
        supabasePublishableKey: 'runtime-anon-key-xyz',
        appName: 'SBBL HQ',
        defaultLeague: 'SBBL',
      }),
    }));

    const { initSupabaseClient, getSupabaseClient } = await import('@/lib/supabase/client');
    await initSupabaseClient();

    expect(createClientSpy).toHaveBeenCalledWith(
      'https://runtime.supabase.co',
      'runtime-anon-key-xyz',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true }),
      }),
    );
    expect(getSupabaseClient()).not.toBeNull();
  });

  it('getSupabaseClient returns null before init when no build-time vars', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('not called yet')));

    const { getSupabaseClient } = await import('@/lib/supabase/client');
    expect(getSupabaseClient()).toBeNull();
  });

  it('initSupabaseClient leaves client null when public-config returns no creds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        appName: 'SBBL HQ',
        // No supabaseUrl or supabasePublishableKey
      }),
    }));

    const { initSupabaseClient, getSupabaseClient } = await import('@/lib/supabase/client');
    await initSupabaseClient();

    // createClient should NOT have been called
    expect(createClientSpy).not.toHaveBeenCalled();
    expect(getSupabaseClient()).toBeNull();
  });
});

describe('supabase config drift guardrails', () => {
  beforeEach(() => {
    vi.resetModules();
    createClientSpy.mockClear();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://build.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'build-key-123');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'build-key-123');
  });

  it('prefers runtime config over build-time env during init', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        supabaseUrl: 'https://runtime.supabase.co',
        supabasePublishableKey: 'runtime-key-xyz',
        appName: 'SBBL HQ',
        defaultLeague: 'SBBL',
      }),
    }));

    const { initSupabaseClient } = await import('@/lib/supabase/client');
    await initSupabaseClient();

    // Module load eagerly creates the legacy exported client from build env,
    // then init must self-heal to runtime config to avoid split-brain.
    expect(createClientSpy).toHaveBeenCalledTimes(2);
    expect(createClientSpy).toHaveBeenNthCalledWith(
      1,
      'https://build.supabase.co',
      'build-key-123',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true }),
      }),
    );
    expect(createClientSpy).toHaveBeenNthCalledWith(
      2,
      'https://runtime.supabase.co',
      'runtime-key-xyz',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true }),
      }),
    );
  });

  it('rebuilds a stale pre-init build client when runtime config disagrees', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        supabaseUrl: 'https://runtime.supabase.co',
        supabasePublishableKey: 'runtime-key-xyz',
        appName: 'SBBL HQ',
        defaultLeague: 'SBBL',
      }),
    }));

    const { getSupabaseClient, initSupabaseClient } = await import('@/lib/supabase/client');

    // Simulate an early access path that instantiates from stale build env.
    expect(getSupabaseClient()).not.toBeNull();
    expect(createClientSpy).toHaveBeenNthCalledWith(
      1,
      'https://build.supabase.co',
      'build-key-123',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true }),
      }),
    );

    await initSupabaseClient();

    // Guardrail: init must self-heal to runtime config to avoid JWT split-brain.
    expect(createClientSpy).toHaveBeenCalledTimes(2);
    expect(createClientSpy).toHaveBeenNthCalledWith(
      2,
      'https://runtime.supabase.co',
      'runtime-key-xyz',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true }),
      }),
    );
  });
});
