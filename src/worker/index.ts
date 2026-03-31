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

// SECURITY: roles are never read from client-supplied headers.
// They are set exclusively by getSession() after JWT verification and
// attached to the enriched internal request. This function is only called
// on the enriched request inside the worker, never on the raw client request.
function getRolesFromVerifiedSession(req: Request): string[] {
  const header = req.headers.get('x-sbbl-roles-verified');
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

// SECURITY: session is established ONLY via a valid Supabase JWT Bearer token.
// The x-sbbl-user-id fallback has been removed — any client-supplied identity
// header is ignored. If JWT verification fails, session is null (unauthenticated).
async function getSession(req: Request, env: Env) {
  const token = getBearerToken(req);
  if (token && env.SUPABASE_PUBLISHABLE_KEY) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      // Roles are fetched from DB on admin-gated routes via requireAdminSession().
      // For non-admin routes, default to 'fan' unless the DB assignment is present.
      return {
        userId: data.user.id,
        roles: ['fan'] as string[],
      };
    }
  }

  // No fallback. No token = no session.
  return null;
}

function requireAuth(req: Request) {
  const userId = req.headers.get('x-sbbl-user-id-verified');
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
    return json({ ok: true, userId, roles: getRolesFromVerifiedSession(req) });
  } catch {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
}

async function handleMe({ req }: HandlerCtx) {
  const userId = requireAuth(req);
  return json({ id: userId, profileStatus: 'active', roles: getRolesFromVerifiedSession(req) });
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
  const roles = getRolesFromVerifiedSession(req);
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

  // Best-effort post-payment side-effects — never block the 200 response.
  if (event.type === 'checkout.session.completed' && userId) {
    const purchaseType = typeof metadata.purchase_type === 'string' ? metadata.purchase_type : null;

    // Player registration: stamp subscription_ends_at (+30 days)
    if (!purchaseType || purchaseType === 'player_registration') {
      try {
        const now = new Date();
        now.setDate(now.getDate() + 30);
        await ctx.admin.from('profiles')
          .update({ subscription_ends_at: now.toISOString() })
          .eq('user_id', userId);
      } catch { /* non-critical */ }
    }

    // PPV purchase: create stream entitlement (24h access window)
    if (purchaseType === 'ppv' && typeof metadata.game_id === 'string') {
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        await ctx.admin.rpc('create_stream_entitlement', {
          p_game_id: metadata.game_id,
          p_user_id: userId,
          p_order_id: typeof metadata.order_id === 'string' ? metadata.order_id : null,
          p_expires_at: expiresAt.toISOString(),
          p_idempotency_key: event.id ?? crypto.randomUUID(),
        });
      } catch { /* non-critical — entitlement can be manually granted via ops */ }
    }

    // Store order: mark order as paid
    if (purchaseType === 'store_order' && typeof metadata.order_id === 'string') {
      try {
        await ctx.admin.rpc('mark_order_paid', {
          p_order_id: metadata.order_id,
          p_payment_ref: providerRef,
          p_idempotency_key: event.id ?? crypto.randomUUID(),
        });
        // Also close the cart
        const { data: orderRow } = await ctx.admin.from('orders')
          .select('metadata').eq('id', metadata.order_id).maybeSingle();
        const cartId = (orderRow as Record<string, unknown> | null)?.metadata
          ? ((orderRow as Record<string, unknown>).metadata as Record<string, unknown>)?.cart_id
          : null;
        if (typeof cartId === 'string') {
          await ctx.admin.from('carts').update({ status: 'completed' }).eq('id', cartId);
        }
      } catch { /* non-critical */ }
    }
  }

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
  if (!payload || typeof payload.title !== 'string' || typeof payload.price !== 'number' || typeof payload.imageUrl !== 'string') { // sale flag is optional boolean
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
    metadata: { image_url: payload.imageUrl, category: payload.category, product_id: product.data.id, sale: payload.sale === true },
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

// SECURITY: Public config endpoint returns ONLY non-sensitive application metadata.
// Supabase URL and publishable key are NOT returned here — the client SDK
// initializes via environment-injected config at build time, not runtime API calls.
async function handlePublicConfig(_ctx: HandlerCtx) {
  return json({
    ok: true,
    appName: 'SBBL HQ',
    defaultLeague: 'SBBL',
  });
}

async function handlePublicHome({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueCode = (url.searchParams.get('league') ?? 'SBBL').toUpperCase();

  const [leaguesRes, teamsRes, gamesRes, seasonsRes] = await Promise.all([
    admin.from('leagues').select('id,name,code').order('name'),
    admin.from('teams')
      .select('id,name,leagues(name,code),seasons(name),divisions(name),team_memberships(id)')
      .eq('status', 'published')
      .limit(200),
    admin.from('games')
      .select('id,home_team_id,away_team_id,status,home_score,away_score,scheduled_at,venue_id,venues(name),courts(name),season_id,seasons(league_id,leagues(code))')
      .in('status', ['live', 'upcoming', 'final'])
      .order('scheduled_at', { ascending: true })
      .limit(50),
    admin.from('seasons')
      .select('id,name,league_id,leagues(code),status')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const leagues = (leaguesRes.data ?? []) as Array<{ id: string; name: string; code: string }>;
  const activeLeague = leagues.find((l) => l.code?.toUpperCase() === leagueCode) ?? leagues[0] ?? null;
  const activeLeagueId = activeLeague?.id ?? null;

  const allTeams = (teamsRes.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name),
    league_code: ((row.leagues as { code?: string } | null)?.code ?? '').toUpperCase(),
    league_name: String((row.leagues as { name?: string } | null)?.name ?? ''),
    season_name: String((row.seasons as { name?: string } | null)?.name ?? ''),
    division_name: (row.divisions as { name?: string } | null)?.name ?? null,
    roster_count: Array.isArray(row.team_memberships) ? row.team_memberships.length : 0,
  }));
  const leagueTeams = activeLeagueId
    ? allTeams.filter((t) => t.league_code === leagueCode)
    : allTeams;

  const allGames = (gamesRes.data ?? []).map((row: Record<string, unknown>) => {
    const seasons = row.seasons as { league_id?: string; leagues?: { code?: string } } | null;
    return {
      id: String(row.id),
      home_team_id: row.home_team_id as string | null,
      away_team_id: row.away_team_id as string | null,
      status: String(row.status ?? 'upcoming'),
      home_score: row.home_score as number | null,
      away_score: row.away_score as number | null,
      scheduled_at: row.scheduled_at as string | null,
      venue: (row.venues as { name?: string } | null)?.name ?? null,
      court: (row.courts as { name?: string } | null)?.name ?? null,
      league_code: (seasons?.leagues?.code ?? '').toUpperCase(),
    };
  });
  const leagueGames = allGames.filter((g) => g.league_code === leagueCode);

  const teamMap = new Map(allTeams.map((t) => [t.id, t]));
  const enrichGame = (g: typeof leagueGames[0]) => ({
    ...g,
    home_team: teamMap.get(g.home_team_id ?? '') ?? null,
    away_team: teamMap.get(g.away_team_id ?? '') ?? null,
  });

  const liveGames = leagueGames.filter((g) => g.status === 'live').map(enrichGame);
  const upcomingGames = leagueGames.filter((g) => g.status === 'upcoming').slice(0, 5).map(enrichGame);
  const recentGames = leagueGames.filter((g) => g.status === 'final').slice(0, 5).map(enrichGame);

  const activeSeason = (seasonsRes.data ?? []).find(
    (s: Record<string, unknown>) => {
      const sLeagues = s.leagues as { code?: string } | null;
      return (sLeagues?.code ?? '').toUpperCase() === leagueCode;
    },
  ) as { id: string; name: string; status: string } | undefined;

  return json({
    ok: true,
    league: activeLeague,
    season: activeSeason ? { id: activeSeason.id, name: activeSeason.name, status: activeSeason.status } : null,
    teams: leagueTeams,
    totalTeams: leagueTeams.length,
    totalRostered: leagueTeams.reduce((sum, t) => sum + t.roster_count, 0),
    liveGames,
    upcomingGames,
    recentGames,
    totalGames: leagueGames.length,
    leagues: leagues.map((l) => ({ id: l.id, name: l.name, code: l.code })),
  });
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

async function handleParsePotgImage(ctx: HandlerCtx) {
  await requireAdminSession(ctx.req, ctx.admin);
  const apiKey = ctx.env.GROQ_API_KEY;
  if (!apiKey) return json({ ok: false, error: 'groq_api_key_missing' }, 503);

  const body = await ctx.req.json().catch(() => null) as { imageBase64: string; mimeType: string } | null;
  if (!body?.imageBase64 || !body?.mimeType) return json({ ok: false, error: 'image_required' }, 400);

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${body.mimeType};base64,${body.imageBase64}` } },
          { type: 'text', text: 'Extract player of the game data from this graphic. Return ONLY a JSON object with exactly these keys: playerName (string), team (string), pts (number), rebs (number), assts (number), gameResult (string, e.g. "TEAM A 77 vs TEAM B 63"). No markdown, no explanation — raw JSON only.' },
        ],
      }],
    }),
  });

  if (!resp.ok) return json({ ok: false, error: 'groq_error', status: resp.status }, 502);
  const ai = await resp.json() as { choices: Array<{ message: { content: string } }> };
  const raw = ai.choices[0]?.message?.content ?? '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return json({ ok: false, error: 'parse_failed', raw }, 422);
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return json({ ok: true, data: parsed });
  } catch {
    return json({ ok: false, error: 'invalid_json', raw }, 422);
  }
}

async function handleSubmitPotg(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireAdminSession(ctx.req, ctx.admin);
  const body = await ctx.req.json().catch(() => null) as {
    playerName: string; team: string; pts: number; rebs: number; assts: number;
    gameResult: string; leagueId: string; date?: string;
  } | null;

  if (!body?.playerName || !body?.team || !body?.leagueId) {
    return json({ ok: false, error: 'missing_required_fields' }, 400);
  }

  // Upsert player profile by display name + team within league
  const { data: profileData } = await ctx.admin.from('profiles')
    .select('user_id')
    .ilike('display_name', body.playerName.trim())
    .maybeSingle();

  // Upsert into player_game_stats via award_records table if player found,
  // otherwise write to import_jobs as a pending manual match
  const { data: jobData, error: jobError } = await ctx.admin.from('import_jobs').insert({
    job_type: 'potg_award',
    submitted_by: session.userId,
    payload_summary: {
      playerName: body.playerName,
      team: body.team,
      pts: body.pts,
      rebs: body.rebs,
      assts: body.assts,
      gameResult: body.gameResult,
      leagueId: body.leagueId,
      date: body.date ?? new Date().toISOString().split('T')[0],
      matched_profile_id: profileData?.user_id ?? null,
      source: 'potg_image_parser',
    },
    status: profileData ? 'completed' : 'pending_match',
    total_rows: 1,
    inserted_rows: profileData ? 1 : 0,
    failed_rows: profileData ? 0 : 0,
    error_summary: profileData ? null : 'Player profile not yet in system — award queued for manual match',
  }).select('id').single();

  if (jobError) throw new Error(jobError.message);

  // If player is matched, also write stat record
  if (profileData?.user_id) {
    await ctx.admin.from('player_game_stats').upsert({
      player_id: profileData.user_id,
      game_id: null, // will be linked when game record exists
      pts: body.pts,
      reb: body.rebs,
      ast: body.assts,
      stl: null, blk: null, fls: null, min: null,
    });
  }

  try {
    await ctx.admin.rpc('log_admin_action', {
      p_action: 'potg_submitted',
      p_ref_type: 'import_job',
      p_ref_id: jobData.id,
      p_payload: body,
      p_idempotency_key: readIdempotencyKey(ctx.req.headers),
    });
  } catch { /* non-critical audit log — suppress */ }

  return json({ ok: true, jobId: jobData.id, matched: !!profileData });
}

// ── STREAM ACCESS & PURCHASE ────────────────────────────────────────────────

async function handleStreamAccess({ req, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  const gameId = new URL(req.url).pathname.split('/')[3]; // /api/streams/:gameId/access
  const { data, error } = await admin.rpc('can_user_view_stream', {
    p_game_id: gameId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  const hasAccess = Boolean(data);
  return json({ ok: true, hasAccess, gameId, userId });
}

async function handleStreamPurchase({ req, env, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env, admin, params: {} });
  const userId = requireAuth(req);
  const gameId = new URL(req.url).pathname.split('/')[3];
  if (!env.STRIPE_SECRET_KEY) return json({ ok: false, error: 'payments_not_configured' }, 503);

  const body = await req.json().catch(() => null) as { successUrl?: string; cancelUrl?: string; ppvPrice?: number } | null;
  const unitAmount = Math.round((body?.ppvPrice ?? 2.5) * 100);
  const successUrl = body?.successUrl ?? 'https://sbbl-hq.icu/live?access=1';
  const cancelUrl = body?.cancelUrl ?? 'https://sbbl-hq.icu/live';

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': 'SBBL HQ PPV Access',
      'line_items[0][price_data][unit_amount]': String(unitAmount),
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      'metadata[user_id]': userId,
      'metadata[game_id]': gameId,
      'metadata[purchase_type]': 'ppv',
    }),
  });
  if (!stripeRes.ok) {
    const err = await stripeRes.json() as { error?: { message?: string } };
    return json({ ok: false, error: err?.error?.message ?? 'stripe_error' }, 502);
  }
  const checkout = await stripeRes.json() as { url: string; id: string };
  return json({ ok: true, url: checkout.url, sessionId: checkout.id });
}

// ── PROFILE ONBOARDING & HEADSHOT ───────────────────────────────────────────

async function handleProfileOnboarding({ req, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env: {} as Env, admin, params: {} });
  const userId = requireAuth(req);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, error: 'invalid_body' }, 400);

  // Upsert profile fields
  const { error: profileErr } = await admin.from('profiles').upsert({
    user_id: userId,
    display_name: typeof body.displayName === 'string' ? body.displayName : undefined,
    full_name: typeof body.fullName === 'string' ? body.fullName : undefined,
    bio: typeof body.bio === 'string' ? body.bio : undefined,
    preferred_league: typeof body.preferredLeague === 'string' ? body.preferredLeague : undefined,
    primary_role_intent: typeof body.primaryRoleIntent === 'string' ? body.primaryRoleIntent : undefined,
  }, { onConflict: 'user_id', ignoreDuplicates: false });
  if (profileErr) throw new Error(profileErr.message);

  // Create player record if role is player
  if (body.primaryRoleIntent === 'player') {
    await admin.from('players').upsert({
      user_id: userId,
      jersey_number: typeof body.jerseyNumber === 'number' ? body.jerseyNumber : null,
      position: typeof body.position === 'string' ? body.position : null,
      height: typeof body.height === 'string' ? body.height : null,
    }, { onConflict: 'user_id', ignoreDuplicates: true });
  }

  await admin.from('player_registration_submissions').insert({
    user_id: userId,
    payload: body,
    idempotency_key: readIdempotencyKey(req.headers),
  }).then(() => null);

  return json({ ok: true, userId });
}

async function handleProfileHeadshot({ req, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env: {} as Env, admin, params: {} });
  const userId = requireAuth(req);
  const body = await req.json().catch(() => null) as { assetUrl?: string; assetId?: string } | null;
  if (!body?.assetUrl && !body?.assetId) return json({ ok: false, error: 'asset_required' }, 400);

  // Lookup player record for this user
  const { data: playerRow } = await admin.from('players').select('id').eq('user_id', userId).maybeSingle();
  if (!playerRow) return json({ ok: false, error: 'player_profile_not_found' }, 404);

  // Create a media_asset record for the headshot
  let assetId = body.assetId;
  if (!assetId && body.assetUrl) {
    const { data: mediaRow, error: mediaErr } = await admin.from('media_assets').insert({
      title: `Headshot — ${userId}`,
      status: 'draft',
      metadata: { image_url: body.assetUrl, type: 'headshot' },
    }).select('id').single();
    if (mediaErr) throw new Error(mediaErr.message);
    assetId = mediaRow.id as string;
  }

  const { error } = await admin.from('player_profile_headshots').insert({
    player_id: playerRow.id as string,
    original_asset_id: assetId,
    cropped_asset_id: assetId,
    validation_result: 'review_required',
    status: 'pending',
    idempotency_key: readIdempotencyKey(req.headers),
  });
  if (error && !error.message.includes('duplicate')) throw new Error(error.message);
  return json({ ok: true, userId, assetId });
}

// ── CART & ORDERS ────────────────────────────────────────────────────────────

async function handleGetCart({ req, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  // Find active cart or return empty
  const { data: cart } = await admin.from('carts')
    .select('id,status,created_at')
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cart) return json({ ok: true, cart: null, items: [] });

  const { data: items } = await admin.from('cart_items')
    .select('id,variant_id,qty,created_at')
    .eq('cart_id', (cart as Record<string, unknown>).id);

  return json({ ok: true, cart, items: items ?? [] });
}

async function handleAddCartItem({ req, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env: {} as Env, admin, params: {} });
  const userId = requireAuth(req);
  const body = await req.json().catch(() => null) as { cartId?: string; variantId?: string; qty?: number } | null;
  if (!body?.variantId) return json({ ok: false, error: 'variant_id_required' }, 400);

  // Get or create an open cart
  let cartId = body.cartId;
  if (!cartId) {
    const { data: existing } = await admin.from('carts')
      .select('id').eq('user_id', userId).eq('status', 'open')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existing) {
      cartId = (existing as Record<string, unknown>).id as string;
    } else {
      const { data: newCart, error: cartErr } = await admin.from('carts')
        .insert({ user_id: userId, status: 'open', idempotency_key: readIdempotencyKey(req.headers) })
        .select('id').single();
      if (cartErr) throw new Error(cartErr.message);
      cartId = (newCart as Record<string, unknown>).id as string;
    }
  }

  const { error } = await admin.from('cart_items').insert({
    cart_id: cartId,
    variant_id: body.variantId,
    qty: body.qty ?? 1,
    idempotency_key: readIdempotencyKey(req.headers),
  });
  if (error && !error.message.includes('duplicate')) throw new Error(error.message);
  return json({ ok: true, cartId, variantId: body.variantId });
}

async function handleCreateOrder({ req, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env: {} as Env, admin, params: {} });
  const userId = requireAuth(req);
  const body = await req.json().catch(() => null) as { cartId?: string } | null;
  if (!body?.cartId) return json({ ok: false, error: 'cart_id_required' }, 400);

  // Verify cart belongs to user
  const { data: cart } = await admin.from('carts').select('id,status')
    .eq('id', body.cartId).eq('user_id', userId).maybeSingle();
  if (!cart) return json({ ok: false, error: 'cart_not_found' }, 404);

  // Get cart items to compute total
  const { data: items } = await admin.from('cart_items')
    .select('qty,variant_id').eq('cart_id', body.cartId);

  const { data: order, error } = await admin.from('orders').insert({
    user_id: userId,
    status: 'pending',
    total_amount: 0, // will be updated by payment webhook
    metadata: { cart_id: body.cartId, item_count: (items ?? []).length },
    idempotency_key: readIdempotencyKey(req.headers),
  }).select('id').single();
  if (error) throw new Error(error.message);

  // Mark cart as processing
  await admin.from('carts').update({ status: 'processing' }).eq('id', body.cartId);

  return json({ ok: true, orderId: (order as Record<string, unknown>).id, userId });
}

async function handlePayOrder(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, { ...ctx, params: {} });
  const userId = requireAuth(ctx.req);
  const orderId = ctx.params.id;
  if (!ctx.env.STRIPE_SECRET_KEY) return json({ ok: false, error: 'payments_not_configured' }, 503);

  const { data: order } = await ctx.admin.from('orders').select('id,total_amount,status')
    .eq('id', orderId).eq('user_id', userId).maybeSingle();
  if (!order) return json({ ok: false, error: 'order_not_found' }, 404);
  if ((order as Record<string, unknown>).status === 'paid') return json({ ok: true, alreadyPaid: true });

  const body = await ctx.req.json().catch(() => null) as { successUrl?: string; cancelUrl?: string } | null;
  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${ctx.env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': 'SBBL HQ Store Order',
      'line_items[0][price_data][unit_amount]': String((order as Record<string, unknown>).total_amount as number || 100),
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'success_url': body?.successUrl ?? 'https://sbbl-hq.icu/store?success=1',
      'cancel_url': body?.cancelUrl ?? 'https://sbbl-hq.icu/store',
      'metadata[user_id]': userId,
      'metadata[order_id]': orderId,
      'metadata[purchase_type]': 'store_order',
    }),
  });
  if (!stripeRes.ok) {
    const err = await stripeRes.json() as { error?: { message?: string } };
    return json({ ok: false, error: err?.error?.message ?? 'stripe_error' }, 502);
  }
  const checkout = await stripeRes.json() as { url: string; id: string };
  return json({ ok: true, url: checkout.url, sessionId: checkout.id });
}

// ── DIRECT STORE CHECKOUT ─────────────────────────────────────────────────────
// Accepts line items from the client (no DB variant records required).
// Used by BagDrawer until real DB products/variants are seeded.
async function handleDirectStoreCheckout({ req, env, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env, admin, params: {} });
  const userId = requireAuth(req);
  if (!env.STRIPE_SECRET_KEY) return json({ ok: false, error: 'payments_not_configured' }, 503);

  const body = await req.json().catch(() => null) as {
    items?: Array<{ name: string; price: number; qty?: number }>;
    successUrl?: string;
    cancelUrl?: string;
  } | null;

  if (!body?.items?.length) return json({ ok: false, error: 'items_required' }, 400);

  const params = new URLSearchParams({
    'payment_method_types[]': 'card',
    mode: 'payment',
    success_url: body.successUrl ?? `${new URL(req.url).origin}/store?success=1`,
    cancel_url: body.cancelUrl ?? `${new URL(req.url).origin}/store`,
    'metadata[user_id]': userId,
    'metadata[purchase_type]': 'store_order',
  });
  // price is in PHP whole units — Stripe expects centavos (×100)
  body.items.forEach((item, i) => {
    params.set(`line_items[${i}][price_data][currency]`, 'php');
    params.set(`line_items[${i}][price_data][product_data][name]`, item.name);
    params.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(item.price * 100)));
    params.set(`line_items[${i}][quantity]`, String(item.qty ?? 1));
  });

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!stripeRes.ok) {
    const err = await stripeRes.json() as { error?: { message?: string } };
    return json({ ok: false, error: err?.error?.message ?? 'stripe_error' }, 502);
  }
  const session = await stripeRes.json() as { url: string; id: string };
  return json({ ok: true, url: session.url, sessionId: session.id });
}

async function handlePublicProducts({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get('leagueId');
  let query = admin.from('products').select('id,name,price,status,league_id,metadata').eq('status', 'published').limit(100);
  if (leagueId) query = query.eq('league_id', leagueId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return json({ ok: true, data: data ?? [] });
}

async function handlePublicMedia({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get('leagueId');
  let query = admin.from('media_assets').select('id,title,status,league_id,metadata,created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(50);
  if (leagueId) query = query.eq('league_id', leagueId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return json({ ok: true, data: data ?? [] });
}

async function handlePlayerCheckout({ req, env, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env, admin, params: {} });
  const userId = requireAuth(req);
  if (!env.STRIPE_SECRET_KEY) return json({ ok: false, error: 'payments_not_configured' }, 503);
  const body = await req.json().catch(() => null) as { successUrl?: string; cancelUrl?: string } | null;
  const successUrl = body?.successUrl ?? 'https://sbbl-hq.icu/billing?success=1';
  const cancelUrl = body?.cancelUrl ?? 'https://sbbl-hq.icu/billing';

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': 'SBBL HQ Player Registration',
      'line_items[0][price_data][unit_amount]': '700',
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      'metadata[user_id]': userId,
    }),
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.json() as { error?: { message?: string } };
    return json({ ok: false, error: err?.error?.message ?? 'stripe_error' }, 502);
  }
  const checkout = await stripeRes.json() as { url: string; id: string };
  return json({ ok: true, url: checkout.url, sessionId: checkout.id });
}

async function handleBillingHistory({ req, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  const { data, error } = await admin.from('orders')
    .select('id,created_at,total_amount,status,metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return json({ ok: true, data: data ?? [] });
}

const routes: Array<{ method: string; path: string; handler: Handler }> = [
  { method: 'GET', path: '/auth/session', handler: handleAuthSession },
  { method: 'GET', path: '/api/profile/me', handler: handleMe },
  { method: 'POST', path: '/api/profile/onboarding', handler: handleProfileOnboarding },
  { method: 'POST', path: '/api/profile/headshot', handler: handleProfileHeadshot },
  { method: 'GET', path: '/api/games/:id/stat-sheet', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'games-stat-sheet', ...ctx.params } }) },
  { method: 'POST', path: '/api/games/:id/stats/draft', handler: (ctx) => handleDraft({ ...ctx, params: { route: 'games-stats-draft', ...ctx.params } }) },
  { method: 'POST', path: '/api/games/:id/stats/finalize', handler: (ctx) => handleFinalize({ ...ctx, params: { route: 'games-stats-finalize', ...ctx.params } }) },
  { method: 'GET', path: '/api/stats', handler: handleStats },
  { method: 'GET', path: '/api/leaderboards', handler: handleLeaderboards },
  { method: 'GET', path: '/api/streams/:gameId/preview', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'streams-preview', ...ctx.params } }) },
  { method: 'POST', path: '/api/streams/:gameId/purchase', handler: handleStreamPurchase },
  { method: 'GET', path: '/api/streams/:gameId/access', handler: handleStreamAccess },
  { method: 'POST', path: '/api/streams/:gameId/session', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'streams-session', ...ctx.params } }) },
  { method: 'GET', path: '/api/cart', handler: handleGetCart },
  { method: 'POST', path: '/api/cart/items', handler: handleAddCartItem },
  { method: 'DELETE', path: '/api/cart/items/:itemId', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'cart-item-delete', ...ctx.params } }) },
  { method: 'POST', path: '/api/orders', handler: handleCreateOrder },
  { method: 'POST', path: '/api/orders/:id/pay', handler: handlePayOrder },
  { method: 'GET', path: '/api/billing/history', handler: handleBillingHistory },
  { method: 'GET', path: '/api/public/products', handler: handlePublicProducts },
  { method: 'GET', path: '/api/public/media', handler: handlePublicMedia },
  { method: 'POST', path: '/api/player/checkout', handler: handlePlayerCheckout },
  { method: 'POST', path: '/api/store/checkout', handler: handleDirectStoreCheckout },
  { method: 'POST', path: '/api/rewards/redeem', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'rewards-redeem' } }) },
  { method: 'GET', path: '/ops/bootstrap', handler: handleOpsBootstrap },
  { method: 'POST', path: '/ops/imports/teams', handler: (ctx) => handleImportRoute(ctx, 'teams') },
  { method: 'POST', path: '/ops/imports/players', handler: (ctx) => handleImportRoute(ctx, 'players') },
  { method: 'POST', path: '/ops/imports/schedules', handler: (ctx) => handleImportRoute(ctx, 'schedules') },
  { method: 'POST', path: '/ops/imports/events', handler: (ctx) => handleImportRoute(ctx, 'events') },
  { method: 'GET', path: '/ops/imports/history', handler: handleImportHistory },
  { method: 'POST', path: '/ops/store/media', handler: handleStoreMedia },
  { method: 'POST', path: '/ops/potg/parse', handler: handleParsePotgImage },
  { method: 'POST', path: '/ops/potg/submit', handler: handleSubmitPotg },
  { method: 'GET', path: '/api/public-config', handler: handlePublicConfig },
  { method: 'GET', path: '/api/public/home', handler: handlePublicHome },
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

    // SECURITY: Strip any client-supplied spoofed identity/role headers BEFORE
    // processing. Session is established purely from JWT verification below.
    const cleanHeaders = new Headers(req.headers);
    cleanHeaders.delete('x-sbbl-user-id');
    cleanHeaders.delete('x-sbbl-user-id-verified');
    cleanHeaders.delete('x-sbbl-roles');
    cleanHeaders.delete('x-sbbl-roles-verified');
    const cleanReq = new Request(req, { headers: cleanHeaders });

    const session = await getSession(cleanReq, env);
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Internal verified headers are set here and ONLY here, after JWT verification.
    // These use a -verified suffix to distinguish them from any client-supplied headers
    // (which were stripped above).
    const enrichedRequest = new Request(cleanReq, {
      headers: session
        ? {
            ...Object.fromEntries(cleanReq.headers.entries()),
            'x-sbbl-user-id-verified': session.userId,
            'x-sbbl-roles-verified': session.roles.join(','),
          }
        : cleanReq.headers,
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
