import type { HandlerCtx } from '@/worker/shared';

export interface TestCtxOptions {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  envOverrides?: Partial<Env>;
}

/**
 * Creates a mocked HandlerCtx for worker route testing.
 * By default, the admin client throws on any access to ensure that routes
 * gated by feature flags do not perform any database operations.
 */
export function createTestCtx(options: TestCtxOptions = {}): HandlerCtx {
  const {
    url = 'http://local',
    method = 'GET',
    headers = {},
    params = {},
    envOverrides = {},
  } = options;

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
    req: new Request(url, {
      method,
      headers,
    }),
    env,
    params,
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
    } as unknown as HandlerCtx['admin'],
  } as HandlerCtx;
}
