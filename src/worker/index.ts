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

const textEncoder = new TextEncoder();

function parseStripeSignature(header: string) {
  const fields = header.split(',').map((part) => part.trim());
  const timestamp = fields.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = fields
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter(Boolean);
  return {
    timestamp: timestamp ? Number(timestamp) : NaN,
    signatures,
  };
}

async function signHmacSha256(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string, nowMs = Date.now()) {
  const parsed = parseStripeSignature(signatureHeader);
  if (!Number.isFinite(parsed.timestamp) || parsed.signatures.length === 0) return false;

  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - parsed.timestamp);
  if (ageSeconds > 300) return false;

  const payload = `${parsed.timestamp}.${rawBody}`;
  const expected = await signHmacSha256(secret, payload);
  return parsed.signatures.some((candidate) => candidate.toLowerCase() === expected);
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

async function handleStripeWebhook(ctx: HandlerCtx) {
  const secret = ctx.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ ok: false, error: 'stripe_webhook_secret_missing' }, 503);

  const signature = ctx.req.headers.get('stripe-signature');
  if (!signature) return json({ ok: false, error: 'stripe_signature_missing' }, 400);

  const rawBody = await ctx.req.text();
  const verified = await verifyStripeSignature(rawBody, signature, secret);
  if (!verified) {
    await writeIngressFailure(ctx.admin, 'invalid_stripe_signature', { body: rawBody }, 'webhook', null);
    return json({ ok: false, error: 'invalid_stripe_signature' }, 400);
  }

  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody) as { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  } catch {
    await writeIngressFailure(ctx.admin, 'invalid_stripe_json', { body: rawBody }, 'webhook', null);
    return json({ ok: false, error: 'invalid_stripe_json' }, 400);
  }
  if (!event.id || !event.type) return json({ ok: false, error: 'invalid_stripe_event' }, 400);

  const object = event.data?.object ?? {};
  const metadata = (object.metadata as Record<string, unknown> | undefined) ?? {};
  const userId = typeof metadata.user_id === 'string' ? metadata.user_id : null;
  const providerRef = typeof object.id === 'string'
    ? object.id
    : typeof object.payment_intent === 'string'
      ? object.payment_intent
      : event.id;
  const webhookProcess = await ctx.admin.rpc('process_stripe_webhook', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_user_id: userId,
    p_order_id: typeof metadata.order_id === 'string' ? metadata.order_id : null,
    p_provider_ref: providerRef,
    p_payload: event,
  });
  if (webhookProcess.error) throw new Error(webhookProcess.error.message);

  return json({
    ok: true,
    eventId: event.id,
    type: event.type,
    duplicate: Boolean((webhookProcess.data as { duplicate?: boolean } | null)?.duplicate),
  });
}


async function requireAdminSession(req: Request, admin: SupabaseClient) {
  const userId = requireAuth(req);
  const { data, error } = await admin.from('user_role_assignments').select('role').eq('user_id', userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row) => String(row.role));
  if (!roles.some((role) => role === 'league_admin' || role === 'super_admin' || role === 'team_manager')) {
    throw new Error('forbidden');
  }
  return { userId, roles };
}

async function writeImportJob(admin: SupabaseClient, job: {
  job_type: string;
  submitted_by: string;
  total_rows: number;
  inserted_rows: number;
  failed_rows: number;
  payload_summary: Record<string, unknown>;
  error_summary?: string | null;
}) {
  const { data, error } = await admin.from('import_jobs').insert({
    job_type: job.job_type,
    submitted_by: job.submitted_by,
    payload_summary: job.payload_summary,
    status: job.failed_rows > 0 ? 'completed_with_errors' : 'completed',
    total_rows: job.total_rows,
    inserted_rows: job.inserted_rows,
    failed_rows: job.failed_rows,
    error_summary: job.error_summary ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

async function handleOpsBootstrap({ req, admin }: HandlerCtx) {
  const session = await requireAdminSession(req, admin);
  const [profileRes, leaguesRes, seasonsRes, divisionsRes, venuesRes, historyRes] = await Promise.all([
    admin.from('profiles').select('display_name,full_name').eq('user_id', session.userId).maybeSingle(),
    admin.from('leagues').select('id,name,code').order('name'),
    admin.from('seasons').select('id,name,league_id').order('created_at', { ascending: false }).limit(100),
    admin.from('divisions').select('id,name,season_id').order('name').limit(300),
    admin.from('venues').select('id,name').order('name').limit(300),
    admin.from('import_jobs').select('*').order('created_at', { ascending: false }).limit(25),
  ]);

  if (profileRes.error || leaguesRes.error || seasonsRes.error || divisionsRes.error || venuesRes.error || historyRes.error) {
    throw new Error('ops_bootstrap_failed');
  }

  return json({
    ok: true,
    user: {
      userId: session.userId,
      email: req.headers.get('x-sbbl-user-id') ?? null,
      profile: profileRes.data ?? null,
    },
    roles: session.roles,
    references: {
      leagues: leaguesRes.data ?? [],
      seasons: seasonsRes.data ?? [],
      divisions: divisionsRes.data ?? [],
      venues: venuesRes.data ?? [],
    },
    importHistory: historyRes.data ?? [],
  });
}

async function handleImportRoute(ctx: HandlerCtx, kind: 'teams' | 'players' | 'schedules' | 'events') {
  await ensureMutation(ctx.req, ctx);
  const session = await requireAdminSession(ctx.req, ctx.admin);
  const body = await ctx.req.json().catch(() => null) as { rows?: Array<Record<string, string>> } | null;
  const rows = body?.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return json({ ok: false, error: 'rows_required' }, 400);
  }

  let insertedRows = 0;
  let failedRows = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      if (kind === 'teams') {
        const { error } = await ctx.admin.from('teams').insert({
          league_id: row.league_id,
          season_id: row.season_id,
          division_id: row.division_id || null,
          name: row.name,
          status: 'published',
        });
        if (error && !String(error.message).includes('duplicate key')) throw error;
      }

      if (kind === 'players') {
        const { error } = await ctx.admin.from('players').upsert({
          user_id: row.user_id,
          team_id: row.team_id || null,
          league_id: row.league_id || null,
          jersey_number: row.jersey_number ? Number(row.jersey_number) : null,
          position: row.position || null,
        }, { onConflict: 'user_id' });
        if (error) throw error;
      }

      if (kind === 'schedules') {
        const { error } = await ctx.admin.from('schedule_slots').insert({
          league_id: row.league_id,
          season_id: row.season_id,
          venue_id: row.venue_id || null,
          court_id: row.court_id || null,
          starts_at: row.starts_at,
          ends_at: row.ends_at || null,
          status: row.status || 'upcoming',
        });
        if (error) throw error;
      }

      if (kind === 'events') {
        const { error } = await ctx.admin.from('league_events').insert({
          league_id: row.league_id || null,
          season_id: row.season_id || null,
          venue_id: row.venue_id || null,
          title: row.title,
          starts_at: row.starts_at || null,
          metadata: row,
        });
        if (error) throw error;
      }

      await ctx.admin.rpc('enqueue_local_domain_event', {
        p_event_type: `${kind}_imported`,
        p_entity_type: kind,
        p_entity_id: null,
        p_league_id: row.league_id || null,
        p_payload: row,
        p_trace_id: crypto.randomUUID(),
        p_available_at: new Date().toISOString(),
      });
      insertedRows += 1;
    } catch (error) {
      failedRows += 1;
      errors.push(error instanceof Error ? error.message : 'import_failed');
      await writeIngressFailure(ctx.admin, `${kind}_import_failed`, row, 'admin_mutation', session.userId);
    }
  }

  const job = await writeImportJob(ctx.admin, {
    job_type: kind,
    submitted_by: session.userId,
    total_rows: rows.length,
    inserted_rows: insertedRows,
    failed_rows: failedRows,
    payload_summary: { sample: rows[0] ?? null },
    error_summary: errors.slice(0, 5).join('; ') || null,
  });

  await ctx.admin.from('audit_logs').insert({
    actor_id: session.userId,
    action: `ops_import_${kind}`,
    ref_type: 'import_job',
    ref_id: job.id,
    payload: { total_rows: rows.length, inserted_rows: insertedRows, failed_rows: failedRows },
    idempotency_key: readIdempotencyKey(ctx.req.headers),
  });

  return json({ ok: true, summary: job });
}

async function handleImportHistory({ req, admin }: HandlerCtx) {
  await requireAdminSession(req, admin);
  const { data, error } = await admin.from('import_jobs').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return json({ ok: true, jobs: data ?? [] });
}

async function handleStoreMedia(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireAdminSession(ctx.req, ctx.admin);
  const payload = await ctx.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload || typeof payload.title !== 'string' || typeof payload.price !== 'number' || typeof payload.imageUrl !== 'string') {
    return json({ ok: false, error: 'invalid_store_payload' }, 400);
  }

  const product = await ctx.admin.from('products').insert({
    league_id: typeof payload.leagueId === 'string' ? payload.leagueId : null,
    name: payload.title,
    price: payload.price,
    status: payload.publishStatus === 'published' ? 'published' : 'draft',
  }).select('id').single();
  if (product.error) throw new Error(product.error.message);

  const media = await ctx.admin.from('media_assets').insert({
    league_id: typeof payload.leagueId === 'string' ? payload.leagueId : null,
    title: String(payload.title),
    status: payload.publishStatus === 'published' ? 'published' : 'draft',
    metadata: { image_url: payload.imageUrl, category: payload.category, product_id: product.data.id },
  }).select('id').single();
  if (media.error) throw new Error(media.error.message);

  await ctx.admin.from('audit_logs').insert({
    actor_id: session.userId,
    action: 'ops_store_media_upsert',
    ref_type: 'product',
    ref_id: product.data.id,
    payload: { media_asset_id: media.data.id },
    idempotency_key: readIdempotencyKey(ctx.req.headers),
  });

  return json({ ok: true, productId: product.data.id, mediaAssetId: media.data.id });
}

async function handleTeamsList({ req, admin }: HandlerCtx) {
  const leagueId = new URL(req.url).searchParams.get('leagueId');
  let query = admin.from('teams').select('id,name,divisions(name),seasons(name),leagues(name),team_memberships(id)').eq('status', 'published').limit(200);
  if (leagueId) query = query.eq('league_id', leagueId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const teams = (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name),
    league_name: String((row.leagues as { name?: string } | null)?.name ?? 'League'),
    season_name: String((row.seasons as { name?: string } | null)?.name ?? 'Season'),
    division_name: (row.divisions as { name?: string } | null)?.name ?? null,
    roster_count: Array.isArray(row.team_memberships) ? row.team_memberships.length : 0,
  }));

  return json({ ok: true, teams });
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
  { method: 'GET', path: '/ops/bootstrap', handler: handleOpsBootstrap },
  { method: 'POST', path: '/ops/imports/teams', handler: (ctx) => handleImportRoute(ctx, 'teams') },
  { method: 'POST', path: '/ops/imports/players', handler: (ctx) => handleImportRoute(ctx, 'players') },
  { method: 'POST', path: '/ops/imports/schedules', handler: (ctx) => handleImportRoute(ctx, 'schedules') },
  { method: 'POST', path: '/ops/imports/events', handler: (ctx) => handleImportRoute(ctx, 'events') },
  { method: 'GET', path: '/ops/imports/history', handler: handleImportHistory },
  { method: 'POST', path: '/ops/store/media', handler: handleStoreMedia },
  { method: 'GET', path: '/api/teams', handler: handleTeamsList },
  { method: 'GET', path: '/ops/review', handler: handleOps },
  { method: 'POST', path: '/ops/review/:id/resolve', handler: handleOps },
  { method: 'GET', path: '/ops/streams', handler: handleOps },
  { method: 'GET', path: '/ops/publish-jobs', handler: handleOps },
  { method: 'GET', path: '/ops/revenue', handler: handleOps },
  { method: 'GET', path: '/ops/headshots', handler: handleOps },
  { method: 'POST', path: '/api/ingress', handler: handleIngress },
  { method: 'POST', path: '/sync/drain', handler: handleSyncDrain },
  { method: 'POST', path: '/webhooks/stripe', handler: handleStripeWebhook },
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
          : message === 'forbidden'
            ? 403
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
