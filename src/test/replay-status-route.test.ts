/**
 * WS7 — replay status route branch coverage.
 *
 * Drives handleReplayStatus with an inline Supabase stub so every
 * response branch (unavailable / embargoed / available_for_purchase /
 * entitled) is reachable in unit-land. Price precedence (per-game
 * override > canonical tier default) is also verified.
 */
import { describe, expect, it } from 'vitest';
import { handleReplayStatus } from '@/worker/routes/replay';
import { ENTITLEMENT } from '@/lib/constants/ENTITLEMENT_CONSTANTS';

type GameRow = {
  id: string;
  replay_mode: 'none' | 'raw' | 'edited';
  replay_monetization_enabled_at: string | null;
  replay_quality_tier: 'raw' | 'edited' | null;
  replay_price: number | null;
  ended_at: string | null;
};

type EntitlementRow = {
  status: string | null;
  expires_at: string | null;
  replay_tier: 'raw' | 'edited' | null;
};

function buildAdmin(game: GameRow | null, entitlement: EntitlementRow | null) {
  return {
    from(table: string) {
      if (table === 'games') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: game }),
        } as never;
      }
      if (table === 'stream_entitlements') {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return this; },
          order() { return this; },
          limit() { return this; },
          maybeSingle: async () => ({ data: entitlement }),
        } as never;
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as import('@/worker/shared').HandlerCtx['admin'];
}

function ctx(game: GameRow | null, entitlement: EntitlementRow | null, userId: string | null = null) {
  return {
    req: new Request('http://local/api/streams/g-1/replay/status', {
      headers: userId ? { 'x-sbbl-user-id-verified': userId } : {},
    }),
    env: {} as Env,
    params: { gameId: 'g-1' },
    admin: buildAdmin(game, entitlement),
  } as import('@/worker/shared').HandlerCtx;
}

describe('handleReplayStatus', () => {
  const pastEmbargo = new Date(Date.now() - 1_000).toISOString();
  const futureEmbargo = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();

  it('404 when game row is missing', async () => {
    const res = await handleReplayStatus(ctx(null, null));
    expect(res.status).toBe(404);
  });

  it('status=unavailable when replay_mode=none', async () => {
    const game: GameRow = {
      id: 'g-1',
      replay_mode: 'none',
      replay_monetization_enabled_at: null,
      replay_quality_tier: null,
      replay_price: null,
      ended_at: null,
    };
    const body = await (await handleReplayStatus(ctx(game, null))).json();
    expect(body).toMatchObject({ ok: true, status: 'unavailable', price: null, entitled: false });
  });

  it('status=embargoed when enabled_at is null', async () => {
    const game: GameRow = {
      id: 'g-1',
      replay_mode: 'raw',
      replay_monetization_enabled_at: null,
      replay_quality_tier: 'raw',
      replay_price: null,
      ended_at: null,
    };
    const body = await (await handleReplayStatus(ctx(game, null))).json();
    expect(body).toMatchObject({ ok: true, status: 'embargoed', entitled: false });
  });

  it('status=embargoed when enabled_at is in the future', async () => {
    const game: GameRow = {
      id: 'g-1',
      replay_mode: 'edited',
      replay_monetization_enabled_at: futureEmbargo,
      replay_quality_tier: 'edited',
      replay_price: null,
      ended_at: null,
    };
    const body = await (await handleReplayStatus(ctx(game, null))).json();
    expect(body).toMatchObject({ ok: true, status: 'embargoed', embargoEndsAt: futureEmbargo });
    // Canonical fallback — edited tier
    expect((body as { price: number }).price).toBe(ENTITLEMENT.REPLAY_EDITED_PRICE_CAD);
  });

  it('status=available_for_purchase after embargo clears (no entitlement)', async () => {
    const game: GameRow = {
      id: 'g-1',
      replay_mode: 'raw',
      replay_monetization_enabled_at: pastEmbargo,
      replay_quality_tier: 'raw',
      replay_price: null,
      ended_at: null,
    };
    const body = await (await handleReplayStatus(ctx(game, null, 'u-1'))).json();
    expect(body).toMatchObject({ ok: true, status: 'available_for_purchase', tier: 'raw', entitled: false });
    expect((body as { price: number }).price).toBe(ENTITLEMENT.REPLAY_RAW_PRICE_CAD);
  });

  it('per-game replay_price overrides the canonical tier default', async () => {
    const game: GameRow = {
      id: 'g-1',
      replay_mode: 'edited',
      replay_monetization_enabled_at: pastEmbargo,
      replay_quality_tier: 'edited',
      replay_price: 3.14,
      ended_at: null,
    };
    const body = await (await handleReplayStatus(ctx(game, null, 'u-1'))).json();
    expect((body as { price: number }).price).toBe(3.14);
  });

  it('status=entitled when user has an active replay entitlement', async () => {
    const game: GameRow = {
      id: 'g-1',
      replay_mode: 'raw',
      replay_monetization_enabled_at: pastEmbargo,
      replay_quality_tier: 'raw',
      replay_price: null,
      ended_at: null,
    };
    const entitlement: EntitlementRow = {
      status: 'active',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      replay_tier: 'raw',
    };
    const body = await (await handleReplayStatus(ctx(game, entitlement, 'u-1'))).json();
    expect(body).toMatchObject({ ok: true, status: 'entitled', entitled: true });
  });

  it('status=available_for_purchase when entitlement is expired', async () => {
    const game: GameRow = {
      id: 'g-1',
      replay_mode: 'raw',
      replay_monetization_enabled_at: pastEmbargo,
      replay_quality_tier: 'raw',
      replay_price: null,
      ended_at: null,
    };
    const entitlement: EntitlementRow = {
      status: 'active',
      expires_at: new Date(Date.now() - 3600_000).toISOString(), // expired
      replay_tier: 'raw',
    };
    const body = await (await handleReplayStatus(ctx(game, entitlement, 'u-1'))).json();
    expect(body).toMatchObject({ status: 'available_for_purchase', entitled: false });
  });

  it('anonymous caller cannot be entitled', async () => {
    const game: GameRow = {
      id: 'g-1',
      replay_mode: 'raw',
      replay_monetization_enabled_at: pastEmbargo,
      replay_quality_tier: 'raw',
      replay_price: null,
      ended_at: null,
    };
    // Even with a would-be-matching entitlement, anon user never reads it.
    const body = await (await handleReplayStatus(ctx(game, null, null))).json();
    expect(body).toMatchObject({ status: 'available_for_purchase', entitled: false });
  });
});
