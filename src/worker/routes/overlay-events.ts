/**
 * WS6 — Mic Up Series overlay event route.
 *
 * POST /api/streams/:gameId/overlay/event
 *   Body: { eventType: 'trash_talk' | 'lower_third' | 'intro_sting', payload: {...} }
 *   Auth: league_admin | super_admin
 *   Action: insert overlay_event_log row + broadcast on `overlay:{gameId}`
 *
 * Gating: FEATURE_MIC_UP_SERIES + games.mic_up_series=true.
 *
 * Idempotency: clients SHOULD supply an Idempotency-Key header; duplicates
 * return 200 with the original event. overlay_event_log has no UNIQUE
 * constraint on a client key by design (ops frequently re-fire the same
 * lower-third manually), so idempotency is per-request via
 * ensureMutation's existing dedupe.
 */
import type { HandlerCtx } from '../shared';
import { json } from '../shared';

const ALLOWED_EVENT_TYPES = new Set(['trash_talk', 'lower_third', 'intro_sting']);

function requireAuth(req: Request): string {
  const userId = req.headers.get('x-sbbl-user-id-verified');
  if (!userId) throw new Error('unauthorized');
  return userId;
}

function flagOn(env: Env): boolean {
  return env.FEATURE_MIC_UP_SERIES === 'true' || env.FEATURE_MIC_UP_SERIES === '1';
}

async function isAdmin(ctx: HandlerCtx, userId: string): Promise<boolean> {
  const { data, error } = await ctx.admin
    .from('user_role_assignments')
    .select('role')
    .eq('user_id', userId);
  if (error) return false;
  const roles = new Set<string>((data as { role: string }[] | null)?.map((r) => r.role) ?? []);
  return roles.has('league_admin') || roles.has('super_admin');
}

export async function handleMicUpOverlayEvent(ctx: HandlerCtx): Promise<Response> {
  if (!flagOn(ctx.env)) return json({ ok: false, error: 'mic_up_disabled' }, 403);

  const userId = requireAuth(ctx.req);
  const gameId = ctx.params.gameId;
  if (!gameId) return json({ ok: false, error: 'game_id_required' }, 400);

  const admin = await isAdmin(ctx, userId);
  if (!admin) return json({ ok: false, error: 'forbidden' }, 403);

  const body = (await ctx.req.json().catch(() => null)) as {
    eventType?: string;
    payload?: Record<string, unknown>;
  } | null;

  if (!body?.eventType || !ALLOWED_EVENT_TYPES.has(body.eventType)) {
    return json({ ok: false, error: 'invalid_event_type' }, 400);
  }

  // Per-game gate: mic_up_series must be tagged on the game row. This
  // prevents accidental overlays on full-game feeds.
  const gRes = await ctx.admin
    .from('games')
    .select('id, mic_up_series')
    .eq('id', gameId)
    .maybeSingle();
  const game = gRes.data as { id: string; mic_up_series?: boolean } | null;
  if (!game) return json({ ok: false, error: 'game_not_found' }, 404);
  if (!game.mic_up_series) {
    return json({ ok: false, error: 'mic_up_not_enabled_on_game' }, 409);
  }

  const payload = typeof body.payload === 'object' && body.payload !== null ? body.payload : {};

  const ins = await ctx.admin
    .from('overlay_event_log')
    .insert({
      game_id: gameId,
      event_type: body.eventType,
      payload,
      triggered_by: userId,
    })
    .select('id, game_id, event_type, payload, triggered_at')
    .single();

  if (ins.error) return json({ ok: false, error: ins.error.message }, 500);

  // Broadcast — best-effort.
  try {
    await ctx.admin.channel(`overlay:${gameId}`).send({
      type: 'broadcast',
      event: body.eventType,
      payload: {
        ...payload,
        eventId: (ins.data as { id: string }).id,
        triggeredAt: (ins.data as { triggered_at: string }).triggered_at,
      },
    });
  } catch {
    /* non-critical */
  }

  return json({ ok: true, event: ins.data }, 201);
}

export async function handleLatestMicUpOverlayEvents(ctx: HandlerCtx): Promise<Response> {
  if (!flagOn(ctx.env)) return json({ ok: false, error: 'mic_up_disabled' }, 403);
  const gameId = ctx.params.gameId;
  if (!gameId) return json({ ok: false, error: 'game_id_required' }, 400);
  const res = await ctx.admin
    .from('overlay_event_log')
    .select('id, game_id, event_type, payload, triggered_at')
    .eq('game_id', gameId)
    .order('triggered_at', { ascending: false })
    .limit(20);
  if (res.error) return json({ ok: false, error: res.error.message }, 500);
  return json({ ok: true, data: res.data ?? [] }, 200);
}
