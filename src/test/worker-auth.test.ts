import { describe, expect, it } from 'vitest';
import { handleAuthSession } from '@/worker/index';

describe('handleAuthSession', () => {
  it('returns unauthorized JSON when auth is missing', async () => {
    // Mock requireAuth implicitly by providing a request without x-sbbl-user-id-verified
    const req = new Request('https://local/auth/session');

    // We only need the req property for this test
    const ctx = { req } as any;

    const res = await handleAuthSession(ctx);

    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('returns user session when auth is present', async () => {
    // Provide a request with the verified header so requireAuth succeeds
    const req = new Request('https://local/auth/session', {
      headers: {
        'x-sbbl-user-id-verified': 'user-123',
        'x-sbbl-roles-verified': 'admin,fan'
      }
    });

    const ctx = { req } as any;

    const res = await handleAuthSession(ctx);

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      userId: 'user-123',
      roles: ['admin', 'fan']
    });
  });
});
