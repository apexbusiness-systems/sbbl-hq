/**
 * WS6 flag-off regression — overlay event route returns 403 when the
 * feature flag is off, with zero DB / RPC / channel access.
 */
import { describe, expect, it } from 'vitest';
import { handleMicUpOverlayEvent } from '@/worker/routes/overlay-events';

function ctxWithEnv(envOverrides: Partial<Env> = {}) {
  const env = {
    SUPABASE_URL: 'http://local',
    SUPABASE_SERVICE_ROLE_KEY: 'srk',
    STRIPE_SECRET_KEY: 'sk',
    STRIPE_WEBHOOK_SECRET: 'whs',
    RESEND_API_KEY: 'rk',
    ASSETS: { fetch: async () => new Response('') },
    ...envOverrides,
  } as unknown as Env;
  return {
    req: new Request('http://local/api/streams/g-1/overlay/event', {
      method: 'POST',
      headers: { 'x-sbbl-user-id-verified': 'u-1' },
    }),
    env,
    params: { gameId: 'g-1' },
    admin: {
      from() {
        throw new Error('DB accessed despite flag off');
      },
      rpc() {
        throw new Error('RPC called despite flag off');
      },
      channel() {
        throw new Error('Channel accessed despite flag off');
      },
    } as unknown as import('@/worker/shared').HandlerCtx['admin'],
  } as import('@/worker/shared').HandlerCtx;
}

describe('mic-up overlay-event flag-off invariants', () => {
  it('returns 403 mic_up_disabled when flag unset', async () => {
    const res = await handleMicUpOverlayEvent(ctxWithEnv({}));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: 'mic_up_disabled' });
  });

  it("returns 403 when flag is 'false'", async () => {
    const res = await handleMicUpOverlayEvent(ctxWithEnv({ FEATURE_MIC_UP_SERIES: 'false' }));
    expect(res.status).toBe(403);
  });
});
