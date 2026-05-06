/**
 * Sponsor slot routes.
 *
 *  Public
 *  ──────
 *  GET  /api/public/sponsors?leagueId=… → active sponsors for rotation
 *  POST /api/public/sponsors/:id/track  → record impression | click
 *
 *  Admin
 *  ─────
 *  GET  /api/ops/sponsors               → list (all, including inactive)
 *  POST /api/ops/sponsors               → create
 *  POST /api/ops/sponsors/:id           → update
 *  POST /api/ops/sponsors/:id/delete    → soft delete (active=false)
 */

import type { HandlerCtx } from "../shared";
import { json } from "../shared";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function requireSponsorAdmin(ctx: HandlerCtx): Promise<string> {
  const userId = ctx.req.headers.get("x-sbbl-user-id-verified");
  if (!userId) throw new Error("unauthorized");
  const { data } = await ctx.admin
    .from("user_role_assignments")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((row) => String(row.role));
  if (!roles.some((r) => ["super_admin", "league_admin"].includes(r))) {
    throw new Error("forbidden");
  }
  return userId;
}

export async function handlePublicSponsors({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get("leagueId");
  const now = new Date().toISOString();

  let q = admin
    .from("sponsor_slots")
    .select(
      "id,name,tagline,logo_url,click_url,background_color,text_color,weight,league_id",
    )
    .eq("active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("weight", { ascending: false });
  if (leagueId && isUuid(leagueId)) {
    q = q.or(`league_id.eq.${leagueId},league_id.is.null`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, s-maxage=30, max-age=15",
    },
  });
}

export async function handleTrackSponsorEvent({
  req,
  admin,
  params,
}: HandlerCtx) {
  const sponsorId = params.id ?? "";
  if (!isUuid(sponsorId)) return json({ ok: false, error: "invalid_id" }, 400);

  let body: { kind?: string; game_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const kind = body.kind === "click" ? "click" : "impression";
  const userId = req.headers.get("x-sbbl-user-id-verified");

  // Fire-and-forget — do not block the UI.
  await admin.from("sponsor_impressions").insert({
    sponsor_id: sponsorId,
    game_id: body.game_id && isUuid(body.game_id) ? body.game_id : null,
    kind,
    user_id: userId,
  });
  return json({ ok: true });
}

export async function handleAdminListSponsors(ctx: HandlerCtx) {
  await requireSponsorAdmin(ctx);
  const { data, error } = await ctx.admin
    .from("sponsor_slots")
    .select("*")
    .order("weight", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}

const SPONSOR_FIELDS = [
  "name",
  "tagline",
  "logo_url",
  "click_url",
  "background_color",
  "text_color",
  "weight",
  "active",
  "league_id",
  "starts_at",
  "ends_at",
] as const;

export async function handleCreateSponsor(ctx: HandlerCtx) {
  await requireSponsorAdmin(ctx);
  let body: Record<string, unknown>;
  try {
    body = (await ctx.req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.name || String(body.name).trim() === "") {
    return json({ ok: false, error: "missing_name" }, 400);
  }
  const payload: Record<string, unknown> = {};
  for (const f of SPONSOR_FIELDS) {
    if (f in body) payload[f] = body[f];
  }
  const { data, error } = await ctx.admin
    .from("sponsor_slots")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return json({ ok: true, sponsor: data });
}

export async function handleUpdateSponsor(ctx: HandlerCtx) {
  await requireSponsorAdmin(ctx);
  const id = ctx.params.id ?? "";
  if (!isUuid(id)) return json({ ok: false, error: "invalid_id" }, 400);
  let body: Record<string, unknown>;
  try {
    body = (await ctx.req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const f of SPONSOR_FIELDS) {
    if (f in body) payload[f] = body[f];
  }
  const { data, error } = await ctx.admin
    .from("sponsor_slots")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return json({ ok: true, sponsor: data });
}

export async function handleDeleteSponsor(ctx: HandlerCtx) {
  await requireSponsorAdmin(ctx);
  const id = ctx.params.id ?? "";
  if (!isUuid(id)) return json({ ok: false, error: "invalid_id" }, 400);
  const { error } = await ctx.admin
    .from("sponsor_slots")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
}
