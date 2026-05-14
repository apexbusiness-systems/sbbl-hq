/**
 * Verifies that the Supabase client is built with the settings required for
 * Google OAuth (PKCE flow) to work correctly in the browser SPA.
 */
import { describe, expect, it, vi } from 'vitest';

// Capture the options passed to createClient so we can assert on them.
const capturedOptions: Record<string, unknown>[] = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url: string, key: string, opts: Record<string, unknown>) => {
    capturedOptions.push({ url, key, ...opts });
    return { url, key, auth: { onAuthStateChange: vi.fn() } };
  }),
}));

vi.mock('@/lib/runtime-config', () => ({
  getRuntimeConfig: vi.fn(async () => ({
    supabaseUrl: 'https://test.supabase.co',
    supabasePublishableKey: 'anon-key',
    appName: 'SBBL HQ',
    defaultLeague: 'SBBL',
    googleOAuthEnabled: true,
  })),
  getRuntimeConfigSync: vi.fn(() => ({
    supabaseUrl: 'https://test.supabase.co',
    supabasePublishableKey: 'anon-key',
    appName: 'SBBL HQ',
    defaultLeague: 'SBBL',
    googleOAuthEnabled: true,
  })),
}));

describe('Supabase client — PKCE / OAuth config', () => {
  it('builds the client with flowType=pkce and detectSessionInUrl=true', async () => {
    const { initSupabaseClient } = await import('@/lib/supabase/client');
    await initSupabaseClient();

    expect(capturedOptions.length).toBeGreaterThan(0);
    const opts = capturedOptions[capturedOptions.length - 1];
    const auth = opts.auth as Record<string, unknown>;

    expect(auth.flowType).toBe('pkce');
    expect(auth.detectSessionInUrl).toBe(true);
    expect(auth.persistSession).toBe(true);
    expect(auth.autoRefreshToken).toBe(true);
  });
});
