/**
 * WS4 flag-off regression guard.
 *
 * When FEATURE_FAN_TOKEN_SYSTEM is not 'true', every non-webhook route
 * MUST return 403 { error: 'fan_tokens_disabled' } without any
 * database access. This guarantees the feature adds zero runtime cost
 * to installations that have not opted in, and that any flag-off
 * attempt to invoke token endpoints fails fast.
 *
 * The webhook route is intentionally NOT gated (in-flight Stripe
 * sessions must complete safely even if ops toggles the flag mid-
 * purchase), so it is not tested here.
 */
import { describe, expect, it } from 'vitest';
import {
  handleLeaderboardByGame,
  handleLeaderboardBySeason,
  handleTokenAward,
  handleTokenCategories,
  handleTokenProducts,
  handleTokenPurchase,
  handleTokenWallet,
} from '@/worker/routes/tokens';

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
    req: new Request('http://local/api/tokens/x', {
      headers: { 'x-sbbl-user-id-verified': 'u-1' },
    }),
    env,
    params: { gameId: 'g-1', seasonId: 's-1' },
    admin: {
      // Proxy that throws if any method is called — proves no DB access.
      from() {
        throw new Error('DB accessed despite flag off');
      },
      rpc() {
        throw new Error('RPC called despite flag off');
      },
    } as unknown as import('@/worker/shared').HandlerCtx['admin'],
  } as import('@/worker/shared').HandlerCtx;
}

describe('fan-tokens flag-off invariants', () => {
  const handlers = [
    ['products',   handleTokenProducts],
    ['categories', handleTokenCategories],
    ['wallet',     handleTokenWallet],
    ['leaderboard-game',   handleLeaderboardByGame],
    ['leaderboard-season', handleLeaderboardBySeason],
    ['purchase',   handleTokenPurchase],
    ['award',      handleTokenAward],
  ] as const;

  for (const [name, handler] of handlers) {
    it(`${name} returns 403 fan_tokens_disabled when flag unset`, async () => {
      const ctx = ctxWithEnv({});
      const res = await handler(ctx);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toMatchObject({ ok: false, error: 'fan_tokens_disabled' });
    });

    it(`${name} returns 403 when flag is 'false'`, async () => {
      const ctx = ctxWithEnv({ FEATURE_FAN_TOKEN_SYSTEM: 'false' });
      const res = await handler(ctx);
      expect(res.status).toBe(403);
    });
  }
});
