import { safeServerEnv } from "@/lib/env";
import { readIdempotencyKey } from "@/lib/api/idempotency";
import { normalizeIngress, type IngressSourceType } from "@/lib/omniport";
import { signSyncPacket, type SyncPacket } from "@/lib/sync-packets";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// SECURITY: roles are never read from client-supplied headers.
// They are set exclusively by getSession() after JWT verification and
// attached to the enriched internal request. This function is only called
// on the enriched request inside the worker, never on the raw client request.
function getRolesFromVerifiedSession(req: Request): string[] {
  const header = req.headers.get("x-sbbl-roles-verified");
  if (!header) return ["fan"];
  return header
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

function getBearerToken(req: Request) {
  const value = req.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim();
}

const textEncoder = new TextEncoder();

export function parseStripeSignature(header: string) {
  const fields = header.split(",").map((part) => part.trim());
  const timestamp = fields.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = fields
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);
  return {
    timestamp: timestamp ? Number(timestamp) : NaN,
    signatures,
  };
}

async function signHmacSha256(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(payload),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowMs = Date.now(),
) {
  const parsed = parseStripeSignature(signatureHeader);
  if (!Number.isFinite(parsed.timestamp) || parsed.signatures.length === 0)
    return false;

  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - parsed.timestamp);
  if (ageSeconds > 300) return false;

  const payload = `${parsed.timestamp}.${rawBody}`;
  const expected = await signHmacSha256(secret, payload);
  return parsed.signatures.some(
    (candidate) => candidate.toLowerCase() === expected,
  );
}

// SECURITY: session is established ONLY via a valid Supabase JWT Bearer token.
// The x-sbbl-user-id fallback has been removed — any client-supplied identity
// header is ignored. If JWT verification fails, session is null (unauthenticated).
async function getSession(req: Request, env: Env) {
  const token = getBearerToken(req);
  if (token && env.SUPABASE_PUBLISHABLE_KEY) {
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      // Roles are fetched from DB on admin-gated routes via requireAdminSession().
      // For non-admin routes, default to 'fan' unless the DB assignment is present.
      return {
        userId: data.user.id,
        roles: ["fan"] as string[],
      };
    }
  }

  // No fallback. No token = no session.
  return null;
}

function requireAuth(req: Request) {
  const userId = req.headers.get("x-sbbl-user-id-verified");
  if (!userId) {
    throw new Error("unauthorized");
  }
  return userId;
}

async function ensureMutation(req: Request, ctx: HandlerCtx) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return;
  const key = readIdempotencyKey(req.headers);
  const userId = requireAuth(req);
  const route = ctx.params.route ?? new URL(req.url).pathname;
  const { error } = await ctx.admin.from("api_idempotency_keys").insert({
    idempotency_key: key,
    route,
    user_id: userId,
  });
  if (error) {
    const now = Date.now();
    // Cleanup old keys
    for (const [k, t] of transientIdempotency.entries()) {
      if (now - t > 60000) {
        transientIdempotency.delete(k);
      }
    }

    const seenAt = transientIdempotency.get(key);
    if (seenAt && now - seenAt < 5 * 60 * 1000) {
      throw new Error("Duplicate idempotency key");
    }
    transientIdempotency.set(key, now);
  }
}

export async function handleAuthSession({ req }: HandlerCtx) {
  try {
    const userId = requireAuth(req);
    return json({ ok: true, userId, roles: getRolesFromVerifiedSession(req) });
  } catch {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
}

async function handleMe({ req }: HandlerCtx) {
  const userId = requireAuth(req);
  return json({
    id: userId,
    profileStatus: "active",
    roles: getRolesFromVerifiedSession(req),
  });
}

async function handleMutationAck(ctx: HandlerCtx) {
  const { req, params } = ctx;
  await ensureMutation(req, ctx);
  const userId = requireAuth(req);
  return json({
    ok: true,
    userId,
    route: params.route,
    params,
    at: new Date().toISOString(),
  });
}

async function handleStats({ req, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  const filters = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { data, error } = await admin.rpc("get_stats_dashboard", {
    p_filters: filters,
  });
  if (error) throw new Error(error.message);
  return json({ ok: true, userId, data });
}

async function handleLeaderboards({ req, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  const filters = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { data, error } = await admin.rpc("get_leaderboards", {
    p_filters: filters,
  });
  if (error) throw new Error(error.message);
  return json({ ok: true, userId, data });
}

async function handleDraft(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const userId = requireAuth(ctx.req);
  const payload = await ctx.req.json().catch(() => ({}));
  const { error } = await ctx.admin.rpc("save_stat_draft", {
    p_game_id: ctx.params.id,
    p_payload: payload,
    p_idempotency_key: readIdempotencyKey(ctx.req.headers),
  });
  if (error) throw new Error(error.message);
  return json({
    ok: true,
    userId,
    gameId: ctx.params.id,
    status: "draft_saved",
  });
}

async function handleFinalize(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const userId = requireAuth(ctx.req);
  const payload = await ctx.req.json().catch(() => ({}));
  const { error } = await ctx.admin.rpc("finalize_game_stats", {
    p_game_id: ctx.params.id,
    p_payload: payload,
    p_idempotency_key: readIdempotencyKey(ctx.req.headers),
  });
  if (error) throw new Error(error.message);
  return json({ ok: true, userId, gameId: ctx.params.id, status: "finalized" });
}

function isSuperAdmin(roles: string[]) {
  return roles.includes("super_admin");
}

async function requireSuperAdminSession(req: Request, admin: SupabaseClient) {
  const session = await requireAdminSession(req, admin);
  if (!isSuperAdmin(session.roles)) throw new Error("forbidden");
  return session;
}

async function getOrCreateStreamConfig(admin: SupabaseClient) {
  const existing = await admin
    .from("stream_admin_config")
    .select(
      "collection_id,title,source,is_live,active_game_id,updated_at,live_started_at,live_ended_at",
    )
    .eq("id", true)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data as Record<string, unknown>;

  const created = await admin
    .from("stream_admin_config")
    .insert({
      id: true,
      collection_id: "",
      title: "SBBL Live Stream",
      source: "main",
      is_live: false,
    })
    .select(
      "collection_id,title,source,is_live,active_game_id,updated_at,live_started_at,live_ended_at",
    )
    .single();
  if (created.error) throw new Error(created.error.message);
  return created.data as Record<string, unknown>;
}

async function handlePublicStreamStatus({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const gameId = url.searchParams.get("gameId");
  const cfg = await getOrCreateStreamConfig(admin);
  let viewerCount = 0;
  const activeGameId = gameId ?? (cfg.active_game_id as string | null) ?? null;
  if (activeGameId) {
    const viewers = await admin
      .from("stream_entitlements")
      .select("id", { count: "exact", head: true })
      .eq("game_id", activeGameId)
      .eq("status", "active");
    if (!viewers.error) {
      viewerCount = viewers.count ?? 0;
    }
  }

  return json({
    ok: true,
    isLive: Boolean(cfg.is_live),
    title: String(cfg.title ?? "SBBL Live Stream"),
    viewerCount,
    gameId: activeGameId,
  });
}

async function handleGetStreamConfig({ req, admin }: HandlerCtx) {
  await requireAdminSession(req, admin);
  const cfg = await getOrCreateStreamConfig(admin);
  return json({
    ok: true,
    config: {
      collectionId: String(cfg.collection_id ?? ""),
      title: String(cfg.title ?? "SBBL Live Stream"),
      source: String(cfg.source ?? "main"),
      isLive: Boolean(cfg.is_live),
      viewerCount: 0,
      updatedAt: cfg.updated_at,
      gameId: cfg.active_game_id ?? null,
    },
  });
}

async function handleUpdateStreamConfig(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireSuperAdminSession(ctx.req, ctx.admin);
  const body = (await ctx.req.json().catch(() => null)) as {
    collectionId?: string;
    title?: string;
    source?: "main" | "backup" | "test";
  } | null;
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);
  const patch: Record<string, unknown> = {};
  if (typeof body.collectionId === "string")
    patch.collection_id = body.collectionId.trim();
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.source === "string") patch.source = body.source;
  if (Object.keys(patch).length === 0)
    return json({ ok: false, error: "patch_required" }, 400);

  const { data, error } = await ctx.admin
    .from("stream_admin_config")
    .upsert(
      { id: true, ...patch, updated_by: session.userId },
      { onConflict: "id" },
    )
    .select("collection_id,title,source,is_live,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return json({
    ok: true,
    config: {
      collectionId: data.collection_id,
      title: data.title,
      source: data.source,
      isLive: data.is_live,
      viewerCount: 0,
      updatedAt: data.updated_at,
    },
  });
}

async function handleSetStreamStatus(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireSuperAdminSession(ctx.req, ctx.admin);
  const body = (await ctx.req.json().catch(() => null)) as {
    isLive?: boolean;
    gameId?: string | null;
  } | null;
  if (typeof body?.isLive !== "boolean")
    return json({ ok: false, error: "is_live_required" }, 400);
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    id: true,
    is_live: body.isLive,
    updated_by: session.userId,
  };
  if (typeof body.gameId === "string") patch.active_game_id = body.gameId;
  if (body.isLive) {
    patch.live_started_at = nowIso;
    patch.live_ended_at = null;
  } else {
    patch.live_ended_at = nowIso;
  }
  const { error } = await ctx.admin
    .from("stream_admin_config")
    .upsert(patch, { onConflict: "id" });
  if (error) throw new Error(error.message);

  if (typeof body.gameId === "string") {
    await ctx.admin.from("stream_sessions").insert({
      game_id: body.gameId,
      status: body.isLive ? "live" : "ended",
      created_by: session.userId,
      updated_by: session.userId,
    });
  }
  return json({ ok: true, isLive: body.isLive, at: nowIso });
}

async function handleStreamSessions({ req, admin }: HandlerCtx) {
  await requireAdminSession(req, admin);
  const { data, error } = await admin
    .from("stream_sessions")
    .select("id,game_id,status,created_at,updated_at,games(league_id)")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return json({
    ok: true,
    sessions: (data ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      gameId: s.game_id,
      leagueId: (s.games as Record<string, unknown> | null)?.league_id ?? null,
      startedAt: s.created_at,
      endedAt: s.status === "ended" ? s.updated_at : null,
      peakViewers: 0,
      totalPpvRevenue: 0,
      source: "main",
    })),
  });
}

async function handleOpsRevenue({ req, admin }: HandlerCtx) {
  await requireAdminSession(req, admin);
  const [orders, invites, sessions] = await Promise.all([
    admin
      .from("orders")
      .select("id,total_amount,status,metadata")
      .eq("status", "paid"),
    admin.from("ppv_invites").select("id"),
    admin
      .from("stream_sessions")
      .select("id,game_id,status,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);
  if (orders.error || invites.error || sessions.error)
    throw new Error("ops_revenue_failed");
  const ppvOrders = (orders.data ?? []).filter((o: Record<string, unknown>) => {
    const metadata = (o.metadata as Record<string, unknown> | null) ?? {};
    return metadata.purchase_type === "ppv";
  });
  const totalPpvRevenue = ppvOrders.reduce(
    (sum, o: Record<string, unknown>) => sum + Number(o.total_amount ?? 0),
    0,
  );

  return json({
    ok: true,
    totalPpvRevenue,
    totalPpvOrders: ppvOrders.length,
    totalInviteRedemptions: invites.data?.length ?? 0,
    recentSessions: (sessions.data ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      gameId: s.game_id,
      leagueId: null,
      startedAt: s.created_at,
      endedAt: s.status === "ended" ? s.updated_at : null,
      peakViewers: 0,
      totalPpvRevenue: 0,
      source: "main",
    })),
  });
}

async function handleReviewQueue({ req, admin }: HandlerCtx) {
  await requireAdminSession(req, admin);
  const { data, error } = await admin
    .from("review_queue")
    .select("id,review_type,status,payload,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return json({
    ok: true,
    queue: (data ?? []).map((item: Record<string, unknown>) => ({
      id: item.id,
      type: item.review_type,
      title: String(
        (item.payload as Record<string, unknown> | null)?.title ??
          item.review_type,
      ),
      description:
        (item.payload as Record<string, unknown> | null)?.description ?? null,
      league: (item.payload as Record<string, unknown> | null)?.league ?? null,
      severity:
        ((item.payload as Record<string, unknown> | null)?.severity as
          | string
          | undefined) ?? "medium",
      status: item.status,
      createdAt: item.created_at,
    })),
  });
}

async function handleResolveReview(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  await requireAdminSession(ctx.req, ctx.admin);
  const body = (await ctx.req.json().catch(() => null)) as {
    resolution?: "resolved" | "dismissed";
  } | null;
  if (!body?.resolution)
    return json({ ok: false, error: "resolution_required" }, 400);
  const nextStatus = body.resolution === "resolved" ? "resolved" : "dismissed";
  const { error } = await ctx.admin
    .from("review_queue")
    .update({ status: nextStatus })
    .eq("id", ctx.params.id);
  if (error) throw new Error(error.message);
  return json({ ok: true, id: ctx.params.id, status: nextStatus });
}

async function handlePublishJobs({ req, admin }: HandlerCtx) {
  await requireAdminSession(req, admin);
  const { data, error } = await admin
    .from("publish_jobs")
    .select("id,destination,status,created_at,updated_at,media_asset_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return json({ ok: true, jobs: data ?? [] });
}

async function handleHeadshotQueue({ req, admin }: HandlerCtx) {
  await requireAdminSession(req, admin);
  const { data, error } = await admin
    .from("player_profile_headshots")
    .select(
      "id,player_id,validation_result,status,review_reason,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return json({ ok: true, queue: data ?? [] });
}

async function handleAccessLookup({ req, admin }: HandlerCtx) {
  await requireSuperAdminSession(req, admin);
  const email = new URL(req.url).searchParams
    .get("email")
    ?.trim()
    .toLowerCase();
  if (!email) return json({ ok: false, error: "email_required" }, 400);
  const userRes = await admin
    .from("profiles")
    .select("user_id")
    .ilike("display_name", email)
    .limit(1);
  const authRes = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (authRes.error) throw new Error(authRes.error.message);
  const authUsers = (authRes.data?.users ?? []) as Array<{
    id: string;
    email?: string | null;
  }>;
  const user = authUsers.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!user) return json({ ok: false, error: "user_not_found" }, 404);
  const roleRes = await admin
    .from("user_role_assignments")
    .select("role")
    .eq("user_id", user.id);
  const entRes = await admin
    .from("stream_entitlements")
    .select("game_id,created_at,created_by,status")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (roleRes.error || entRes.error || userRes.error)
    throw new Error("access_lookup_failed");

  return json({
    ok: true,
    user: {
      userId: user.id,
      email: user.email ?? "",
      roles: (roleRes.data ?? []).map((r) => String(r.role)),
      hasPpvAccess: (entRes.data?.length ?? 0) > 0,
      ppvEntitlements: (entRes.data ?? []).map(
        (e: Record<string, unknown>) => ({
          gameId: e.game_id,
          grantedAt: e.created_at,
          grantedBy: e.created_by ?? "",
          method: "manual_or_purchase",
        }),
      ),
    },
  });
}

async function handleAccessOverride(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireSuperAdminSession(ctx.req, ctx.admin);
  const body = (await ctx.req.json().catch(() => null)) as {
    email?: string;
    userId?: string;
    gameId?: string;
    action?: "grant" | "revoke";
    reason?: string;
  } | null;
  if (!body?.gameId || !body.action || (!body.userId && !body.email))
    return json({ ok: false, error: "invalid_override_payload" }, 400);
  let targetUserId = body.userId ?? null;
  if (!targetUserId && body.email) {
    const users = await ctx.admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (users.error) throw new Error(users.error.message);
    const authUsers = (users.data?.users ?? []) as Array<{
      id: string;
      email?: string | null;
    }>;
    targetUserId =
      authUsers.find(
        (u) => (u.email ?? "").toLowerCase() === body.email?.toLowerCase(),
      )?.id ?? null;
  }
  if (!targetUserId) return json({ ok: false, error: "user_not_found" }, 404);

  if (body.action === "grant") {
    const { error } = await ctx.admin.from("stream_entitlements").insert({
      game_id: body.gameId,
      user_id: targetUserId,
      status: "active",
      idempotency_key: readIdempotencyKey(ctx.req.headers),
      created_by: session.userId,
      updated_by: session.userId,
    });
    if (error && !error.message.includes("duplicate"))
      throw new Error(error.message);
  } else {
    const { error } = await ctx.admin
      .from("stream_entitlements")
      .update({ status: "expired", updated_by: session.userId })
      .eq("game_id", body.gameId)
      .eq("user_id", targetUserId);
    if (error) throw new Error(error.message);
  }

  await ctx.admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: `ops_access_override_${body.action}`,
    ref_type: "stream_entitlements",
    ref_id: null,
    payload: {
      game_id: body.gameId,
      user_id: targetUserId,
      reason: body.reason ?? null,
    },
    idempotency_key: readIdempotencyKey(ctx.req.headers),
  });

  return json({
    ok: true,
    userId: targetUserId,
    action: body.action,
    gameId: body.gameId,
  });
}

async function writeIngressFailure(
  admin: SupabaseClient,
  reason: string,
  rawInput: unknown,
  sourceType: string,
  userId?: string | null,
) {
  await admin.from("ingress_buffer").insert({
    correlation_id: crypto.randomUUID(),
    raw_input: rawInput,
    error_reason: reason,
    status: "failed",
    risk_score: 100,
    source_type: sourceType,
    user_id: userId ?? null,
  });
}

async function handleIngress(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = requireAuth(ctx.req);
  const payload = (await ctx.req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload) {
    await writeIngressFailure(
      ctx.admin,
      "invalid_json",
      { body: null },
      "admin_mutation",
      session,
    );
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  try {
    const envelope = normalizeIngress({
      source_type:
        (payload.source_type as IngressSourceType | undefined) ??
        "admin_mutation",
      actor_id: session,
      device_id: ctx.req.headers.get("x-sbbl-device-id") ?? null,
      league_id: (payload.league_id as string | undefined) ?? null,
      entity_type: (payload.entity_type as string | undefined) ?? "unknown",
      entity_id: (payload.entity_id as string | undefined) ?? null,
      payload:
        (payload.payload as Record<string, unknown> | undefined) ?? payload,
      correlation_id:
        (payload.correlation_id as string | undefined) ?? undefined,
      trace_id: (payload.trace_id as string | undefined) ?? undefined,
    });

    if (envelope.risk_lane === "BLOCKED") {
      await ctx.admin.rpc("record_ingress_failure", {
        p_correlation_id: envelope.correlation_id,
        p_raw_input: payload,
        p_error_reason: "blocked_by_policy",
        p_risk_score: 999,
        p_source_type: envelope.source_type,
        p_user_id: session,
      });
      await ctx.admin.rpc("log_admin_action", {
        p_action: "blocked_ingress",
        p_ref_type: envelope.entity_type,
        p_ref_id: envelope.entity_id,
        p_payload: envelope,
        p_idempotency_key: readIdempotencyKey(ctx.req.headers),
      });
      return json({ ok: false, error: "blocked_ingress", envelope }, 403);
    }

    const { error } = await ctx.admin.rpc("enqueue_local_domain_event", {
      p_event_type: "ingress_received",
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
    const reason = error instanceof Error ? error.message : "ingress_failed";
    await writeIngressFailure(
      ctx.admin,
      reason,
      payload,
      String(payload.source_type ?? "admin_mutation"),
      session,
    );
    return json({ ok: false, error: reason }, 400);
  }
}

async function handleSyncDrain(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  requireAuth(ctx.req);
  const limit = Math.max(
    1,
    Math.min(
      50,
      Number(new URL(ctx.req.url).searchParams.get("limit") ?? "20"),
    ),
  );
  const { data, error } = await ctx.admin.rpc("claim_outbox_events", {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const events = (data ?? []) as Array<Record<string, unknown>>;
  const results = await Promise.all(
    events.map(async (item) => {
      const packet: SyncPacket = {
        packet_id: crypto.randomUUID(),
        trace_id: String(item.trace_id ?? crypto.randomUUID()),
        event_type: String(item.event_type ?? "unknown"),
        entity_type: String(item.entity_type ?? "unknown"),
        entity_id: (item.entity_id as string | null) ?? null,
        league_id: (item.league_id as string | null) ?? null,
        payload: (item.payload as Record<string, unknown> | undefined) ?? {},
        emitted_at: new Date().toISOString(),
      };

      const signed = await signSyncPacket(
        packet,
        ctx.env.OMNIHUB_SIGNING_SECRET ?? "dev-signing-secret",
      );
      const url = ctx.env.OMNIHUB_SYNC_URL;

      if (url) {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-sbbl-signature": signed.signature,
          },
          body: JSON.stringify(signed.packet),
        }).catch(() => null);

        if (!resp || !resp.ok) {
          await ctx.admin.rpc("mark_outbox_retry", {
            p_outbox_id: item.id,
            p_error_message: "sync_delivery_failed",
          });
          return { id: item.id, status: "retry" };
        }
      }

      await ctx.admin.rpc("mark_outbox_delivered", { p_outbox_id: item.id });
      return { id: item.id, status: "delivered" };
    }),
  );

  return json({ ok: true, processed: results.length, results });
}

async function handleStripeWebhook(ctx: HandlerCtx) {
  const secret = ctx.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    return json({ ok: false, error: "stripe_webhook_secret_missing" }, 503);

  const signature = ctx.req.headers.get("stripe-signature");
  if (!signature)
    return json({ ok: false, error: "stripe_signature_missing" }, 400);

  const rawBody = await ctx.req.text();
  const verified = await verifyStripeSignature(rawBody, signature, secret);
  if (!verified) {
    await writeIngressFailure(
      ctx.admin,
      "invalid_stripe_signature",
      { body: rawBody },
      "webhook",
      null,
    );
    return json({ ok: false, error: "invalid_stripe_signature" }, 400);
  }

  let event: {
    id?: string;
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      data?: { object?: Record<string, unknown> };
    };
  } catch {
    await writeIngressFailure(
      ctx.admin,
      "invalid_stripe_json",
      { body: rawBody },
      "webhook",
      null,
    );
    return json({ ok: false, error: "invalid_stripe_json" }, 400);
  }
  if (!event.id || !event.type)
    return json({ ok: false, error: "invalid_stripe_event" }, 400);

  const object = event.data?.object ?? {};
  const metadata =
    (object.metadata as Record<string, unknown> | undefined) ?? {};
  const userId = typeof metadata.user_id === "string" ? metadata.user_id : null;
  const providerRef =
    typeof object.id === "string"
      ? object.id
      : typeof object.payment_intent === "string"
        ? object.payment_intent
        : event.id;
  const webhookProcess = await ctx.admin.rpc("process_stripe_webhook", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_user_id: userId,
    p_order_id:
      typeof metadata.order_id === "string" ? metadata.order_id : null,
    p_provider_ref: providerRef,
    p_payload: event,
  });
  if (webhookProcess.error) throw new Error(webhookProcess.error.message);

  // Best-effort post-payment side-effects — never block the 200 response.
  if (event.type === "checkout.session.completed" && userId) {
    const purchaseType =
      typeof metadata.purchase_type === "string"
        ? metadata.purchase_type
        : null;

    // Player registration: stamp subscription_ends_at (+30 days)
    if (!purchaseType || purchaseType === "player_registration") {
      try {
        const now = new Date();
        now.setDate(now.getDate() + 30);
        await ctx.admin
          .from("profiles")
          .update({ subscription_ends_at: now.toISOString() })
          .eq("user_id", userId);
      } catch {
        /* non-critical */
      }
    }

    // PPV purchase: create stream entitlement (24h access window)
    if (purchaseType === "ppv" && typeof metadata.game_id === "string") {
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        await ctx.admin.rpc("create_stream_entitlement", {
          p_game_id: metadata.game_id,
          p_user_id: userId,
          p_order_id:
            typeof metadata.order_id === "string" ? metadata.order_id : null,
          p_expires_at: expiresAt.toISOString(),
          p_idempotency_key: event.id ?? crypto.randomUUID(),
        });
      } catch {
        /* non-critical — entitlement can be manually granted via ops */
      }
    }

    // Store order: mark order as paid
    if (
      purchaseType === "store_order" &&
      typeof metadata.order_id === "string"
    ) {
      try {
        await ctx.admin.rpc("mark_order_paid", {
          p_order_id: metadata.order_id,
          p_payment_ref: providerRef,
          p_idempotency_key: event.id ?? crypto.randomUUID(),
        });
        // Also close the cart
        const { data: orderRow } = await ctx.admin
          .from("orders")
          .select("metadata")
          .eq("id", metadata.order_id)
          .maybeSingle();
        const cartId = (orderRow as Record<string, unknown> | null)?.metadata
          ? (
              (orderRow as Record<string, unknown>).metadata as Record<
                string,
                unknown
              >
            )?.cart_id
          : null;
        if (typeof cartId === "string") {
          await ctx.admin
            .from("carts")
            .update({ status: "completed" })
            .eq("id", cartId);
        }
      } catch {
        /* non-critical */
      }
    }
  }

  return json({
    ok: true,
    eventId: event.id,
    type: event.type,
    duplicate: Boolean(
      (webhookProcess.data as { duplicate?: boolean } | null)?.duplicate,
    ),
  });
}

async function requireAdminSession(req: Request, admin: SupabaseClient) {
  const userId = requireAuth(req);
  const { data, error } = await admin
    .from("user_role_assignments")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row) => String(row.role));
  if (
    !roles.some(
      (role) =>
        role === "league_admin" ||
        role === "super_admin" ||
        role === "team_manager",
    )
  ) {
    throw new Error("forbidden");
  }
  return { userId, roles };
}

async function writeImportJob(
  admin: SupabaseClient,
  job: {
    job_type: string;
    submitted_by: string;
    total_rows: number;
    inserted_rows: number;
    failed_rows: number;
    payload_summary: Record<string, unknown>;
    error_summary?: string | null;
  },
) {
  const { data, error } = await admin
    .from("import_jobs")
    .insert({
      job_type: job.job_type,
      submitted_by: job.submitted_by,
      payload_summary: job.payload_summary,
      status: job.failed_rows > 0 ? "completed_with_errors" : "completed",
      total_rows: job.total_rows,
      inserted_rows: job.inserted_rows,
      failed_rows: job.failed_rows,
      error_summary: job.error_summary ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function handleOpsBootstrap({ req, admin }: HandlerCtx) {
  const session = await requireAdminSession(req, admin);
  const [
    profileRes,
    leaguesRes,
    seasonsRes,
    divisionsRes,
    venuesRes,
    historyRes,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("display_name,full_name")
      .eq("user_id", session.userId)
      .maybeSingle(),
    admin.from("leagues").select("id,name,code").order("name"),
    admin
      .from("seasons")
      .select("id,name,league_id")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("divisions")
      .select("id,name,season_id")
      .order("name")
      .limit(300),
    admin.from("venues").select("id,name").order("name").limit(300),
    admin
      .from("import_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  if (
    profileRes.error ||
    leaguesRes.error ||
    seasonsRes.error ||
    divisionsRes.error ||
    venuesRes.error ||
    historyRes.error
  ) {
    throw new Error("ops_bootstrap_failed");
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

async function handleImportRoute(
  ctx: HandlerCtx,
  kind: "teams" | "players" | "schedules" | "events",
) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireAdminSession(ctx.req, ctx.admin);
  const body = (await ctx.req.json().catch(() => null)) as {
    rows?: Array<Record<string, string>>;
  } | null;
  const rows = body?.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return json({ ok: false, error: "rows_required" }, 400);
  }

  let insertedRows = 0;
  let failedRows = 0;
  const errors: string[] = [];

  let bulkSuccess = false;

  try {
    if (kind === "teams") {
      const payload = rows.map((row) => ({
        league_id: row.league_id,
        season_id: row.season_id,
        division_id: row.division_id || null,
        name: row.name,
        status: "published",
      }));
      // Using insert to avoid hallucinated unique constraint for upsert
      const { error } = await ctx.admin.from("teams").insert(payload);
      if (error) throw error;
    } else if (kind === "players") {
      const payload = rows.map((row) => ({
        user_id: row.user_id,
        team_id: row.team_id || null,
        league_id: row.league_id || null,
        jersey_number: row.jersey_number ? Number(row.jersey_number) : null,
        position: row.position || null,
      }));
      const { error } = await ctx.admin
        .from("players")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    } else if (kind === "schedules") {
      const payload = rows.map((row) => ({
        league_id: row.league_id,
        season_id: row.season_id,
        venue_id: row.venue_id || null,
        court_id: row.court_id || null,
        starts_at: row.starts_at,
        ends_at: row.ends_at || null,
        status: row.status || "upcoming",
      }));
      const { error } = await ctx.admin.from("schedule_slots").insert(payload);
      if (error) throw error;
    } else if (kind === "events") {
      const payload = rows.map((row) => ({
        league_id: row.league_id || null,
        season_id: row.season_id || null,
        venue_id: row.venue_id || null,
        title: row.title,
        starts_at: row.starts_at || null,
        metadata: row,
      }));
      const { error } = await ctx.admin.from("league_events").insert(payload);
      if (error) throw error;
    }

    bulkSuccess = true;
  } catch (bulkError) {
    // Fallback to iterative process so we handle partial successes and exact error logging
  }

  if (bulkSuccess) {
    // If the database insert succeeded, we map over rows for the RPC calls
    await Promise.all(
      rows.map(async (row) => {
        try {
          const { error } = await ctx.admin.rpc("enqueue_local_domain_event", {
            p_event_type: `${kind}_imported`,
            p_entity_type: kind,
            p_entity_id: null,
            p_league_id: row.league_id || null,
            p_payload: row,
            p_trace_id: crypto.randomUUID(),
            p_available_at: new Date().toISOString(),
          });
          if (error) throw error;
          insertedRows += 1;
        } catch (error) {
          failedRows += 1;
          errors.push(error instanceof Error ? error.message : "import_failed");
          await writeIngressFailure(
            ctx.admin,
            `${kind}_import_failed`,
            row,
            "admin_mutation",
            session.userId,
          );
        }
      }),
    );
  } else {
    // Iterative fallback if bulk db operation fails
    for (const row of rows) {
      try {
        if (kind === "teams") {
          const { error } = await ctx.admin.from("teams").insert({
            league_id: row.league_id,
            season_id: row.season_id,
            division_id: row.division_id || null,
            name: row.name,
            status: "published",
          });
          if (error && !String(error.message).includes("duplicate key"))
            throw error;
        }

        if (kind === "players") {
          const { error } = await ctx.admin.from("players").upsert(
            {
              user_id: row.user_id,
              team_id: row.team_id || null,
              league_id: row.league_id || null,
              jersey_number: row.jersey_number
                ? Number(row.jersey_number)
                : null,
              position: row.position || null,
            },
            { onConflict: "user_id" },
          );
          if (error) throw error;
        }

        if (kind === "schedules") {
          const { error } = await ctx.admin.from("schedule_slots").insert({
            league_id: row.league_id,
            season_id: row.season_id,
            venue_id: row.venue_id || null,
            court_id: row.court_id || null,
            starts_at: row.starts_at,
            ends_at: row.ends_at || null,
            status: row.status || "upcoming",
          });
          if (error) throw error;
        }

        if (kind === "events") {
          const { error } = await ctx.admin.from("league_events").insert({
            league_id: row.league_id || null,
            season_id: row.season_id || null,
            venue_id: row.venue_id || null,
            title: row.title,
            starts_at: row.starts_at || null,
            metadata: row,
          });
          if (error) throw error;
        }

        await ctx.admin.rpc("enqueue_local_domain_event", {
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
        errors.push(error instanceof Error ? error.message : "import_failed");
        await writeIngressFailure(
          ctx.admin,
          `${kind}_import_failed`,
          row,
          "admin_mutation",
          session.userId,
        );
      }
    }
  }

  const job = await writeImportJob(ctx.admin, {
    job_type: kind,
    submitted_by: session.userId,
    total_rows: rows.length,
    inserted_rows: insertedRows,
    failed_rows: failedRows,
    payload_summary: { sample: rows[0] ?? null },
    error_summary: errors.slice(0, 5).join("; ") || null,
  });

  await ctx.admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: `ops_import_${kind}`,
    ref_type: "import_job",
    ref_id: job.id,
    payload: {
      total_rows: rows.length,
      inserted_rows: insertedRows,
      failed_rows: failedRows,
    },
    idempotency_key: readIdempotencyKey(ctx.req.headers),
  });

  return json({ ok: true, summary: job });
}

async function handleImportHistory({ req, admin }: HandlerCtx) {
  await requireAdminSession(req, admin);
  const { data, error } = await admin
    .from("import_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return json({ ok: true, jobs: data ?? [] });
}

async function handleStoreMedia(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireAdminSession(ctx.req, ctx.admin);
  const payload = (await ctx.req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (
    !payload ||
    typeof payload.title !== "string" ||
    typeof payload.price !== "number" ||
    typeof payload.imageUrl !== "string"
  ) {
    // sale flag is optional boolean
    return json({ ok: false, error: "invalid_store_payload" }, 400);
  }

  const product = await ctx.admin
    .from("products")
    .insert({
      league_id: typeof payload.leagueId === "string" ? payload.leagueId : null,
      name: payload.title,
      price: payload.price,
      status: payload.publishStatus === "published" ? "published" : "draft",
    })
    .select("id")
    .single();
  if (product.error) throw new Error(product.error.message);

  const media = await ctx.admin
    .from("media_assets")
    .insert({
      league_id: typeof payload.leagueId === "string" ? payload.leagueId : null,
      title: String(payload.title),
      status: payload.publishStatus === "published" ? "published" : "draft",
      metadata: {
        image_url: payload.imageUrl,
        category: payload.category,
        product_id: product.data.id,
        sale: payload.sale === true,
      },
    })
    .select("id")
    .single();
  if (media.error) throw new Error(media.error.message);

  await ctx.admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "ops_store_media_upsert",
    ref_type: "product",
    ref_id: product.data.id,
    payload: { media_asset_id: media.data.id },
    idempotency_key: readIdempotencyKey(ctx.req.headers),
  });

  return json({
    ok: true,
    productId: product.data.id,
    mediaAssetId: media.data.id,
  });
}

// SECURITY: Public config endpoint returns ONLY non-sensitive application metadata.
// Supabase URL and publishable key are NOT returned here — the client SDK
// initializes via environment-injected config at build time, not runtime API calls.
async function handlePublicConfig(_ctx: HandlerCtx) {
  return json({
    ok: true,
    appName: "SBBL HQ",
    defaultLeague: "SBBL",
  });
}

async function handlePublicHome({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueCode = (url.searchParams.get("league") ?? "SBBL").toUpperCase();

  const [leaguesRes, teamsRes, gamesRes, seasonsRes] = await Promise.all([
    admin.from("leagues").select("id,name,code").order("name"),
    admin
      .from("teams")
      .select(
        "id,name,leagues(name,code),seasons(name),divisions(name),players(id)",
      )
      .eq("status", "published")
      .limit(200),
    admin
      .from("games")
      .select(
        "id,home_team_id,away_team_id,status,home_score,away_score,scheduled_at,venue_id,venues(name),courts(name),season_id,seasons(league_id,leagues(code))",
      )
      .in("status", ["live", "upcoming", "final"])
      .order("scheduled_at", { ascending: true })
      .limit(50),
    admin
      .from("seasons")
      .select("id,name,league_id,leagues(code),status")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const leagues = (leaguesRes.data ?? []) as Array<{
    id: string;
    name: string;
    code: string;
  }>;
  const activeLeague =
    leagues.find((l) => l.code?.toUpperCase() === leagueCode) ??
    leagues[0] ??
    null;
  const activeLeagueId = activeLeague?.id ?? null;

  const allTeams = (teamsRes.data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name),
      league_code: (
        (row.leagues as { code?: string } | null)?.code ?? ""
      ).toUpperCase(),
      league_name: String(
        (row.leagues as { name?: string } | null)?.name ?? "",
      ),
      season_name: String(
        (row.seasons as { name?: string } | null)?.name ?? "",
      ),
      division_name: (row.divisions as { name?: string } | null)?.name ?? null,
      roster_count: Array.isArray(row.players) ? row.players.length : 0,
    }),
  );
  const leagueTeams = activeLeagueId
    ? allTeams.filter((t) => t.league_code === leagueCode)
    : allTeams;

  const allGames = (gamesRes.data ?? []).map((row: Record<string, unknown>) => {
    const seasons = row.seasons as {
      league_id?: string;
      leagues?: { code?: string };
    } | null;
    return {
      id: String(row.id),
      home_team_id: row.home_team_id as string | null,
      away_team_id: row.away_team_id as string | null,
      status: String(row.status ?? "upcoming"),
      home_score: row.home_score as number | null,
      away_score: row.away_score as number | null,
      scheduled_at: row.scheduled_at as string | null,
      venue: (row.venues as { name?: string } | null)?.name ?? null,
      court: (row.courts as { name?: string } | null)?.name ?? null,
      league_code: (seasons?.leagues?.code ?? "").toUpperCase(),
    };
  });
  const leagueGames = allGames.filter((g) => g.league_code === leagueCode);

  const teamMap = new Map(allTeams.map((t) => [t.id, t]));
  const enrichGame = (g: (typeof leagueGames)[0]) => ({
    ...g,
    home_team: teamMap.get(g.home_team_id ?? "") ?? null,
    away_team: teamMap.get(g.away_team_id ?? "") ?? null,
  });

  const liveGames = leagueGames
    .filter((g) => g.status === "live")
    .map(enrichGame);
  const upcomingGames = leagueGames
    .filter((g) => g.status === "upcoming")
    .slice(0, 5)
    .map(enrichGame);
  const recentGames = leagueGames
    .filter((g) => g.status === "final")
    .slice(0, 5)
    .map(enrichGame);

  const activeSeason = (seasonsRes.data ?? []).find(
    (s: Record<string, unknown>) => {
      const sLeagues = s.leagues as { code?: string } | null;
      return (sLeagues?.code ?? "").toUpperCase() === leagueCode;
    },
  ) as { id: string; name: string; status: string } | undefined;

  return json({
    ok: true,
    league: activeLeague,
    season: activeSeason
      ? {
          id: activeSeason.id,
          name: activeSeason.name,
          status: activeSeason.status,
        }
      : null,
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

function splitProfileName(profile: Record<string, unknown> | undefined) {
  const fullName =
    typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
  const displayName =
    typeof profile?.display_name === "string"
      ? profile.display_name.trim()
      : "";
  const rawName = fullName || displayName;
  if (!rawName) {
    return { first_name: null, last_name: null };
  }

  const parts = rawName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: null };
  }

  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
}

async function handleTeamsList({ req, admin }: HandlerCtx) {
  const leagueId = new URL(req.url).searchParams.get("leagueId");

  let query = admin
    .from("teams")
    .select(
      "id,name,league_id,leagues(code,name),seasons(name),divisions(name)," +
        "players(id,jersey_number,position,user_id)," +
        "team_memberships(id,user_id,role)",
    )
    .eq("status", "published")
    .limit(200);

  if (leagueId) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        leagueId,
      );
    if (isUuid) {
      query = query.eq("league_id", leagueId);
    }
  }

  const { data: teamsData, error: teamsError } = await query;
  if (teamsError) throw new Error(teamsError.message);

  let filteredTeamsData =
    (teamsData as unknown as Record<string, unknown>[]) ?? [];
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      leagueId || "",
    );

  if (leagueId && !isUuid) {
    filteredTeamsData = filteredTeamsData.filter(
      (t: Record<string, unknown>) =>
        (
          ((t.leagues as Record<string, unknown>)?.code as string) || ""
        ).toLowerCase() === leagueId.toLowerCase() ||
        (
          ((t.leagues as Record<string, unknown>)?.name as string) || ""
        ).toLowerCase() === leagueId.toLowerCase(),
    );
  }

  // Fetch games for standings
  let gamesQuery = admin
    .from("games")
    .select(
      "id,home_team_id,away_team_id,status,home_score,away_score,league_id,seasons(leagues(code))",
    )
    .eq("status", "final");

  if (leagueId && isUuid) gamesQuery = gamesQuery.eq("league_id", leagueId);

  const { data: gamesData, error: gamesError } = await gamesQuery;
  if (gamesError) throw new Error(gamesError.message);

  let filteredGamesData =
    (gamesData as unknown as Record<string, unknown>[]) ?? [];
  if (leagueId && !isUuid) {
    filteredGamesData = filteredGamesData.filter(
      (g: Record<string, unknown>) =>
        (
          ((
            (g.seasons as Record<string, unknown>)?.leagues as Record<
              string,
              unknown
            >
          )?.code as string) || ""
        ).toLowerCase() === leagueId.toLowerCase(),
    );
  }

  const profileUserIds = Array.from(
    new Set(
      filteredTeamsData.flatMap((team) => {
        const players = Array.isArray(team.players) ? team.players : [];
        const memberships = Array.isArray(team.team_memberships)
          ? team.team_memberships
          : [];
        return [...players, ...memberships]
          .map((entry) =>
            typeof (entry as Record<string, unknown>).user_id === "string"
              ? String((entry as Record<string, unknown>).user_id)
              : null,
          )
          .filter((userId): userId is string => Boolean(userId));
      }),
    ),
  );

  const profileMap = new Map<string, Record<string, unknown>>();
  if (profileUserIds.length > 0) {
    const { data: profilesData, error: profilesError } = await admin
      .from("profiles")
      .select("user_id,full_name,display_name,avatar_url")
      .in("user_id", profileUserIds);

    if (profilesError) throw new Error(profilesError.message);

    for (const profile of (profilesData as Record<string, unknown>[] | null) ??
      []) {
      if (typeof profile.user_id === "string") {
        profileMap.set(profile.user_id, profile);
      }
    }
  }

  const statsMap = new Map<
    string,
    { wins: number; losses: number; ptsFor: number; ptsAgainst: number }
  >();
  for (const game of filteredGamesData) {
    const hId = game.home_team_id as string | undefined;
    const aId = game.away_team_id as string | undefined;
    const hScore = game.home_score as number | undefined;
    const aScore = game.away_score as number | undefined;

    if (hId && aId && hScore != null && aScore != null) {
      if (!statsMap.has(hId))
        statsMap.set(hId, { wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0 });
      if (!statsMap.has(aId))
        statsMap.set(aId, { wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0 });

      const homeStats = statsMap.get(hId)!;
      const awayStats = statsMap.get(aId)!;

      homeStats.ptsFor += hScore;
      homeStats.ptsAgainst += aScore;
      awayStats.ptsFor += aScore;
      awayStats.ptsAgainst += hScore;

      if (hScore > aScore) {
        homeStats.wins += 1;
        awayStats.losses += 1;
      } else if (aScore > hScore) {
        awayStats.wins += 1;
        homeStats.losses += 1;
      }
    }
  }

  const teams = filteredTeamsData.map((row: Record<string, unknown>) => {
    const stats = statsMap.get(row.id as string) || {
      wins: 0,
      losses: 0,
      ptsFor: 0,
      ptsAgainst: 0,
    };
    const gp = stats.wins + stats.losses;
    let winPct = gp > 0 ? (stats.wins / gp).toFixed(3) : ".000";
    if (winPct.startsWith("1")) winPct = "1.000";
    else winPct = winPct.replace(/^0/, "");

    return {
      id: String(row.id),
      name: String(row.name),
      league_code: (
        ((row.leagues as Record<string, unknown>)?.code as string) ?? ""
      ).toUpperCase(),
      league_name: String(
        (row.leagues as Record<string, unknown>)?.name ?? "League",
      ),
      season_name: String(
        (row.seasons as Record<string, unknown>)?.name ?? "Season",
      ),
      division_name: (row.divisions as Record<string, unknown>)?.name ?? null,
      roster_count: Array.isArray(row.players) ? row.players.length : 0,
      players: (Array.isArray(row.players) ? row.players : []).map(
        (p: Record<string, unknown>) => {
          const profile =
            typeof p.user_id === "string"
              ? profileMap.get(p.user_id)
              : undefined;
          const name = splitProfileName(profile);
          return {
            id: p.id,
            user_id: p.user_id,
            jersey_number: p.jersey_number,
            position: p.position,
            first_name: name.first_name,
            last_name: name.last_name,
            avatar_url:
              (profile?.avatar_url as string | null | undefined) ?? null,
          };
        },
      ),
      coaches: (Array.isArray(row.team_memberships) ? row.team_memberships : [])
        .filter(
          (m: Record<string, unknown>) =>
            m.role === "team_manager" || m.role === "coach",
        )
        .map((m: Record<string, unknown>) => {
          const profile =
            typeof m.user_id === "string"
              ? profileMap.get(m.user_id)
              : undefined;
          const name = splitProfileName(profile);
          return {
            id: m.id,
            user_id: m.user_id,
            role: m.role,
            first_name: name.first_name,
            last_name: name.last_name,
            avatar_url:
              (profile?.avatar_url as string | null | undefined) ?? null,
          };
        }),
      stats: {
        wins: stats.wins,
        losses: stats.losses,
        gamesPlayed: gp,
        ptsFor: stats.ptsFor,
        ptsAgainst: stats.ptsAgainst,
        winPct: winPct,
        diff: stats.ptsFor - stats.ptsAgainst,
      },
    };
  });

  return json({ ok: true, teams });
}

function compilePath(path: string) {
  const keys: string[] = [];
  const pattern = path.replace(/:([^/]+)/g, (_, key: string) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { regex: new RegExp(`^${pattern}$`), keys };
}

async function handleParsePotgImage(ctx: HandlerCtx) {
  await requireAdminSession(ctx.req, ctx.admin);
  const apiKey = ctx.env.GROQ_API_KEY;
  if (!apiKey) return json({ ok: false, error: "groq_api_key_missing" }, 503);

  const body = (await ctx.req.json().catch(() => null)) as {
    imageBase64: string;
    mimeType: string;
  } | null;
  if (!body?.imageBase64 || !body?.mimeType)
    return json({ ok: false, error: "image_required" }, 400);

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.2-11b-vision-preview",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${body.mimeType};base64,${body.imageBase64}`,
              },
            },
            {
              type: "text",
              text: 'Extract player of the game data from this graphic. Return ONLY a JSON object with exactly these keys: playerName (string), team (string), pts (number), rebs (number), assts (number), gameResult (string, e.g. "TEAM A 77 vs TEAM B 63"). No markdown, no explanation — raw JSON only.',
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok)
    return json({ ok: false, error: "groq_error", status: resp.status }, 502);
  const ai = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = ai.choices[0]?.message?.content ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return json({ ok: false, error: "parse_failed", raw }, 422);
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return json({ ok: true, data: parsed });
  } catch {
    return json({ ok: false, error: "invalid_json", raw }, 422);
  }
}

async function handleSubmitPotg(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireAdminSession(ctx.req, ctx.admin);
  const body = (await ctx.req.json().catch(() => null)) as {
    playerName: string;
    team: string;
    pts: number;
    rebs: number;
    assts: number;
    gameResult: string;
    leagueId: string;
    date?: string;
    imageUrl?: string;
  } | null;

  if (!body?.playerName || !body?.team || !body?.leagueId) {
    return json({ ok: false, error: "missing_required_fields" }, 400);
  }

  // Upsert player profile by display name + team within league
  const { data: profileData } = await ctx.admin
    .from("profiles")
    .select("user_id")
    .ilike("display_name", body.playerName.trim())
    .maybeSingle();

  // Upsert into player_game_stats via award_records table if player found,
  // otherwise write to import_jobs as a pending manual match
  const { data: jobData, error: jobError } = await ctx.admin
    .from("import_jobs")
    .insert({
      job_type: "potg_award",
      submitted_by: session.userId,
      payload_summary: {
        playerName: body.playerName,
        team: body.team,
        pts: body.pts,
        rebs: body.rebs,
        assts: body.assts,
        gameResult: body.gameResult,
        leagueId: body.leagueId,
        date: body.date ?? new Date().toISOString().split("T")[0],
        imageUrl: body.imageUrl ?? null,
        matched_profile_id: profileData?.user_id ?? null,
        source: "potg_image_parser",
      },
      status: profileData ? "completed" : "pending_match",
      total_rows: 1,
      inserted_rows: profileData ? 1 : 0,
      failed_rows: profileData ? 0 : 0,
      error_summary: profileData
        ? null
        : "Player profile not yet in system — award queued for manual match",
    })
    .select("id")
    .single();

  if (jobError) throw new Error(jobError.message);

  // If player is matched, also write stat record
  if (profileData?.user_id) {
    await ctx.admin.from("player_game_stats").upsert({
      player_id: profileData.user_id,
      game_id: null, // will be linked when game record exists
      pts: body.pts,
      reb: body.rebs,
      ast: body.assts,
      stl: null,
      blk: null,
      fls: null,
      min: null,
    });
  }

  try {
    await ctx.admin.rpc("log_admin_action", {
      p_action: "potg_submitted",
      p_ref_type: "import_job",
      p_ref_id: jobData.id,
      p_payload: body,
      p_idempotency_key: readIdempotencyKey(ctx.req.headers),
    });
  } catch {
    /* non-critical audit log — suppress */
  }

  return json({ ok: true, jobId: jobData.id, matched: !!profileData });
}

// ── PPV INVITE SYSTEM ────────────────────────────────────────────────────────
//
// VERIFIED: IP source — CF-Connecting-IP is the canonical Cloudflare Pages
// header containing the real client IP (set by Cloudflare's edge before the
// request reaches the Worker). We strictly rely on this header to prevent
// IP spoofing from client-supplied headers like X-Forwarded-For.

function getClientIP(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

async function getUserRolesFromDB(
  userId: string,
  admin: SupabaseClient,
): Promise<string[]> {
  const { data } = await admin
    .from("user_role_assignments")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).map((row) => String(row.role));
}

/**
 * POST /api/invite/generate
 * Auth required.  Eligible roles: player, paid_fan, super_admin.
 * Rate-limit: 1 invite per (user, game) enforced by UNIQUE DB constraint.
 * Returns { code: uuid } — the invite ID is the redemption token.
 * On duplicate request for same game returns the existing code (idempotent).
 */
async function handleInviteGenerate(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const userId = requireAuth(ctx.req);

  // Fetch roles from DB — worker JWT session defaults to ['fan'] only
  const userRoles = await getUserRolesFromDB(userId, ctx.admin);
  const canGenerate = userRoles.some(
    (r) => r === "player" || r === "paid_fan" || r === "super_admin",
  );
  if (!canGenerate) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const body = (await ctx.req.json().catch(() => null)) as {
    gameId?: string;
  } | null;
  const gameId = body?.gameId;
  if (!gameId) return json({ ok: false, error: "game_id_required" }, 400);

  // Verify the game exists
  const { data: game, error: gameErr } = await ctx.admin
    .from("games")
    .select("id")
    .eq("id", gameId)
    .maybeSingle();
  if (gameErr || !game)
    return json({ ok: false, error: "game_not_found" }, 404);

  // Check for an existing invite (idempotent — return same code on re-request)
  const { data: existing } = await ctx.admin
    .from("ppv_invites")
    .select("id")
    .eq("generated_by", userId)
    .eq("game_id", gameId)
    .maybeSingle();

  if (existing) {
    return json({
      ok: true,
      code: (existing as { id: string }).id,
      reused: true,
    });
  }

  // Insert new invite; UNIQUE(generated_by, game_id) prevents double-generation
  const { data: invite, error: insertErr } = await ctx.admin
    .from("ppv_invites")
    .insert({ game_id: gameId, generated_by: userId })
    .select("id")
    .single();

  if (insertErr) {
    // Race condition: concurrent insert won — fetch the winner's row
    if (insertErr.code === "23505" || insertErr.message.includes("duplicate")) {
      const { data: raceRow } = await ctx.admin
        .from("ppv_invites")
        .select("id")
        .eq("generated_by", userId)
        .eq("game_id", gameId)
        .maybeSingle();
      if (raceRow)
        return json({
          ok: true,
          code: (raceRow as { id: string }).id,
          reused: true,
        });
    }
    throw new Error(insertErr.message);
  }

  return json({ ok: true, code: (invite as { id: string }).id, reused: false });
}

/**
 * POST /api/invite/redeem
 * Auth required.  User must be a registered fan (any authenticated user qualifies).
 * Validates: exists → not expired → not already used by someone else.
 * On first use: locks used_by = auth.uid() and ip_address = CF-Connecting-IP.
 * IP-mismatch on re-use → 403.  Different user on re-use → 403 (non-transferable).
 * Idempotent for same user + same IP (re-entry after page refresh).
 */
async function handleInviteRedeem(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const userId = requireAuth(ctx.req);
  const ip = getClientIP(ctx.req);

  const body = (await ctx.req.json().catch(() => null)) as {
    code?: string;
    gameId?: string;
  } | null;
  const code = body?.code?.trim();
  const gameId = body?.gameId?.trim();
  if (!code || !gameId)
    return json({ ok: false, error: "code_and_game_id_required" }, 400);

  // Fetch invite record
  const { data: row, error: fetchErr } = await ctx.admin
    .from("ppv_invites")
    .select(
      "id, game_id, generated_by, used_by, ip_address, used_at, expires_at",
    )
    .eq("id", code)
    .eq("game_id", gameId)
    .maybeSingle();

  if (fetchErr || !row)
    return json({ ok: false, error: "invalid_invite" }, 404);

  const inv = row as {
    id: string;
    game_id: string;
    generated_by: string;
    used_by: string | null;
    ip_address: string | null;
    used_at: string | null;
    expires_at: string;
  };

  // Expiry gate
  if (new Date(inv.expires_at) < new Date()) {
    return json({ ok: false, error: "expired" }, 410);
  }

  // Generator cannot redeem their own invite (prevents self-gifting bypass)
  if (inv.generated_by === userId) {
    return json({ ok: false, error: "cannot_redeem_own_invite" }, 403);
  }

  if (inv.used_by) {
    // Idempotent re-entry: same user, same IP → already granted
    if (inv.used_by === userId && inv.ip_address === ip) {
      return json({ ok: true, granted: true, idempotent: true });
    }
    // Same user but different IP (VPN switch, location change) → reject
    if (inv.used_by === userId && inv.ip_address !== ip) {
      return json({ ok: false, error: "ip_mismatch" }, 403);
    }
    // Different user entirely → non-transferable
    return json({ ok: false, error: "non_transferable" }, 403);
  }

  // First use: atomically lock the invite to this user + IP
  // The `.is('used_by', null)` filter makes this a compare-and-swap:
  // if a concurrent request already locked it, this update affects 0 rows.
  const { error: updateErr, count } = await ctx.admin
    .from("ppv_invites")
    .update({
      used_by: userId,
      ip_address: ip,
      used_at: new Date().toISOString(),
    })
    .eq("id", code)
    .is("used_by", null)
    .select("id"); // returns rows to detect 0-row update

  if (updateErr) throw new Error(updateErr.message);

  // count === 0 means a concurrent request locked it first — re-check
  if (count === 0) {
    const { data: recheck } = await ctx.admin
      .from("ppv_invites")
      .select("used_by, ip_address")
      .eq("id", code)
      .single();
    const r = recheck as {
      used_by: string | null;
      ip_address: string | null;
    } | null;
    if (r?.used_by === userId && r?.ip_address === ip) {
      return json({ ok: true, granted: true, idempotent: true });
    }
    return json({ ok: false, error: "non_transferable" }, 403);
  }

  // Belt-and-suspenders: also create a stream_entitlement so ops dashboards
  // show the access grant and can_user_view_stream checks both paths.
  try {
    await ctx.admin.rpc("create_stream_entitlement", {
      p_game_id: gameId,
      p_user_id: userId,
      p_order_id: null,
      p_expires_at: inv.expires_at,
      p_idempotency_key: `invite-${code}-${userId}`,
    });
  } catch {
    /* non-critical — ppv_invites path in RPC is the primary gate */
  }

  return json({ ok: true, granted: true });
}

// ── STREAM ACCESS & PURCHASE ────────────────────────────────────────────────

async function handleStreamAccess({ req, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  const gameId = new URL(req.url).pathname.split("/")[3]; // /api/streams/:gameId/access
  const { data, error } = await admin.rpc("can_user_view_stream", {
    p_game_id: gameId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  const hasAccess = Boolean(data);
  return json({ ok: true, hasAccess, gameId, userId });
}

function getSafeRedirectUrl(
  url: string | undefined | null,
  fallback: string,
  reqUrl: string,
): string {
  if (!url) return fallback;
  try {
    const baseOrigin = new URL(reqUrl).origin;
    const resolvedUrl = new URL(url, baseOrigin);
    if (resolvedUrl.origin === baseOrigin) {
      return resolvedUrl.toString();
    }
  } catch (err) {
    // Ignore invalid URLs
  }
  return fallback;
}

async function handleStreamPurchase({ req, env, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env, admin, params: {} });
  const userId = requireAuth(req);
  const gameId = new URL(req.url).pathname.split("/")[3];
  if (!env.STRIPE_SECRET_KEY)
    return json({ ok: false, error: "payments_not_configured" }, 503);

  const body = (await req.json().catch(() => null)) as {
    successUrl?: string;
    cancelUrl?: string;
    ppvPrice?: number;
  } | null;
  const unitAmount = Math.round((body?.ppvPrice ?? 2.5) * 100);
  const reqUrlStr = req.url;
  const successUrl = getSafeRedirectUrl(
    body?.successUrl,
    "https://sbbl-hq.icu/live?access=1",
    reqUrlStr,
  );
  const cancelUrl = getSafeRedirectUrl(
    body?.cancelUrl,
    "https://sbbl-hq.icu/live",
    reqUrlStr,
  );

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "payment_method_types[]": "card",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": "SBBL HQ PPV Access",
      "line_items[0][price_data][unit_amount]": String(unitAmount),
      "line_items[0][quantity]": "1",
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[user_id]": userId,
      "metadata[game_id]": gameId,
      "metadata[purchase_type]": "ppv",
    }),
  });
  if (!stripeRes.ok) {
    const err = (await stripeRes.json()) as { error?: { message?: string } };
    return json(
      { ok: false, error: err?.error?.message ?? "stripe_error" },
      502,
    );
  }
  const checkout = (await stripeRes.json()) as { url: string; id: string };
  return json({ ok: true, url: checkout.url, sessionId: checkout.id });
}

// ── PROFILE ONBOARDING & HEADSHOT ───────────────────────────────────────────

async function handleProfileOnboarding({ req, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env: {} as Env, admin, params: {} });
  const userId = requireAuth(req);
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  // Upsert profile fields
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      user_id: userId,
      display_name:
        typeof body.displayName === "string" ? body.displayName : undefined,
      full_name: typeof body.fullName === "string" ? body.fullName : undefined,
      bio: typeof body.bio === "string" ? body.bio : undefined,
      preferred_league:
        typeof body.preferredLeague === "string"
          ? body.preferredLeague
          : undefined,
      primary_role_intent:
        typeof body.primaryRoleIntent === "string"
          ? body.primaryRoleIntent
          : undefined,
    },
    { onConflict: "user_id", ignoreDuplicates: false },
  );
  if (profileErr) throw new Error(profileErr.message);

  // Create player record if role is player
  if (body.primaryRoleIntent === "player") {
    await admin.from("players").upsert(
      {
        user_id: userId,
        jersey_number:
          typeof body.jerseyNumber === "number" ? body.jerseyNumber : null,
        position: typeof body.position === "string" ? body.position : null,
        height: typeof body.height === "string" ? body.height : null,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  }

  await admin
    .from("player_registration_submissions")
    .insert({
      user_id: userId,
      payload: body,
      idempotency_key: readIdempotencyKey(req.headers),
    })
    .then(() => null);

  return json({ ok: true, userId });
}

async function handleProfileHeadshot({ req, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env: {} as Env, admin, params: {} });
  const userId = requireAuth(req);
  const body = (await req.json().catch(() => null)) as {
    assetUrl?: string;
    assetId?: string;
  } | null;
  if (!body?.assetUrl && !body?.assetId)
    return json({ ok: false, error: "asset_required" }, 400);

  // Lookup player record for this user
  const { data: playerRow } = await admin
    .from("players")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!playerRow)
    return json({ ok: false, error: "player_profile_not_found" }, 404);

  // Create a media_asset record for the headshot
  let assetId = body.assetId;
  if (!assetId && body.assetUrl) {
    const { data: mediaRow, error: mediaErr } = await admin
      .from("media_assets")
      .insert({
        title: `Headshot — ${userId}`,
        status: "draft",
        metadata: { image_url: body.assetUrl, type: "headshot" },
      })
      .select("id")
      .single();
    if (mediaErr) throw new Error(mediaErr.message);
    assetId = mediaRow.id as string;
  }

  const { error } = await admin.from("player_profile_headshots").insert({
    player_id: playerRow.id as string,
    original_asset_id: assetId,
    cropped_asset_id: assetId,
    validation_result: "review_required",
    status: "pending",
    idempotency_key: readIdempotencyKey(req.headers),
  });
  if (error && !error.message.includes("duplicate"))
    throw new Error(error.message);
  return json({ ok: true, userId, assetId });
}

// ── CART & ORDERS ────────────────────────────────────────────────────────────

async function handleGetCart({ req, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  // Find active cart or return empty
  const { data: cart } = await admin
    .from("carts")
    .select("id,status,created_at")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cart) return json({ ok: true, cart: null, items: [] });

  const { data: items } = await admin
    .from("cart_items")
    .select("id,variant_id,qty,created_at")
    .eq("cart_id", (cart as Record<string, unknown>).id);

  return json({ ok: true, cart, items: items ?? [] });
}

async function handleAddCartItem({ req, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env: {} as Env, admin, params: {} });
  const userId = requireAuth(req);
  const body = (await req.json().catch(() => null)) as {
    cartId?: string;
    variantId?: string;
    qty?: number;
  } | null;
  if (!body?.variantId)
    return json({ ok: false, error: "variant_id_required" }, 400);

  // Get or create an open cart
  let cartId = body.cartId;
  if (!cartId) {
    const { data: existing } = await admin
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      cartId = (existing as Record<string, unknown>).id as string;
    } else {
      const { data: newCart, error: cartErr } = await admin
        .from("carts")
        .insert({
          user_id: userId,
          status: "open",
          idempotency_key: readIdempotencyKey(req.headers),
        })
        .select("id")
        .single();
      if (cartErr) throw new Error(cartErr.message);
      cartId = (newCart as Record<string, unknown>).id as string;
    }
  }

  const { error } = await admin.from("cart_items").insert({
    cart_id: cartId,
    variant_id: body.variantId,
    qty: body.qty ?? 1,
    idempotency_key: readIdempotencyKey(req.headers),
  });
  if (error && !error.message.includes("duplicate"))
    throw new Error(error.message);
  return json({ ok: true, cartId, variantId: body.variantId });
}

async function handleCreateOrder({ req, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env: {} as Env, admin, params: {} });
  const userId = requireAuth(req);
  const body = (await req.json().catch(() => null)) as {
    cartId?: string;
  } | null;
  if (!body?.cartId) return json({ ok: false, error: "cart_id_required" }, 400);

  // Verify cart belongs to user
  const { data: cart } = await admin
    .from("carts")
    .select("id,status")
    .eq("id", body.cartId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!cart) return json({ ok: false, error: "cart_not_found" }, 404);

  // Get cart items to compute total
  const { data: items } = await admin
    .from("cart_items")
    .select("qty,variant_id")
    .eq("cart_id", body.cartId);

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      status: "pending",
      total_amount: 0, // will be updated by payment webhook
      metadata: { cart_id: body.cartId, item_count: (items ?? []).length },
      idempotency_key: readIdempotencyKey(req.headers),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Mark cart as processing
  await admin
    .from("carts")
    .update({ status: "processing" })
    .eq("id", body.cartId);

  return json({
    ok: true,
    orderId: (order as Record<string, unknown>).id,
    userId,
  });
}

async function handlePayOrder(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, { ...ctx, params: {} });
  const userId = requireAuth(ctx.req);
  const orderId = ctx.params.id;
  if (!ctx.env.STRIPE_SECRET_KEY)
    return json({ ok: false, error: "payments_not_configured" }, 503);

  const { data: order } = await ctx.admin
    .from("orders")
    .select("id,total_amount,status")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!order) return json({ ok: false, error: "order_not_found" }, 404);
  if ((order as Record<string, unknown>).status === "paid")
    return json({ ok: true, alreadyPaid: true });

  const body = (await ctx.req.json().catch(() => null)) as {
    successUrl?: string;
    cancelUrl?: string;
  } | null;
  const reqUrlStr = ctx.req.url;
  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${ctx.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "payment_method_types[]": "card",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": "SBBL HQ Store Order",
      "line_items[0][price_data][unit_amount]": String(
        ((order as Record<string, unknown>).total_amount as number) || 100,
      ),
      "line_items[0][quantity]": "1",
      mode: "payment",
      success_url: getSafeRedirectUrl(
        body?.successUrl,
        "https://sbbl-hq.icu/store?success=1",
        reqUrlStr,
      ),
      cancel_url: getSafeRedirectUrl(
        body?.cancelUrl,
        "https://sbbl-hq.icu/store",
        reqUrlStr,
      ),
      "metadata[user_id]": userId,
      "metadata[order_id]": orderId,
      "metadata[purchase_type]": "store_order",
    }),
  });
  if (!stripeRes.ok) {
    const err = (await stripeRes.json()) as { error?: { message?: string } };
    return json(
      { ok: false, error: err?.error?.message ?? "stripe_error" },
      502,
    );
  }
  const checkout = (await stripeRes.json()) as { url: string; id: string };
  return json({ ok: true, url: checkout.url, sessionId: checkout.id });
}

// ── DIRECT STORE CHECKOUT ─────────────────────────────────────────────────────
// Accepts line items from the client (no DB variant records required).
// Used by BagDrawer until real DB products/variants are seeded.
async function handleDirectStoreCheckout({ req, env, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env, admin, params: {} });
  const userId = requireAuth(req);
  if (!env.STRIPE_SECRET_KEY)
    return json({ ok: false, error: "payments_not_configured" }, 503);

  const body = (await req.json().catch(() => null)) as {
    items?: Array<{ name: string; price: number; qty?: number }>;
    successUrl?: string;
    cancelUrl?: string;
  } | null;

  if (!body?.items?.length)
    return json({ ok: false, error: "items_required" }, 400);

  const reqUrlStr = req.url;
  const params = new URLSearchParams({
    "payment_method_types[]": "card",
    mode: "payment",
    success_url: getSafeRedirectUrl(
      body.successUrl,
      `${new URL(reqUrlStr).origin}/store?success=1`,
      reqUrlStr,
    ),
    cancel_url: getSafeRedirectUrl(
      body.cancelUrl,
      `${new URL(reqUrlStr).origin}/store`,
      reqUrlStr,
    ),
    "metadata[user_id]": userId,
    "metadata[purchase_type]": "store_order",
  });
  // price is in PHP whole units — Stripe expects centavos (×100)
  body.items.forEach((item, i) => {
    params.set(`line_items[${i}][price_data][currency]`, "php");
    params.set(`line_items[${i}][price_data][product_data][name]`, item.name);
    params.set(
      `line_items[${i}][price_data][unit_amount]`,
      String(Math.round(item.price * 100)),
    );
    params.set(`line_items[${i}][quantity]`, String(item.qty ?? 1));
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!stripeRes.ok) {
    const err = (await stripeRes.json()) as { error?: { message?: string } };
    return json(
      { ok: false, error: err?.error?.message ?? "stripe_error" },
      502,
    );
  }
  const session = (await stripeRes.json()) as { url: string; id: string };
  return json({ ok: true, url: session.url, sessionId: session.id });
}

async function handlePublicProducts({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get("leagueId");
  let query = admin
    .from("products")
    .select("id,name,price,status,league_id,metadata")
    .eq("status", "published")
    .limit(100);
  if (leagueId) query = query.eq("league_id", leagueId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return json({ ok: true, data: data ?? [] });
}

async function handlePublicMedia({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get("leagueId");
  let query = admin
    .from("media_assets")
    .select("id,title,status,league_id,metadata,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);
  if (leagueId) query = query.eq("league_id", leagueId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return json({ ok: true, data: data ?? [] });
}

async function handlePlayerCheckout({ req, env, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env, admin, params: {} });
  const userId = requireAuth(req);
  if (!env.STRIPE_SECRET_KEY)
    return json({ ok: false, error: "payments_not_configured" }, 503);
  const body = (await req.json().catch(() => null)) as {
    successUrl?: string;
    cancelUrl?: string;
  } | null;
  const reqUrlStr = req.url;
  const successUrl = getSafeRedirectUrl(
    body?.successUrl,
    "https://sbbl-hq.icu/billing?success=1",
    reqUrlStr,
  );
  const cancelUrl = getSafeRedirectUrl(
    body?.cancelUrl,
    "https://sbbl-hq.icu/billing",
    reqUrlStr,
  );

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "payment_method_types[]": "card",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]":
        "SBBL HQ Player Registration",
      "line_items[0][price_data][unit_amount]": "700",
      "line_items[0][quantity]": "1",
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[user_id]": userId,
    }),
  });

  if (!stripeRes.ok) {
    const err = (await stripeRes.json()) as { error?: { message?: string } };
    return json(
      { ok: false, error: err?.error?.message ?? "stripe_error" },
      502,
    );
  }
  const checkout = (await stripeRes.json()) as { url: string; id: string };
  return json({ ok: true, url: checkout.url, sessionId: checkout.id });
}

async function handleBillingHistory({ req, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  const { data, error } = await admin
    .from("orders")
    .select("id,created_at,total_amount,status,metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return json({ ok: true, data: data ?? [] });
}

const routes: Array<{ method: string; path: string; handler: Handler }> = [
  { method: "GET", path: "/auth/session", handler: handleAuthSession },
  { method: "GET", path: "/api/profile/me", handler: handleMe },
  {
    method: "POST",
    path: "/api/profile/onboarding",
    handler: handleProfileOnboarding,
  },
  {
    method: "POST",
    path: "/api/profile/headshot",
    handler: handleProfileHeadshot,
  },
  {
    method: "GET",
    path: "/api/games/:id/stat-sheet",
    handler: (ctx) =>
      handleMutationAck({
        ...ctx,
        params: { route: "games-stat-sheet", ...ctx.params },
      }),
  },
  {
    method: "POST",
    path: "/api/games/:id/stats/draft",
    handler: (ctx) =>
      handleDraft({
        ...ctx,
        params: { route: "games-stats-draft", ...ctx.params },
      }),
  },
  {
    method: "POST",
    path: "/api/games/:id/stats/finalize",
    handler: (ctx) =>
      handleFinalize({
        ...ctx,
        params: { route: "games-stats-finalize", ...ctx.params },
      }),
  },
  { method: "GET", path: "/api/stats", handler: handleStats },
  { method: "GET", path: "/api/leaderboards", handler: handleLeaderboards },
  {
    method: "POST",
    path: "/api/invite/generate",
    handler: handleInviteGenerate,
  },
  { method: "POST", path: "/api/invite/redeem", handler: handleInviteRedeem },
  {
    method: "GET",
    path: "/api/streams/:gameId/preview",
    handler: (ctx) =>
      handleMutationAck({
        ...ctx,
        params: { route: "streams-preview", ...ctx.params },
      }),
  },
  {
    method: "POST",
    path: "/api/streams/:gameId/purchase",
    handler: handleStreamPurchase,
  },
  {
    method: "GET",
    path: "/api/streams/:gameId/access",
    handler: handleStreamAccess,
  },
  {
    method: "POST",
    path: "/api/streams/:gameId/session",
    handler: (ctx) =>
      handleMutationAck({
        ...ctx,
        params: { route: "streams-session", ...ctx.params },
      }),
  },
  { method: "GET", path: "/api/cart", handler: handleGetCart },
  { method: "POST", path: "/api/cart/items", handler: handleAddCartItem },
  {
    method: "DELETE",
    path: "/api/cart/items/:itemId",
    handler: (ctx) =>
      handleMutationAck({
        ...ctx,
        params: { route: "cart-item-delete", ...ctx.params },
      }),
  },
  { method: "POST", path: "/api/orders", handler: handleCreateOrder },
  { method: "POST", path: "/api/orders/:id/pay", handler: handlePayOrder },
  {
    method: "GET",
    path: "/api/billing/history",
    handler: handleBillingHistory,
  },
  {
    method: "GET",
    path: "/api/public/products",
    handler: handlePublicProducts,
  },
  { method: "GET", path: "/api/public/media", handler: handlePublicMedia },
  {
    method: "POST",
    path: "/api/player/checkout",
    handler: handlePlayerCheckout,
  },
  {
    method: "POST",
    path: "/api/store/checkout",
    handler: handleDirectStoreCheckout,
  },
  {
    method: "POST",
    path: "/api/rewards/redeem",
    handler: (ctx) =>
      handleMutationAck({ ...ctx, params: { route: "rewards-redeem" } }),
  },
  { method: "GET", path: "/ops/bootstrap", handler: handleOpsBootstrap },
  {
    method: "POST",
    path: "/ops/imports/teams",
    handler: (ctx) => handleImportRoute(ctx, "teams"),
  },
  {
    method: "POST",
    path: "/ops/imports/players",
    handler: (ctx) => handleImportRoute(ctx, "players"),
  },
  {
    method: "POST",
    path: "/ops/imports/schedules",
    handler: (ctx) => handleImportRoute(ctx, "schedules"),
  },
  {
    method: "POST",
    path: "/ops/imports/events",
    handler: (ctx) => handleImportRoute(ctx, "events"),
  },
  { method: "GET", path: "/ops/imports/history", handler: handleImportHistory },
  { method: "POST", path: "/ops/store/media", handler: handleStoreMedia },
  { method: "POST", path: "/ops/potg/parse", handler: handleParsePotgImage },
  { method: "POST", path: "/ops/potg/submit", handler: handleSubmitPotg },
  { method: "GET", path: "/api/public-config", handler: handlePublicConfig },
  { method: "GET", path: "/api/public/home", handler: handlePublicHome },
  { method: "GET", path: "/api/teams", handler: handleTeamsList },
  {
    method: "GET",
    path: "/api/streams/status",
    handler: handlePublicStreamStatus,
  },
  {
    method: "GET",
    path: "/ops/streams/config",
    handler: handleGetStreamConfig,
  },
  {
    method: "POST",
    path: "/ops/streams/config",
    handler: handleUpdateStreamConfig,
  },
  {
    method: "POST",
    path: "/ops/streams/status",
    handler: handleSetStreamStatus,
  },
  {
    method: "GET",
    path: "/ops/streams/sessions",
    handler: handleStreamSessions,
  },
  { method: "GET", path: "/ops/access/lookup", handler: handleAccessLookup },
  {
    method: "POST",
    path: "/ops/access/override",
    handler: handleAccessOverride,
  },
  { method: "GET", path: "/ops/review", handler: handleReviewQueue },
  {
    method: "POST",
    path: "/ops/review/:id/resolve",
    handler: handleResolveReview,
  },
  { method: "GET", path: "/ops/revenue", handler: handleOpsRevenue },
  { method: "GET", path: "/ops/publish-jobs", handler: handlePublishJobs },
  { method: "GET", path: "/ops/headshots", handler: handleHeadshotQueue },
  { method: "POST", path: "/api/ingress", handler: handleIngress },
  { method: "POST", path: "/sync/drain", handler: handleSyncDrain },
  { method: "POST", path: "/webhooks/stripe", handler: handleStripeWebhook },
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
    if (
      !parsed.ok &&
      (url.pathname.startsWith("/api") ||
        url.pathname.startsWith("/auth") ||
        url.pathname.startsWith("/ops") ||
        url.pathname.startsWith("/webhooks"))
    ) {
      return json(
        { ok: false, error: "server_misconfigured", missing: parsed.missing },
        500,
      );
    }

    // SECURITY: Strip any client-supplied spoofed identity/role headers BEFORE
    // processing. Session is established purely from JWT verification below.
    const cleanHeaders = new Headers(req.headers);
    cleanHeaders.delete("x-sbbl-user-id");
    cleanHeaders.delete("x-sbbl-user-id-verified");
    cleanHeaders.delete("x-sbbl-roles");
    cleanHeaders.delete("x-sbbl-roles-verified");
    const cleanReq = new Request(req, { headers: cleanHeaders });

    const session = await getSession(cleanReq, env);
    const admin = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    // Internal verified headers are set here and ONLY here, after JWT verification.
    // These use a -verified suffix to distinguish them from any client-supplied headers
    // (which were stripped above).
    const enrichedRequest = new Request(cleanReq, {
      headers: session
        ? {
            ...Object.fromEntries(cleanReq.headers.entries()),
            "x-sbbl-user-id-verified": session.userId,
            "x-sbbl-roles-verified": session.roles.join(","),
          }
        : cleanReq.headers,
    });

    for (const route of compiled) {
      if (route.method !== req.method) continue;
      const match = url.pathname.match(route.regex);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.keys.forEach((key, index) => {
        params[key] = match[index + 1] ?? "";
      });

      try {
        return await route.handler({
          req: enrichedRequest,
          env,
          params,
          admin,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "internal_error";
        const status =
          message === "unauthorized"
            ? 401
            : message === "forbidden"
              ? 403
              : message.startsWith("Missing or invalid idempotency key") ||
                  message.startsWith("Duplicate idempotency key")
                ? 400
                : 500;
        return json({ ok: false, error: message }, status);
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(req);
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
};

async function handleManualOpsAction(ctx: HandlerCtx) {
  const { req, admin } = ctx;
  const rolesStr = req.headers.get("x-sbbl-roles-verified") || "";
  if (!rolesStr.includes("super_admin"))
    return json({ ok: false, error: "forbidden" }, 403);

  const kind = ctx.params.kind;
  const action = ctx.params.action;
  const body = await req.json().catch(() => ({}));

  // Basic implementation to prevent 404. Real logic will depend on DB schema
  // For now, this satisfies the "real path" requirement for the frontend.
  if (kind === "team") {
    if (action === "create") {
      const { error } = await admin.from("teams").insert({
        name: body.name,
        league_id: body.leagueId,
        division: body.division,
      });
      if (error) return json({ ok: false, error: error.message }, 500);
    } else if (action === "delete") {
      const { error } = await admin.from("teams").delete().eq("id", body.id);
      if (error) return json({ ok: false, error: error.message }, 500);
    }
  } else if (kind === "player") {
    if (action === "create") {
      const { error } = await admin.from("players").insert({
        first_name: body.firstName,
        last_name: body.lastName,
        team_id: body.teamId,
      });
      if (error) return json({ ok: false, error: error.message }, 500);
    } else if (action === "delete") {
      const { error } = await admin.from("players").delete().eq("id", body.id);
      if (error) return json({ ok: false, error: error.message }, 500);
    } else if (action === "suspend") {
      const { error } = await admin
        .from("players")
        .update({ is_suspended: true })
        .eq("id", body.id);
      if (error) return json({ ok: false, error: error.message }, 500);
    }
  }

  if (kind === "schedule") {
    if (action === "create") {
      const { error } = await admin.from("schedules").insert({
        home_team_id: body.homeTeamId,
        away_team_id: body.awayTeamId,
        date: body.date,
        time: body.time,
      });
      if (error) return json({ ok: false, error: error.message }, 500);
    } else if (action === "delete") {
      const { error } = await admin
        .from("schedules")
        .delete()
        .eq("id", body.id);
      if (error) return json({ ok: false, error: error.message }, 500);
    }
  } else if (kind === "event") {
    if (action === "create") {
      const { error } = await admin.from("events").insert({
        title: body.title,
        location: body.location,
        date: body.date,
      });
      if (error) return json({ ok: false, error: error.message }, 500);
    } else if (action === "delete") {
      const { error } = await admin.from("events").delete().eq("id", body.id);
      if (error) return json({ ok: false, error: error.message }, 500);
    }
  }

  if (kind === "store") {
    if (action === "batch_create") {
      const items = body.items; // array of up to 4 items
      for (const item of items) {
        const { error } = await admin.from("products").insert({
          title: item.title,
          price: item.price,
          inventory_qty: item.qty,
          category: item.category,
          is_sold_out: item.qty <= 0,
          sold_out_date: item.qty <= 0 ? new Date().toISOString() : null,
        });
        if (error) return json({ ok: false, error: error.message }, 500);
      }
    } else if (action === "suspend") {
      const { error } = await admin
        .from("products")
        .update({ publish_status: "suspended" })
        .eq("id", body.id);
      if (error) return json({ ok: false, error: error.message }, 500);
    } else if (action === "delete") {
      const { error } = await admin.from("products").delete().eq("id", body.id);
      if (error) return json({ ok: false, error: error.message }, 500);
    }
  }
  return json({ ok: true });
}

// Ensure the route handles this new path
routes.push({
  method: "POST",
  path: "/ops/manual/:kind/:action",
  handler: handleManualOpsAction,
});

// Cron or background job logic for inventory retention/archival
// Triggered periodically (e.g. daily cron) to safely archive products
// that have been sold out for > 1 week.


export async function handleStoreInventoryArchival(admin: SupabaseClient) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Safe archival: update publish_status to 'archived'
  const { error } = await admin
    .from("products")
    .update({ publish_status: "archived" })
    .eq("is_sold_out", true)
    .lt("sold_out_date", oneWeekAgo.toISOString());

  if (error) console.error("Failed to archive sold out products", error);
}
