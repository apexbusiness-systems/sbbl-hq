/**
 * WS5 flag-off regression guard — both routes return 403 with zero DB
 * access when FEATURE_BIOMETRIC_OVERLAY is unset or 'false'.
 */
import { describe, expect, it } from 'vitest';
import {
  handleBiometricIngest,
  handleBiometricLatest,
} from '@/worker/routes/biometrics';

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
    req: new Request('http://local/api/streams/g-1/biometrics', {
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

describe('biometric flag-off invariants', () => {
  for (const [name, handler] of [
    ['ingest', handleBiometricIngest],
    ['latest', handleBiometricLatest],
  ] as const) {
    it(`${name} returns 403 biometric_disabled when flag unset`, async () => {
      const ctx = ctxWithEnv({});
      const res = await handler(ctx);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toMatchObject({ ok: false, error: 'biometric_disabled' });
    });

    it(`${name} returns 403 when flag is 'false'`, async () => {
      const ctx = ctxWithEnv({ FEATURE_BIOMETRIC_OVERLAY: 'false' });
      const res = await handler(ctx);
      expect(res.status).toBe(403);
    });
  }
});
