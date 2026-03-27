import { canAccessOps } from '@/lib/auth/roles';
import { safeServerEnv } from '@/lib/env';
import { readIdempotencyKey } from '@/lib/api/idempotency';

type HandlerCtx = {
  req: Request;
  env: Env;
  params: Record<string, string>;
};

type Handler = (ctx: HandlerCtx) => Promise<Response>;

type Route = { method: string; regex: RegExp; handler: Handler };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function getRoles(req: Request) {
  const header = req.headers.get('x-sbbl-roles');
  if (!header) return ['fan'];
  return header.split(',').map((r) => r.trim()).filter(Boolean);
}

function requireAuth(req: Request) {
  const userId = req.headers.get('x-sbbl-user-id');
  if (!userId) {
    throw new Error('unauthorized');
  }

  return userId;
}

function ensureMutation(req: Request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
  readIdempotencyKey(req.headers);
}

async function handleAuthSession({ req }: HandlerCtx) {
  try {
    const userId = requireAuth(req);
    return json({ ok: true, userId, roles: getRoles(req) });
  } catch {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
}

async function handleMe({ req }: HandlerCtx) {
  const userId = requireAuth(req);
  return json({ id: userId, profileStatus: 'active', roles: getRoles(req) });
}

async function handleMutationAck({ req, params }: HandlerCtx) {
  ensureMutation(req);
  const userId = requireAuth(req);
  return json({ ok: true, userId, route: params.route, at: new Date().toISOString() });
}

async function handleOps({ req }: HandlerCtx) {
  const userId = requireAuth(req);
  const roles = getRoles(req);
  if (!canAccessOps(roles as never)) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  return json({
    ok: true,
    userId,
    queue: [
      { type: 'source_conflict', league: 'WBL', status: 'pending' },
      { type: 'rule_conflict', league: 'SBBL', status: 'pending' },
      { type: 'stream_risk', league: 'SBBL', status: 'warning' },
    ],
  });
}

function routeToRegex(path: string) {
  const pattern = path.replace(/:[^/]+/g, '([^/]+)');
  return new RegExp(`^${pattern}$`);
}

const routes: Array<{ method: string; path: string; handler: Handler }> = [
  { method: 'GET', path: '/auth/session', handler: handleAuthSession },
  { method: 'GET', path: '/api/profile/me', handler: handleMe },
  { method: 'POST', path: '/api/profile/onboarding', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'profile-onboarding' } }) },
  { method: 'POST', path: '/api/profile/headshot', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'profile-headshot' } }) },
  { method: 'GET', path: '/api/games/:id/stat-sheet', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'games-stat-sheet', ...ctx.params } }) },
  { method: 'POST', path: '/api/games/:id/stats/draft', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'games-stats-draft', ...ctx.params } }) },
  { method: 'POST', path: '/api/games/:id/stats/finalize', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'games-stats-finalize', ...ctx.params } }) },
  { method: 'GET', path: '/api/stats', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'stats' } }) },
  { method: 'GET', path: '/api/leaderboards', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'leaderboards' } }) },
  { method: 'GET', path: '/api/streams/:gameId/preview', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'streams-preview', ...ctx.params } }) },
  { method: 'POST', path: '/api/streams/:gameId/purchase', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'streams-purchase', ...ctx.params } }) },
  { method: 'GET', path: '/api/streams/:gameId/access', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'streams-access', ...ctx.params } }) },
  { method: 'POST', path: '/api/streams/:gameId/session', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'streams-session', ...ctx.params } }) },
  { method: 'GET', path: '/api/cart', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'cart' } }) },
  { method: 'POST', path: '/api/cart/items', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'cart-items' } }) },
  { method: 'POST', path: '/api/orders', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'orders' } }) },
  { method: 'POST', path: '/api/orders/:id/pay', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'orders-pay', ...ctx.params } }) },
  { method: 'GET', path: '/api/billing/history', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'billing-history' } }) },
  { method: 'POST', path: '/api/rewards/redeem', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'rewards-redeem' } }) },
  { method: 'GET', path: '/ops/review', handler: handleOps },
  { method: 'POST', path: '/ops/review/:id/resolve', handler: handleOps },
  { method: 'GET', path: '/ops/streams', handler: handleOps },
  { method: 'GET', path: '/ops/publish-jobs', handler: handleOps },
  { method: 'GET', path: '/ops/revenue', handler: handleOps },
  { method: 'GET', path: '/ops/headshots', handler: handleOps },
  { method: 'POST', path: '/webhooks/stripe', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'webhooks-stripe' } }) },
];

const compiled: Route[] = routes.map((route) => ({
  method: route.method,
  regex: routeToRegex(route.path),
  handler: route.handler,
}));

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const parsed = safeServerEnv(env as unknown as Record<string, unknown>);

    const url = new URL(req.url);
    if (!parsed.ok && (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth') || url.pathname.startsWith('/ops') || url.pathname.startsWith('/webhooks'))) {
      return json({ ok: false, error: 'server_misconfigured', missing: parsed.missing }, 500);
    }

    for (const route of compiled) {
      if (route.method !== req.method) continue;
      const match = url.pathname.match(route.regex);
      if (!match) continue;

      const params: Record<string, string> = {};
      const keys = [...url.pathname.matchAll(/\/(?:[^/]+)/g)].map((item) => item[0].slice(1));
      keys.forEach((key, index) => {
        params[key] = match[index + 1] ?? key;
      });

      try {
        return await route.handler({ req, env, params });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'internal_error';
        const status = message === 'unauthorized' ? 401 : message.startsWith('Missing or invalid idempotency key') ? 400 : 500;
        return json({ ok: false, error: message }, status);
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(req);
    }

    return json({ ok: false, error: 'not_found' }, 404);
  },
};
