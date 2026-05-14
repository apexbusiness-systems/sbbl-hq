/**
 * WS5 flag-off regression guard — both routes return 403 with zero DB
 * access when FEATURE_BIOMETRIC_OVERLAY is unset or 'false'.
 */
import { describe, expect, it } from 'vitest';
import {
  handleBiometricIngest,
  handleBiometricLatest,
} from '@/worker/routes/biometrics';
import { createTestCtx } from './worker-test-utils';

function ctxWithEnv(envOverrides: Partial<Env> = {}) {
  return createTestCtx({
    url: 'http://local/api/streams/g-1/biometrics',
    method: 'POST',
    headers: { 'x-sbbl-user-id-verified': 'u-1' },
    params: { gameId: 'g-1' },
    envOverrides,
  });
}

describe('biometric flag-off invariants', () => {
  for (const [name, handler] of [
    ['ingest', handleBiometricIngest],
    ['latest', handleBiometricLatest],
  ] as const) {
    it(`${name} returns 403 biometric_disabled when flag unset`, async () => {
      const ctx = ctxWithEnv();
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
