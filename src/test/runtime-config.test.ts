import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('runtime-config', () => {
  beforeEach(() => {
    vi.resetModules();
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
