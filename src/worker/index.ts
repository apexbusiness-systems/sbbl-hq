import { canAccessOps } from '@/lib/auth/roles';
import { safeServerEnv } from '@/lib/env';
import { readIdempotencyKey } from '@/lib/api/idempotency';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type HandlerCtx = {
  req: Request;
  env: Env;
  params: Record<string, string>;
  admin: SupabaseClient;
};

type Handler = (ctx: HandlerCtx) => Promise<Response>;

type Route = { method: string; regex: RegExp; handler: Handler };
const transientIdempotency = new Map<string, number>();

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

function getBearerToken(req: Request) {
  const value = req.headers.get('authorization');
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice('Bearer '.length).trim();
}

async function getSession(req: Request, env: Env) {
  const token = getBearerToken(req);
  if (token && env.SUPABASE_PUBLISHABLE_KEY) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      return {
        userId: data.user.id,
        roles: getRoles(req),
      };
    }
  }

  const fallbackUserId = req.headers.get('x-sbbl-user-id');
  if (fallbackUserId) {
    return { userId: fallbackUserId, roles: getRoles(req) };
  }

  return null;
}

function requireAuth(req: Request) {
  const userId = req.headers.get('x-sbbl-user-id');
  if (!userId) {
    throw new Error('unauthorized');
  }

  return userId;
}

async function ensureMutation(req: Request, ctx: HandlerCtx) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
  const key = readIdempotencyKey(req.headers);
  const userId = requireAuth(req);
  const route = ctx.params.route ?? new URL(req.url).pathname;
  const { error } = await ctx.admin.from('api_idempotency_keys').insert({
    idempotency_key: key,
    route,
    user_id: userId,
  });
  if (error) {
    const now = Date.now();
    const seenAt = transientIdempotency.get(key);
    if (seenAt && now - seenAt < 5 * 60 * 1000) {
      throw new Error('Duplicate idempotency key');
    }
    transientIdempotency.set(key, now);
  }
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

async function handleMutationAck(ctx: HandlerCtx) {
  const { req, params } = ctx;
  await ensureMutation(req, ctx);
  const userId = requireAuth(req);
  return json({ ok: true, userId, route: params.route, params, at: new Date().toISOString() });
}

async function handleStats({ req, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  const filters = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { data, error } = await admin.rpc('get_stats_dashboard', { p_filters: filters });
  if (error) throw new Error(error.message);
  return json({ ok: true, userId, data });
}

async function handleLeaderboards({ req, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  const filters = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { data, error } = await admin.rpc('get_leaderboards', { p_filters: filters });
  if (error) throw new Error(error.message);
  return json({ ok: true, userId, data });
}

async function handleDraft(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const userId = requireAuth(ctx.req);
  const payload = await ctx.req.json().catch(() => ({}));
  const { error } = await ctx.admin.rpc('save_stat_draft', {
    p_game_id: ctx.params.id,
    p_payload: payload,
    p_idempotency_key: readIdempotencyKey(ctx.req.headers),
  });
  if (error) throw new Error(error.message);
  return json({ ok: true, userId, gameId: ctx.params.id, status: 'draft_saved' });
}

async function handleFinalize(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const userId = requireAuth(ctx.req);
  const payload = await ctx.req.json().catch(() => ({}));
  const { error } = await ctx.admin.rpc('finalize_game_stats', {
    p_game_id: ctx.params.id,
    p_payload: payload,
    p_idempotency_key: readIdempotencyKey(ctx.req.headers),
  });
  if (error) throw new Error(error.message);
  return json({ ok: true, userId, gameId: ctx.params.id, status: 'finalized' });
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
function compilePath(path: string) {
  const keys: string[] = [];
  const pattern = path.replace(/:([^/]+)/g, (_, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${pattern}$`), keys };
}

const routes: Array<{ method: string; path: string; handler: Handler }> = [
  { method: 'GET', path: '/auth/session', handler: handleAuthSession },
  { method: 'GET', path: '/api/profile/me', handler: handleMe },
  { method: 'POST', path: '/api/profile/onboarding', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'profile-onboarding' } }) },
  { method: 'POST', path: '/api/profile/headshot', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'profile-headshot' } }) },
  { method: 'GET', path: '/api/games/:id/stat-sheet', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'games-stat-sheet', ...ctx.params } }) },
  { method: 'POST', path: '/api/games/:id/stats/draft', handler: (ctx) => handleDraft({ ...ctx, params: { route: 'games-stats-draft', ...ctx.params } }) },
  { method: 'POST', path: '/api/games/:id/stats/finalize', handler: (ctx) => handleFinalize({ ...ctx, params: { route: 'games-stats-finalize', ...ctx.params } }) },
  { method: 'GET', path: '/api/stats', handler: handleStats },
  { method: 'GET', path: '/api/leaderboards', handler: handleLeaderboards },
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

const compiled: Array<Route & { keys: string[] }> = routes.map((route) => {
  const compiledPath = compilePath(route.path);
  return {
  method: route.method,
  regex: compiledPath.regex,
  handler: route.handler,
    keys: compiledPath.keys,
  };
});

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const parsed = safeServerEnv(env as unknown as Record<string, unknown>);

    const url = new URL(req.url);
    if (!parsed.ok && (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth') || url.pathname.startsWith('/ops') || url.pathname.startsWith('/webhooks'))) {
      return json({ ok: false, error: 'server_misconfigured', missing: parsed.missing }, 500);
    }

    const session = await getSession(req, env);
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const enrichedRequest = new Request(req, {
      headers: session
        ? {
            ...Object.fromEntries(req.headers.entries()),
            'x-sbbl-user-id': session.userId,
            'x-sbbl-roles': session.roles.join(','),
          }
        : req.headers,
    });

    for (const route of compiled) {
      if (route.method !== req.method) continue;
      const match = url.pathname.match(route.regex);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.keys.forEach((key, index) => {
        params[key] = match[index + 1] ?? '';
      });

      try {
        return await route.handler({ req: enrichedRequest, env, params, admin });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'internal_error';
        const status = message === 'unauthorized'
          ? 401
          : message.startsWith('Missing or invalid idempotency key') || message.startsWith('Duplicate idempotency key')
            ? 400
            : 500;
        return json({ ok: false, error: message }, status);
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(req);
    }

    return json({ ok: false, error: 'not_found' }, 404);
  },
};
