/**
 * OBS broadcast control routes.
 *
 * A lightweight command-queue bridge that lets the web ops console send
 * commands to an OBS instance running on a broadcast machine.
 *
 * The `obs-agent` process running on the broadcast workstation polls
 * `GET /api/ops/obs/commands?since=…` and forwards each command over the
 * OBS WebSocket protocol, then acknowledges it with
 * `POST /api/ops/obs/commands/:id/ack`. The agent identifies itself with
 * a Bearer token matching `OBS_AGENT_TOKEN` (env var).
 *
 * Admin web UI
 * ────────────
 *  POST /api/ops/obs/commands         → enqueue a command
 *  GET  /api/ops/obs/commands         → recent commands (status filter)
 *
 * Agent
 * ─────
 *  GET  /api/ops/obs/commands/pending  → pending commands (Bearer token)
 *  POST /api/ops/obs/commands/:id/ack  → acknowledge (Bearer token)
 */

import type { HandlerCtx } from "../shared";
import { json } from "../shared";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

const VALID_KINDS = new Set([
  "scene_switch",
  "source_visibility",
  "filter_enable",
  "start_stream",
  "stop_stream",
  "start_record",
  "stop_record",
  "set_text_source",
  "refresh_browser_source",
]);

async function requireObsAdmin(ctx: HandlerCtx): Promise<string> {
  const userId = ctx.req.headers.get("x-sbbl-user-id-verified");
  if (!userId) throw new Error("unauthorized");
  const { data } = await ctx.admin
    .from("user_role_assignments")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((row) => String(row.role));
  if (
    !roles.some((r) =>
      ["super_admin", "league_admin", "media_operator"].includes(r),
    )
  ) {
    throw new Error("forbidden");
  }
  return userId;
}

function requireAgent(ctx: HandlerCtx): void {
  const expected = (ctx.env as unknown as { OBS_AGENT_TOKEN?: string })
    .OBS_AGENT_TOKEN;
  if (!expected) throw new Error("obs_agent_not_configured");
  const auth = ctx.req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== expected) throw new Error("forbidden");
}

export async function handleEnqueueObsCommand(ctx: HandlerCtx) {
  const userId = await requireObsAdmin(ctx);
  let body: { kind?: string; payload?: unknown; game_id?: string };
  try {
    body = (await ctx.req.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const kind = String(body.kind ?? "");
  if (!VALID_KINDS.has(kind)) {
    return json({ ok: false, error: "invalid_kind" }, 400);
  }
  const { data, error } = await ctx.admin
    .from("obs_commands")
    .insert({
      kind,
      payload:
        body.payload && typeof body.payload === "object" ? body.payload : {},
      game_id: body.game_id && isUuid(body.game_id) ? body.game_id : null,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return json({ ok: true, command: data });
}

export async function handleListObsCommands(ctx: HandlerCtx) {
  await requireObsAdmin(ctx);
  const { data, error } = await ctx.admin
    .from("obs_commands")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}

export async function handleAgentPending(ctx: HandlerCtx) {
  requireAgent(ctx);
  const { data, error } = await ctx.admin
    .from("obs_commands")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}

export async function handleAgentAck(ctx: HandlerCtx) {
  requireAgent(ctx);
  const id = ctx.params.id ?? "";
  if (!isUuid(id)) return json({ ok: false, error: "invalid_id" }, 400);
  let body: { status?: string; error?: string };
  try {
    body = (await ctx.req.json()) as typeof body;
  } catch {
    body = {};
  }
  const status = body.status === "failed" ? "failed" : "acked";
  const { error } = await ctx.admin
    .from("obs_commands")
    .update({
      status,
      acked_at: new Date().toISOString(),
      error_text: body.error ? String(body.error).slice(0, 500) : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
}
