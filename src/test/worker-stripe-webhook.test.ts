
if (typeof globalThis.caches === 'undefined') {
  globalThis.caches = {
    default: {
      match: async () => undefined,
      put: async () => undefined,
    }
  } as any;
}
import { beforeEach, describe, expect, it, vi } from 'vitest';

const billingEvents: Array<Record<string, unknown>> = [];
const paymentAttempts: Array<Record<string, unknown>> = [];
const rpc = vi.fn();

const from = vi.fn((table: string) => {
  if (table === 'billing_events') {
    return {
      select: () => ({
        eq: () => ({
          contains: (_col: string, payload: { event_id: string }) => ({
            limit: async () => ({
              data: billingEvents
                .filter((event) => event.payload && (event.payload as { event_id?: string }).event_id === payload.event_id)
                .map((event) => ({ id: event.id ?? crypto.randomUUID() })),
              error: null,
            }),
          }),
        }),
      }),
      insert: async (payload: Record<string, unknown>) => {
        billingEvents.push(payload);
        return { error: null };
      },
    };
  }

  if (table === 'payment_attempts') {
    return {
      insert: async (payload: Record<string, unknown>) => {
        paymentAttempts.push(payload);
        return { error: null };
      },
    };
  }

  return { insert: async () => ({ error: null }) };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('no-session') }) },
    from,
    rpc,
  }),
}));

import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
  STRIPE_SECRET_KEY: 'stripe-secret-123456789',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-123456789',
  RESEND_API_KEY: 'resend-key-123456789',
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

const textEncoder = new TextEncoder();

async function makeSignature(payload: string, secret: string, timestamp: number) {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${timestamp}.${payload}`));
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `t=${timestamp},v1=${hex}`;
}

describe('stripe webhook verification', () => {
  beforeEach(() => {
    billingEvents.length = 0;
    paymentAttempts.length = 0;
    from.mockClear();
    rpc.mockReset();
    rpc.mockImplementation(async (fn: string, payload: Record<string, unknown>) => {
      if (fn !== 'process_stripe_webhook') return { data: null, error: null };
      const eventId = payload.p_event_id as string;
      const eventType = payload.p_event_type as string;
      const duplicate = billingEvents.some((event) => event.event_id === eventId);
      if (duplicate) return { data: { duplicate: true }, error: null };

      billingEvents.push({ event_id: eventId, event_type: eventType });
      if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
        paymentAttempts.push({ event_id: eventId });
      }
      return { data: { duplicate: false }, error: null };
    });
  });

  it('rejects webhook events with invalid signatures', async () => {
    const body = JSON.stringify({ id: 'evt_invalid_sig', type: 'checkout.session.completed', data: { object: {} } });
    const res = await worker.fetch(new Request('https://local/webhooks/stripe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1,v1=invalid',
      },
      body,
    }), env);

    expect(res.status).toBe(400);
    expect(paymentAttempts).toHaveLength(0);
  });


  it('accepts verified events without metadata.user_id when order_id is present', async () => {
    const body = JSON.stringify({
      id: 'evt_order_owner_fallback',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          metadata: {
            order_id: 'f0d5a7ad-a8d0-4752-96dc-56698645f81e',
          },
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await makeSignature(body, env.STRIPE_WEBHOOK_SECRET as string, timestamp);

    const res = await worker.fetch(new Request('https://local/webhooks/stripe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      body,
    }), env);

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('process_stripe_webhook', expect.objectContaining({
      p_event_id: 'evt_order_owner_fallback',
      p_event_type: 'payment_intent.succeeded',
      p_order_id: 'f0d5a7ad-a8d0-4752-96dc-56698645f81e',
      p_user_id: null,
    }));
  });

  it('persists verified checkout events idempotently', async () => {
    const body = JSON.stringify({
      id: 'evt_success',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          metadata: {
            user_id: 'd59c1f85-e722-40bc-aa92-94457c3796fb',
            order_id: 'f0d5a7ad-a8d0-4752-96dc-56698645f81e',
          },
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await makeSignature(body, env.STRIPE_WEBHOOK_SECRET as string, timestamp);

    const first = await worker.fetch(new Request('https://local/webhooks/stripe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      body,
    }), env);
    expect(first.status).toBe(200);
    expect(billingEvents).toHaveLength(1);
    expect(paymentAttempts).toHaveLength(1);

    const second = await worker.fetch(new Request('https://local/webhooks/stripe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      body,
    }), env);
    expect(second.status).toBe(200);
    const secondPayload = await second.json() as { duplicate?: boolean };
    expect(secondPayload.duplicate).toBe(true);
    expect(billingEvents).toHaveLength(1);
    expect(paymentAttempts).toHaveLength(1);
  });
});
