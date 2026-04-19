import { describe, it, expect, vi } from 'vitest';
import { handleSyncDrain } from '../index';
import { type SupabaseClient } from '@supabase/supabase-js';

describe('handleSyncDrain security', () => {
  it('should throw an error if OMNIHUB_SIGNING_SECRET is missing', async () => {
    const mockAdmin = {
      rpc: vi.fn().mockResolvedValue({ data: [{ id: '1', trace_id: 't1' }], error: null }),
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as SupabaseClient;

    const mockReq = new Request('https://sbbl-hq.icu/sync/drain', {
      headers: {
        'x-sbbl-user-id-verified': 'user-123',
        'x-sbbl-idempotency-key': 'key-123',
      },
    });

    const ctx = {
      req: mockReq,
      env: {
        OMNIHUB_SYNC_URL: 'https://hub.local/sync',
        // OMNIHUB_SIGNING_SECRET is missing
      } as any,
      params: {},
      admin: mockAdmin,
    };

    await expect(handleSyncDrain(ctx as any)).rejects.toThrow('OMNIHUB_SIGNING_SECRET_missing');
  });

  it('should proceed if OMNIHUB_SIGNING_SECRET is present', async () => {
    const mockAdmin = {
      rpc: vi.fn().mockImplementation((name) => {
        if (name === 'claim_outbox_events') return Promise.resolve({ data: [{ id: '1', trace_id: 't1' }], error: null });
        if (name === 'mark_outbox_delivered') return Promise.resolve({ error: null });
        return Promise.resolve({ error: null });
      }),
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as SupabaseClient;

    const mockReq = new Request('https://sbbl-hq.icu/sync/drain', {
      headers: {
        'x-sbbl-user-id-verified': 'user-123',
        'x-sbbl-idempotency-key': 'key-123',
      },
    });

    // Mock global fetch for the sync delivery
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const ctx = {
      req: mockReq,
      env: {
        OMNIHUB_SYNC_URL: 'https://hub.local/sync',
        OMNIHUB_SIGNING_SECRET: 'valid-secret',
      } as any,
      params: {},
      admin: mockAdmin,
    };

    const response = await handleSyncDrain(ctx as any);
    const body = await response.json() as any;
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(1);
  });
});
