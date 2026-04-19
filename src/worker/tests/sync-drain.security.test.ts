import { describe, it, expect, vi } from 'vitest';
import { handleSyncDrain, type HandlerCtx } from '../index';
import { type SupabaseClient } from '@supabase/supabase-js';
import { type Env } from '../bindings';

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

    const ctx: Partial<HandlerCtx> = {
      req: mockReq,
      env: {
        OMNIHUB_SYNC_URL: 'https://hub.local/sync',
        // OMNIHUB_SIGNING_SECRET is missing
      } as Env,
      params: {},
      admin: mockAdmin,
    };

    await expect(handleSyncDrain(ctx as HandlerCtx)).rejects.toThrow('OMNIHUB_SIGNING_SECRET_missing');
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
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);

    const ctx: Partial<HandlerCtx> = {
      req: mockReq,
      env: {
        OMNIHUB_SYNC_URL: 'https://hub.local/sync',
        OMNIHUB_SIGNING_SECRET: 'valid-secret',
      } as Env,
      params: {},
      admin: mockAdmin,
    };

    const response = await handleSyncDrain(ctx as HandlerCtx);
    const body = await response.json() as { ok: boolean; processed: number };
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(1);
  });
});
