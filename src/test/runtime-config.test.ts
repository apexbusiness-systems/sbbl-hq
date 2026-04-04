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
