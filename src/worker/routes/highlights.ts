/**
 * Highlight clip routes.
 *
 *  Public
 *  ──────
 *  GET  /api/public/highlights/:gameId                        → recent highlights for a game
 *  GET  /api/public/streams/:gameId/reactions/aggregate       → windowed reaction aggregate
 *
 *  Authenticated (admin / league / ops)
 *  ────────────────────────────────────
 *  POST /api/ops/highlights/mark                              → mark a manual highlight now
 *  POST /api/ops/highlights/:id                               → update title/description/media
 *  POST /api/ops/highlights/:id/delete                        → delete a highlight
 *
 * Highlights are short, addressable pointers into the live game clock. The
 * marker endpoint auto-fills period / clock / score from the current
 * overlay_game_state row so operators can tap a single button mid-broadcast.
 */

import type { HandlerCtx } from "../shared";
import { json } from "../shared";

const HIGHLIGHT_SELECT = "*";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function requireOverlayAdmin(ctx: HandlerCtx): Promise<string> {
  const userId = ctx.req.headers.get("x-sbbl-user-id-verified");
  if (!userId) throw new Error("unauthorized");
  const { data, error } = await ctx.admin
    .from("user_role_assignments")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row) => String(row.role));
  if (
    !roles.some((r) =>
      ["super_admin", "league_admin", "team_manager", "media_operator"].includes(r),
    )
  ) {
    throw new Error("forbidden");
  }
  return userId;
}

// ──────────────────────────────────────────────────────────────────────────
// Public: GET /api/public/highlights/:gameId
// ──────────────────────────────────────────────────────────────────────────
export async function handlePublicHighlights({ admin, params }: HandlerCtx) {
  const gameId = params.gameId ?? "";
  if (!gameId || !isUuid(gameId)) {
    return json({ ok: false, error: "invalid_game_id" }, 400);
  }

  const { data, error } = await admin
    .from("highlight_clips")
    .select(HIGHLIGHT_SELECT)
    .eq("game_id", gameId)
    .order("occurred_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  return new Response(
    JSON.stringify({ ok: true, data: Array.isArray(data) ? data : [] }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=10, max-age=5",
      },
    },
  );
}

// ──────────────────────────────────────────────────────────────────────────
// POST /api/ops/highlights/mark
// Body: { game_id, title?, description?, player_id?, media_url?, kind? }
// ──────────────────────────────────────────────────────────────────────────
export async function handleMarkHighlight(ctx: HandlerCtx) {
  const userId = await requireOverlayAdmin(ctx);

  let body: {
    game_id?: string;
    title?: string;
    description?: string;
    player_id?: string;
    media_url?: string;
    kind?: "manual";
  };
  try {
    body = (await ctx.req.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const gameId = body.game_id ?? "";
  if (!gameId || !isUuid(gameId)) {
    return json({ ok: false, error: "invalid_game_id" }, 400);
  }

  // Snapshot live scoreboard state so the clip carries its moment.
  const { data: overlayRow } = await ctx.admin
    .from("overlay_game_state")
    .select("period,clock_seconds,home_score,away_score")
    .eq("game_id", gameId)
    .maybeSingle();

  const overlay = (overlayRow ?? {}) as Record<string, unknown>;
  const nowIso = new Date().toISOString();

  const row: Record<string, unknown> = {
    game_id: gameId,
    kind: "manual",
    period: overlay.period != null ? Number(overlay.period) : null,
    clock_seconds:
      overlay.clock_seconds != null ? Number(overlay.clock_seconds) : null,
    home_score: overlay.home_score != null ? Number(overlay.home_score) : null,
    away_score: overlay.away_score != null ? Number(overlay.away_score) : null,
    player_id: body.player_id ?? null,
    title: body.title ?? null,
    description: body.description ?? null,
    media_url: body.media_url ?? null,
    thumbnail_url: null,
    occurred_at: nowIso,
    created_by: userId,
  };

  const { data, error } = await ctx.admin
    .from("highlight_clips")
    .insert(row)
    .select(HIGHLIGHT_SELECT)
    .single();
  if (error) throw new Error(error.message);

  return json({ ok: true, highlight: data });
}

// ──────────────────────────────────────────────────────────────────────────
// POST /api/ops/highlights/:id/delete
// ──────────────────────────────────────────────────────────────────────────
export async function handleDeleteHighlight(ctx: HandlerCtx) {
  await requireOverlayAdmin(ctx);
  const id = ctx.params.id ?? "";
  if (!id || !isUuid(id)) {
    return json({ ok: false, error: "invalid_id" }, 400);
  }

  const { error } = await ctx.admin
    .from("highlight_clips")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  return json({ ok: true });
}

// ──────────────────────────────────────────────────────────────────────────
// POST /api/ops/highlights/:id
// Body: partial { title, description, media_url, thumbnail_url }
// ──────────────────────────────────────────────────────────────────────────
const ALLOWED_UPDATE_FIELDS = new Set([
  "title",
  "description",
  "media_url",
  "thumbnail_url",
]);

export async function handleUpdateHighlight(ctx: HandlerCtx) {
  await requireOverlayAdmin(ctx);
  const id = ctx.params.id ?? "";
  if (!id || !isUuid(id)) {
    return json({ ok: false, error: "invalid_id" }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await ctx.req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_UPDATE_FIELDS.has(key)) {
      patch[key] = value;
    }
  }

  const { data, error } = await ctx.admin
    .from("highlight_clips")
    .update(patch)
    .eq("id", id)
    .select(HIGHLIGHT_SELECT)
    .single();
  if (error) throw new Error(error.message);

  return json({ ok: true, highlight: data });
}

// ──────────────────────────────────────────────────────────────────────────
// Public: GET /api/public/streams/:gameId/reactions/aggregate?window=30
// Thin passthrough to the get_reaction_aggregate RPC. Window clamps to
// [5, 300] seconds so the DB function can't be tricked into scanning a
// year of rows.
// ──────────────────────────────────────────────────────────────────────────
export async function handleReactionAggregate({ req, admin, params }: HandlerCtx) {
  const gameId = params.gameId ?? "";
  if (!gameId || !isUuid(gameId)) {
    return json({ ok: false, error: "invalid_game_id" }, 400);
  }

  const url = new URL(req.url);
  const rawWindow = Number(url.searchParams.get("window") ?? "30");
  const window = Number.isFinite(rawWindow)
    ? Math.max(5, Math.min(300, Math.floor(rawWindow)))
    : 30;

  const { data, error } = await admin.rpc("get_reaction_aggregate", {
    p_game_id: gameId,
    p_window_seconds: window,
  });
  if (error) throw new Error(error.message);

  return new Response(
    JSON.stringify({ ok: true, data: data ?? [] }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=2, max-age=1",
      },
    },
  );
}
