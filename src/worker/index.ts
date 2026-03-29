import { canAccessOps } from '@/lib/auth/roles';
import { safeServerEnv } from '@/lib/env';
import { readIdempotencyKey } from '@/lib/api/idempotency';
import { normalizeIngress, type IngressSourceType } from '@/lib/omniport';
import { signSyncPacket, type SyncPacket } from '@/lib/sync-packets';
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

async function writeIngressFailure(admin: SupabaseClient, reason: string, rawInput: unknown, sourceType: string, userId?: string | null) {
  await admin.from('ingress_buffer').insert({
    correlation_id: crypto.randomUUID(),
    raw_input: rawInput,
    error_reason: reason,
    status: 'failed',
    risk_score: 100,
    source_type: sourceType,
    user_id: userId ?? null,
  });
}

async function handleIngress(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = requireAuth(ctx.req);
  const payload = await ctx.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) {
    await writeIngressFailure(ctx.admin, 'invalid_json', { body: null }, 'admin_mutation', session);
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  try {
    const envelope = normalizeIngress({
      source_type: (payload.source_type as IngressSourceType | undefined) ?? 'admin_mutation',
      actor_id: session,
      device_id: (ctx.req.headers.get('x-sbbl-device-id') ?? null),
      league_id: (payload.league_id as string | undefined) ?? null,
      entity_type: (payload.entity_type as string | undefined) ?? 'unknown',
      entity_id: (payload.entity_id as string | undefined) ?? null,
      payload: (payload.payload as Record<string, unknown> | undefined) ?? payload,
      correlation_id: (payload.correlation_id as string | undefined) ?? undefined,
      trace_id: (payload.trace_id as string | undefined) ?? undefined,
    });

    if (envelope.risk_lane === 'BLOCKED') {
      await ctx.admin.rpc('record_ingress_failure', {
        p_correlation_id: envelope.correlation_id,
        p_raw_input: payload,
        p_error_reason: 'blocked_by_policy',
        p_risk_score: 999,
        p_source_type: envelope.source_type,
        p_user_id: session,
      });
      await ctx.admin.rpc('log_admin_action', {
        p_action: 'blocked_ingress',
        p_ref_type: envelope.entity_type,
        p_ref_id: envelope.entity_id,
        p_payload: envelope,
        p_idempotency_key: readIdempotencyKey(ctx.req.headers),
      });
      return json({ ok: false, error: 'blocked_ingress', envelope }, 403);
    }

    const { error } = await ctx.admin.rpc('enqueue_local_domain_event', {
      p_event_type: 'ingress_received',
      p_entity_type: envelope.entity_type,
      p_entity_id: envelope.entity_id,
      p_league_id: envelope.league_id,
      p_payload: envelope,
      p_trace_id: envelope.trace_id,
      p_available_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return json({ ok: true, envelope });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'ingress_failed';
    await writeIngressFailure(ctx.admin, reason, payload, String(payload.source_type ?? 'admin_mutation'), session);
    return json({ ok: false, error: reason }, 400);
  }
}

async function handleSyncDrain(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  requireAuth(ctx.req);
  const limit = Math.max(1, Math.min(50, Number(new URL(ctx.req.url).searchParams.get('limit') ?? '20')));
  const { data, error } = await ctx.admin.rpc('claim_outbox_events', { p_limit: limit });
  if (error) throw new Error(error.message);
  const events = (data ?? []) as Array<Record<string, unknown>>;
  const results = [];

  for (const item of events) {
    const packet: SyncPacket = {
      packet_id: crypto.randomUUID(),
      trace_id: String(item.trace_id ?? crypto.randomUUID()),
      event_type: String(item.event_type ?? 'unknown'),
      entity_type: String(item.entity_type ?? 'unknown'),
      entity_id: (item.entity_id as string | null) ?? null,
      league_id: (item.league_id as string | null) ?? null,
      payload: (item.payload as Record<string, unknown> | undefined) ?? {},
      emitted_at: new Date().toISOString(),
    };
    const signed = await signSyncPacket(packet, ctx.env.OMNIHUB_SIGNING_SECRET ?? 'dev-signing-secret');
    const url = ctx.env.OMNIHUB_SYNC_URL;

    if (url) {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-sbbl-signature': signed.signature,
        },
        body: JSON.stringify(signed.packet),
      }).catch(() => null);

      if (!resp || !resp.ok) {
        await ctx.admin.rpc('mark_outbox_retry', { p_outbox_id: item.id, p_error_message: 'sync_delivery_failed' });
        results.push({ id: item.id, status: 'retry' });
        continue;
      }
    }

    await ctx.admin.rpc('mark_outbox_delivered', { p_outbox_id: item.id });
    results.push({ id: item.id, status: 'delivered' });
  }

  return json({ ok: true, processed: results.length, results });
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
  { method: 'POST', path: '/api/ingress', handler: handleIngress },
  { method: 'POST', path: '/sync/drain', handler: handleSyncDrain },
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
