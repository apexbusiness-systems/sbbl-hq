/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { handleInviteRedeem, handleStreamPurchase } from '@/worker/index';

function adminMock() {
  return {
    from(table: string) {
      if (table === 'api_idempotency_keys') {
        return { insert: async () => ({ error: null }) };
      }
      if (table === 'ppv_invites') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
    },
  } as any;
}

describe('turnstile hardening', () => {
  it('requires captcha token for stream purchase when turnstile secret is configured', async () => {
    const res = await handleStreamPurchase({
      req: new Request('https://local/api/streams/game-1/purchase', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'purchase-idempotency-key-123456',
          'x-sbbl-user-id-verified': 'u1',
          'cf-connecting-ip': '2.2.2.2',
        },
        body: JSON.stringify({ ppvPrice: 4.99 }),
      }),
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
        STRIPE_SECRET_KEY: 'stripe',
        STRIPE_WEBHOOK_SECRET: 'whsec',
        RESEND_API_KEY: 'resend',
        OPTIONAL_TURNSTILE_SECRET_KEY: 'turnstile-secret',
      } as any,
      params: {},
      admin: adminMock(),
    } as any);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: 'captcha_failed' });
  });

  it('requires captcha token for invite redeem when turnstile secret is configured', async () => {
    const res = await handleInviteRedeem({
      req: new Request('https://local/api/invite/redeem', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'invite-idempotency-key-123456',
          'x-sbbl-user-id-verified': 'u1',
          'cf-connecting-ip': '2.2.2.2',
        },
        body: JSON.stringify({ code: 'abc', gameId: 'game-1' }),
      }),
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
        STRIPE_SECRET_KEY: 'stripe',
        STRIPE_WEBHOOK_SECRET: 'whsec',
        RESEND_API_KEY: 'resend',
        OPTIONAL_TURNSTILE_SECRET_KEY: 'turnstile-secret',
      } as any,
      params: {},
      admin: adminMock(),
    } as any);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: 'captcha_failed' });
  });
});
