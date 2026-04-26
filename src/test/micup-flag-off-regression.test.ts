/**
 * WS6 flag-off regression — overlay event route returns 403 when the
 * feature flag is off, with zero DB / RPC / channel access.
 */
import { describe, expect, it } from 'vitest';
import { handleMicUpOverlayEvent } from '@/worker/routes/overlay-events';
import { createTestCtx } from './worker-test-utils';

function ctxWithEnv(envOverrides: Partial<Env> = {}) {
  return createTestCtx({
    url: 'http://local/api/streams/g-1/overlay/event',
    method: 'POST',
    headers: { 'x-sbbl-user-id-verified': 'u-1' },
    params: { gameId: 'g-1' },
    envOverrides,
  });
}

describe('mic-up overlay-event flag-off invariants', () => {
  it('returns 403 mic_up_disabled when flag unset', async () => {
    const res = await handleMicUpOverlayEvent(ctxWithEnv());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: 'mic_up_disabled' });
  });

  it("returns 403 when flag is 'false'", async () => {
    const res = await handleMicUpOverlayEvent(ctxWithEnv({ FEATURE_MIC_UP_SERIES: 'false' }));
    expect(res.status).toBe(403);
  });
});
