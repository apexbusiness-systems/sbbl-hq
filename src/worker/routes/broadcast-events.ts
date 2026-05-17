/**
 * broadcast-events.ts
 *
 * Worker route handlers for LiveStream Broadcast Events.
 *
 * Public routes (no auth):
 *   GET /api/public/broadcast-events          — paginated list
 *   GET /api/public/broadcast-events/:slug    — detail by slug
 *
 * Ops routes (require super_admin or league_admin):
 *   POST /api/ops/broadcast-events            — create
 *   PATCH /api/ops/broadcast-events/:id       — update fields
 *   POST  /api/ops/broadcast-events/:id/status — status transition
 */

import type { HandlerCtx } from "../shared";
import { json } from "../shared";

// ── Types ─────────────────────────────────────────────────────────────────────

type BroadcastStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "ended"
  | "cancelled"
  | "archived";

type BroadcastVisibility = "public" | "private" | "unlisted";

// Allowed status transitions — source → valid targets
const STATUS_TRANSITIONS: Record<BroadcastStatus, BroadcastStatus[]> = {
  draft:     ["scheduled", "cancelled"],
  scheduled: ["live",      "cancelled"],
  live:      ["ended",     "cancelled"],
  ended:     ["archived"],
  cancelled: ["archived"],
  archived:  [], // terminal
};

// ── URL validation ─────────────────────────────────────────────────────────────

const BLOCKED_PROTOCOLS = ["javascript:", "data:", "file:", "vbscript:", "blob:"];
const PRIVATE_RANGES = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/0\.0\.0\.0/,
];

function validateHttpsUrl(raw: unknown, field: string): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "__invalid__";
  }
  if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) return "__invalid__";
  if (parsed.protocol !== "https:") return "__invalid__";
  for (const re of PRIVATE_RANGES) {
    if (re.test(trimmed)) return "__invalid__";
  }
  void field;
  return trimmed;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

// ── Auth helper ────────────────────────────────────────────────────────────────

function requireAuth(req: Request): string {
  const userId = req.headers.get("x-sbbl-user-id-verified");
  if (!userId) throw Object.assign(new Error("unauthorized"), { status: 401 });
  return userId;
}

async function requireAdminRole(
  admin: HandlerCtx["admin"],
  userId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("user_role_assignments")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "league_admin"])
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    throw Object.assign(new Error("forbidden"), { status: 403 });
  }
}

// ── Public handlers ────────────────────────────────────────────────────────────

export async function handleListBroadcastEvents({
  req,
  admin,
}: HandlerCtx): Promise<Response> {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get("leagueId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(Math.max(limitRaw, 1), 50);
  const offsetRaw = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const offset = Math.max(offsetRaw, 0);

  let query = admin
    .from("livestream_broadcast_events")
    .select(
      "id,league_id,season_id,game_id,title,slug,description,status," +
        "scheduled_start_at,actual_start_at,actual_end_at," +
        "thumbnail_url,visibility,created_at,updated_at",
      { count: "exact" },
    )
    .in("status", ["scheduled", "live", "ended", "cancelled"])
    .eq("visibility", "public")
    .order("scheduled_start_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (leagueId) query = query.eq("league_id", leagueId);
  if (
    status &&
    ["scheduled", "live", "ended", "cancelled"].includes(status)
  ) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("[broadcast-events] list error", error.message);
    return json({ ok: false, error: "query_failed" }, 500);
  }

  return json(
    { ok: true, data: data ?? [], total: count ?? 0, limit, offset },
    200,
    { "Cache-Control": "public, s-maxage=15, max-age=10" },
  );
}

export async function handleGetBroadcastEvent({
  params,
  admin,
}: HandlerCtx): Promise<Response> {
  const slug = params.slug;
  if (!slug) return json({ ok: false, error: "slug_required" }, 400);

  const { data, error } = await admin
    .from("livestream_broadcast_events")
    .select(
      "id,league_id,season_id,game_id,title,slug,description,status," +
        "scheduled_start_at,actual_start_at,actual_end_at," +
        "stream_url,embed_url,thumbnail_url,visibility,created_at,updated_at",
    )
    .eq("slug", slug)
    .in("status", ["scheduled", "live", "ended", "cancelled"])
    .eq("visibility", "public")
    .maybeSingle();

  if (error) {
    console.error("[broadcast-events] get error", error.message);
    return json({ ok: false, error: "query_failed" }, 500);
  }
  if (!data) return json({ ok: false, error: "not_found" }, 404);

  // Only send stream_url when the event is live — no pre-distribution.
  const payload = {
    ...data,
    stream_url: data.status === "live" ? data.stream_url : null,
    embed_url:  data.status === "live" ? data.embed_url  : null,
  };

  return json({ ok: true, data: payload }, 200, {
    "Cache-Control": "public, s-maxage=10, max-age=5",
  });
}

// ── Ops handlers ───────────────────────────────────────────────────────────────

export async function handleCreateBroadcastEvent(
  ctx: HandlerCtx,
): Promise<Response> {
  const userId = requireAuth(ctx.req);
  await requireAdminRole(ctx.admin, userId);

  const body = await ctx.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return json({ ok: false, error: "title_required" }, 400);

  // Auto-generate slug if not provided; ensure uniqueness by appending random suffix
  let slug =
    typeof body.slug === "string" && body.slug.trim()
      ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : slugify(title);
  if (!slug) return json({ ok: false, error: "slug_invalid" }, 400);

  // Validate URLs
  const streamUrl = validateHttpsUrl(body.stream_url, "stream_url");
  const embedUrl = validateHttpsUrl(body.embed_url, "embed_url");
  const thumbnailUrl = validateHttpsUrl(body.thumbnail_url, "thumbnail_url");

  if (streamUrl === "__invalid__")
    return json({ ok: false, error: "stream_url_invalid" }, 422);
  if (embedUrl === "__invalid__")
    return json({ ok: false, error: "embed_url_invalid" }, 422);
  if (thumbnailUrl === "__invalid__")
    return json({ ok: false, error: "thumbnail_url_invalid" }, 422);

  const visibility: BroadcastVisibility =
    (["public", "private", "unlisted"] as BroadcastVisibility[]).includes(
      body.visibility as BroadcastVisibility,
    )
      ? (body.visibility as BroadcastVisibility)
      : "public";

  const row = {
    title,
    slug,
    description: typeof body.description === "string" ? body.description.trim() || null : null,
    status: "draft" as BroadcastStatus,
    league_id: typeof body.league_id === "string" ? body.league_id : null,
    season_id: typeof body.season_id === "string" ? body.season_id : null,
    game_id:   typeof body.game_id   === "string" ? body.game_id   : null,
    scheduled_start_at:
      typeof body.scheduled_start_at === "string" ? body.scheduled_start_at : null,
    stream_url: streamUrl,
    embed_url: embedUrl,
    thumbnail_url: thumbnailUrl,
    visibility,
    created_by: userId,
    updated_by: userId,
  };

  const { data, error } = await ctx.admin
    .from("livestream_broadcast_events")
    .insert(row)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      // Unique slug collision — append random suffix and retry once
      slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
      const { data: d2, error: e2 } = await ctx.admin
        .from("livestream_broadcast_events")
        .insert({ ...row, slug })
        .select()
        .single();
      if (e2) return json({ ok: false, error: "slug_conflict" }, 409);
      return json({ ok: true, data: d2 }, 201);
    }
    console.error("[broadcast-events] create error", error.message);
    return json({ ok: false, error: "create_failed" }, 500);
  }

  return json({ ok: true, data }, 201);
}

export async function handleUpdateBroadcastEvent(
  ctx: HandlerCtx,
): Promise<Response> {
  const userId = requireAuth(ctx.req);
  await requireAdminRole(ctx.admin, userId);

  const id = ctx.params.id;
  if (!id) return json({ ok: false, error: "id_required" }, 400);

  const body = await ctx.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  const patch: Record<string, unknown> = { updated_by: userId };

  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return json({ ok: false, error: "title_empty" }, 422);
    patch.title = t;
  }
  if (typeof body.description === "string")
    patch.description = body.description.trim() || null;
  if (typeof body.scheduled_start_at === "string")
    patch.scheduled_start_at = body.scheduled_start_at;
  if (typeof body.thumbnail_url !== "undefined") {
    const v = validateHttpsUrl(body.thumbnail_url, "thumbnail_url");
    if (v === "__invalid__") return json({ ok: false, error: "thumbnail_url_invalid" }, 422);
    patch.thumbnail_url = v;
  }
  if (typeof body.stream_url !== "undefined") {
    const v = validateHttpsUrl(body.stream_url, "stream_url");
    if (v === "__invalid__") return json({ ok: false, error: "stream_url_invalid" }, 422);
    patch.stream_url = v;
  }
  if (typeof body.embed_url !== "undefined") {
    const v = validateHttpsUrl(body.embed_url, "embed_url");
    if (v === "__invalid__") return json({ ok: false, error: "embed_url_invalid" }, 422);
    patch.embed_url = v;
  }
  if (
    typeof body.visibility === "string" &&
    ["public", "private", "unlisted"].includes(body.visibility)
  ) {
    patch.visibility = body.visibility;
  }

  if (Object.keys(patch).length === 1)
    return json({ ok: false, error: "no_changes" }, 400);

  const { data, error } = await ctx.admin
    .from("livestream_broadcast_events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[broadcast-events] update error", error.message);
    return json({ ok: false, error: "update_failed" }, 500);
  }
  if (!data) return json({ ok: false, error: "not_found" }, 404);

  return json({ ok: true, data });
}

export async function handleTransitionBroadcastStatus(
  ctx: HandlerCtx,
): Promise<Response> {
  const userId = requireAuth(ctx.req);
  await requireAdminRole(ctx.admin, userId);

  const id = ctx.params.id;
  if (!id) return json({ ok: false, error: "id_required" }, 400);

  const body = await ctx.req.json().catch(() => null) as Record<string, unknown> | null;
  const toStatus = typeof body?.status === "string" ? body.status as BroadcastStatus : null;
  if (!toStatus) return json({ ok: false, error: "status_required" }, 400);

  // Fetch current status
  const { data: current, error: fetchErr } = await ctx.admin
    .from("livestream_broadcast_events")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return json({ ok: false, error: "query_failed" }, 500);
  if (!current) return json({ ok: false, error: "not_found" }, 404);

  const fromStatus = current.status as BroadcastStatus;
  const allowed = STATUS_TRANSITIONS[fromStatus] ?? [];

  if (!allowed.includes(toStatus)) {
    return json(
      {
        ok: false,
        error: "invalid_transition",
        from: fromStatus,
        to: toStatus,
        allowed,
      },
      422,
    );
  }

  const timestampPatch: Record<string, string> = {};
  if (toStatus === "live") timestampPatch.actual_start_at = new Date().toISOString();
  if (toStatus === "ended") timestampPatch.actual_end_at = new Date().toISOString();

  const { data, error } = await ctx.admin
    .from("livestream_broadcast_events")
    .update({ status: toStatus, ...timestampPatch, updated_by: userId })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[broadcast-events] status transition error", error.message);
    return json({ ok: false, error: "update_failed" }, 500);
  }

  return json({ ok: true, data });
}

// Admin-only: list all events including drafts and archived.
export async function handleAdminListBroadcastEvents(
  ctx: HandlerCtx,
): Promise<Response> {
  const userId = requireAuth(ctx.req);
  await requireAdminRole(ctx.admin, userId);

  const url = new URL(ctx.req.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Math.max(limitRaw, 1), 100);
  const offsetRaw = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const offset = Math.max(offsetRaw, 0);

  const { data, error, count } = await ctx.admin
    .from("livestream_broadcast_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[broadcast-events] admin list error", error.message);
    return json({ ok: false, error: "query_failed" }, 500);
  }

  return json({ ok: true, data: data ?? [], total: count ?? 0, limit, offset });
}

// ── json helper override with extra headers ──────────────────────────────────

function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}
