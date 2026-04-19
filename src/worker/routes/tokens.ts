/**
 * Fan Token System (WS4) — worker routes.
 *
 *  Public reads
 *  ────────────
 *  GET  /api/tokens/products                        → active token bundles
 *  GET  /api/tokens/leaderboard/:gameId             → live game leaderboard
 *  GET  /api/tokens/leaderboard/season/:seasonId    → season aggregate
 *  GET  /api/tokens/categories                      → award categories (seed)
 *
 *  Authenticated
 *  ─────────────
 *  GET  /api/tokens/wallet                          → current balance + totals
 *  POST /api/tokens/purchase                        → Stripe Checkout for bundle
 *  POST /api/tokens/award                           → debit + credit + leaderboard
 *
 *  Stripe webhook
 *  ──────────────
 *  POST /api/tokens/webhook                         → fulfills purchases
 *                                                     (HMAC-verified + idempotent)
 *
 *  Feature gate: every route returns 403 { error: "fan_tokens_disabled" }
 *  when FEATURE_FAN_TOKEN_SYSTEM !== 'true'. This is enforced at the
 *  route body level (not at registration) so the route shape remains
 *  discoverable in OpenAPI dumps even when disabled.
 *
 *  Idempotency guarantees:
 *    * Award: caller-supplied idempotency-key (header) → UNIQUE
 *      constraint in fan_token_transactions. Replay returns the
 *      original transaction, never double-debits.
 *    * Webhook: Stripe event ID → UNIQUE constraint. Replay returns
 *      existing wallet balance; never double-credits.
 *
 *  Rate limiting: award endpoint is bounded by
 *  FAN_TOKEN_AWARD_RATE_PER_MIN (default 30) per user per minute via
 *  an in-memory sliding window. Above quota returns 429.
 */

import type { HandlerCtx } from '../shared';
import { json } from '../shared';

// ── Utility ──────────────────────────────────────────────────────────────────

function requireAuth(req: Request): string {
  const userId = req.headers.get('x-sbbl-user-id-verified');
  if (!userId) throw new Error('unauthorized');
  return userId;
}

function flagOn(env: Env): boolean {
  return env.FEATURE_FAN_TOKEN_SYSTEM === 'true' || env.FEATURE_FAN_TOKEN_SYSTEM === '1';
}

function gated<T>(ctx: HandlerCtx, fn: () => Promise<T>): Promise<T | Response> {
  if (!flagOn(ctx.env)) {
    return Promise.resolve(
      json({ ok: false, error: 'fan_tokens_disabled' }, 403) as unknown as T,
    );
  }
  return fn() as Promise<T>;
}

// Sliding-window per-user rate limiter, best-effort in-memory (per
// isolate). For a real cluster this should move to KV or DO — for WS4
// initial rollout an in-memory cap is sufficient and overloaded isolate
// will simply be rate-limited more strictly.
const awardWindows = new Map<string, number[]>();
const AWARD_WINDOW_MS = 60_000;

function checkAwardRate(userId: string, rate: number): boolean {
  const now = Date.now();
  const windowStart = now - AWARD_WINDOW_MS;
  const existing = awardWindows.get(userId) ?? [];
  const fresh = existing.filter((t) => t >= windowStart);
  if (fresh.length >= rate) {
    awardWindows.set(userId, fresh);
    return false;
  }
  fresh.push(now);
  awardWindows.set(userId, fresh);
  return true;
}

// ── Public reads ─────────────────────────────────────────────────────────────

export async function handleTokenProducts(ctx: HandlerCtx): Promise<Response> {
  if (!flagOn(ctx.env)) return json({ ok: false, error: 'fan_tokens_disabled' }, 403);
  const res = await ctx.admin
    .from('fan_token_products')
    .select('id,label,token_count,price_cad,stripe_price_id,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (res.error) return json({ ok: false, error: res.error.message }, 500);
  const products = (res.data ?? []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    label: String(p.label),
    tokenCount: Number(p.token_count),
    priceCad: Number(p.price_cad),
    stripePriceId: (p.stripe_price_id as string | null) ?? null,
    sortOrder: Number(p.sort_order ?? 0),
  }));
  return json(
    { ok: true, data: products },
    200,
  );
}

export async function handleTokenCategories(ctx: HandlerCtx): Promise<Response> {
  if (!flagOn(ctx.env)) return json({ ok: false, error: 'fan_tokens_disabled' }, 403);
  const res = await ctx.admin
    .from('token_award_categories')
    .select('slug,label,emoji,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (res.error) return json({ ok: false, error: res.error.message }, 500);
  return json({ ok: true, data: res.data ?? [] }, 200);
}

export async function handleLeaderboardByGame(ctx: HandlerCtx): Promise<Response> {
  if (!flagOn(ctx.env)) return json({ ok: false, error: 'fan_tokens_disabled' }, 403);
  const gameId = ctx.params.gameId;
  if (!gameId) return json({ ok: false, error: 'game_id_required' }, 400);
  const res = await ctx.admin
    .from('player_token_leaderboard')
    .select('player_id,total_tokens,category_breakdown,last_updated')
    .eq('game_id', gameId)
    .order('total_tokens', { ascending: false })
    .limit(50);
  if (res.error) return json({ ok: false, error: res.error.message }, 500);
  return json({ ok: true, data: res.data ?? [] });
}

export async function handleLeaderboardBySeason(ctx: HandlerCtx): Promise<Response> {
  if (!flagOn(ctx.env)) return json({ ok: false, error: 'fan_tokens_disabled' }, 403);
  const seasonId = ctx.params.seasonId;
  if (!seasonId) return json({ ok: false, error: 'season_id_required' }, 400);
  const res = await ctx.admin
    .from('player_token_leaderboard')
    .select('player_id,total_tokens,category_breakdown,last_updated')
    .eq('season_id', seasonId)
    .order('total_tokens', { ascending: false })
    .limit(100);
  if (res.error) return json({ ok: false, error: res.error.message }, 500);
  return json({ ok: true, data: res.data ?? [] });
}

// ── Authenticated ────────────────────────────────────────────────────────────

export async function handleTokenWallet(ctx: HandlerCtx): Promise<Response> {
  if (!flagOn(ctx.env)) return json({ ok: false, error: 'fan_tokens_disabled' }, 403);
  const userId = requireAuth(ctx.req);
  const res = await ctx.admin
    .from('fan_token_wallets')
    .select('balance,total_purchased,total_awarded')
    .eq('user_id', userId)
    .maybeSingle();
  if (res.error) return json({ ok: false, error: res.error.message }, 500);
  const wallet = (res.data as Record<string, unknown> | null) ?? null;
  return json({
    ok: true,
    wallet: {
      balance: Number(wallet?.balance ?? 0),
      totalPurchased: Number(wallet?.total_purchased ?? 0),
      totalAwarded: Number(wallet?.total_awarded ?? 0),
    },
  });
}

/**
 * POST /api/tokens/award
 * Body: { recipientPlayerId, amount, gameId?, seasonId?, categorySlug, idempotencyKey }
 *
 * Auth required. Rate-limited per user. Game (if provided) must be
 * live. Wallet must have sufficient balance. Atomic via award_fan_tokens
 * RPC — partial failure is impossible.
 */
export async function handleTokenAward(ctx: HandlerCtx): Promise<Response> {
  if (!flagOn(ctx.env)) return json({ ok: false, error: 'fan_tokens_disabled' }, 403);
  const userId = requireAuth(ctx.req);

  const rateLimit = Number(ctx.env.FAN_TOKEN_AWARD_RATE_PER_MIN ?? '30');
  if (!checkAwardRate(userId, rateLimit)) {
    return json({ ok: false, error: 'rate_limited' }, 429);
  }

  const body = (await ctx.req.json().catch(() => null)) as {
    recipientPlayerId?: string;
    amount?: number;
    gameId?: string | null;
    seasonId?: string | null;
    categorySlug?: string;
    idempotencyKey?: string;
  } | null;

  if (!body?.recipientPlayerId) return json({ ok: false, error: 'recipient_required' }, 400);
  if (!body.categorySlug) return json({ ok: false, error: 'category_required' }, 400);
  if (!body.idempotencyKey || body.idempotencyKey.length < 16) {
    return json({ ok: false, error: 'idempotency_key_required' }, 400);
  }
  const amount = Number(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    return json({ ok: false, error: 'amount_must_be_positive_integer' }, 400);
  }
  if (amount > 1000) {
    // Sanity cap — a single award above 1000 tokens is almost certainly
    // a client bug; keep the attack surface small.
    return json({ ok: false, error: 'amount_exceeds_per_call_cap' }, 400);
  }

  // If gameId is provided, require the game to currently be live. Avoids
  // awarding tokens retroactively in a way that inflates a player's
  // per-game total after the fact.
  if (body.gameId) {
    const g = await ctx.admin
      .from('games')
      .select('status')
      .eq('id', body.gameId)
      .maybeSingle();
    const status = (g.data as { status?: string } | null)?.status;
    if (status !== 'live') return json({ ok: false, error: 'game_not_live' }, 409);
  }

  const rpc = await ctx.admin.rpc('award_fan_tokens', {
    p_user_id: userId,
    p_recipient_player_id: body.recipientPlayerId,
    p_amount: amount,
    p_game_id: body.gameId ?? null,
    p_season_id: body.seasonId ?? null,
    p_category_slug: body.categorySlug,
    p_idempotency_key: body.idempotencyKey,
  });

  if (rpc.error) {
    const msg = rpc.error.message || 'award_failed';
    if (/insufficient_balance/i.test(msg)) return json({ ok: false, error: 'insufficient_balance' }, 409);
    if (/recipient_required|category_required|amount_must/.test(msg)) {
      return json({ ok: false, error: msg }, 400);
    }
    return json({ ok: false, error: msg }, 500);
  }

  const result = rpc.data as {
    replay: boolean;
    transaction_id: string;
    recipient_player_id: string;
    amount: number;
    wallet_balance?: number;
    leaderboard_total: number;
  };

  // Broadcast leaderboard delta over Supabase Realtime. Failure here is
  // non-fatal; the UI will reconcile on next page load / server poll.
  if (body.gameId) {
    try {
      const channel = ctx.admin.channel(`tokens:${body.gameId}`);
      await channel.send({
        type: 'broadcast',
        event: 'leaderboard_update',
        payload: {
          playerId: result.recipient_player_id,
          amount: result.amount,
          categorySlug: body.categorySlug,
          total: result.leaderboard_total,
        },
      });
    } catch {
      /* non-critical */
    }
  }

  return json({ ok: true, ...result });
}

/**
 * POST /api/tokens/purchase
 * Body: { productId }
 * Response: { checkoutUrl, sessionId }
 *
 * Creates a Stripe Checkout Session for the selected bundle. Price is
 * resolved from the database — never from the client body.
 */
export async function handleTokenPurchase(ctx: HandlerCtx): Promise<Response> {
  if (!flagOn(ctx.env)) return json({ ok: false, error: 'fan_tokens_disabled' }, 403);
  const userId = requireAuth(ctx.req);

  const body = (await ctx.req.json().catch(() => null)) as { productId?: string } | null;
  if (!body?.productId) return json({ ok: false, error: 'product_id_required' }, 400);

  const prodRes = await ctx.admin
    .from('fan_token_products')
    .select('id,label,token_count,price_cad,stripe_price_id,is_active')
    .eq('id', body.productId)
    .maybeSingle();
  const product = prodRes.data as
    | { id: string; label: string; token_count: number; price_cad: number; stripe_price_id: string | null; is_active: boolean }
    | null;
  if (!product || !product.is_active) {
    return json({ ok: false, error: 'product_not_found' }, 404);
  }

  const stripeKey = ctx.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ ok: false, error: 'stripe_not_configured' }, 503);

  const successUrl = new URL(ctx.req.url);
  successUrl.pathname = '/app';
  successUrl.searchParams.set('tokens', 'purchased');
  const cancelUrl = new URL(ctx.req.url);
  cancelUrl.pathname = '/app';
  cancelUrl.searchParams.set('tokens', 'cancelled');

  // Build checkout session form-body. Prefer stripe_price_id when set;
  // otherwise fall back to ad-hoc price_data so ops can seed bundles
  // without Stripe pre-configuration.
  const formBody = new URLSearchParams();
  formBody.set('mode', 'payment');
  formBody.set('success_url', successUrl.toString());
  formBody.set('cancel_url', cancelUrl.toString());
  formBody.set('client_reference_id', userId);
  formBody.set('metadata[purchase_type]', 'fan_tokens');
  formBody.set('metadata[product_id]', product.id);
  formBody.set('metadata[token_amount]', String(product.token_count));
  formBody.set('metadata[user_id]', userId);

  if (product.stripe_price_id) {
    formBody.set('line_items[0][price]', product.stripe_price_id);
    formBody.set('line_items[0][quantity]', '1');
  } else {
    formBody.set('line_items[0][price_data][currency]', 'cad');
    formBody.set('line_items[0][price_data][product_data][name]', product.label);
    formBody.set('line_items[0][price_data][unit_amount]', String(Math.round(Number(product.price_cad) * 100)));
    formBody.set('line_items[0][quantity]', '1');
  }

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
  });
  const payload = (await resp.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!resp.ok || !payload.url) {
    return json({ ok: false, error: payload.error?.message ?? 'stripe_error' }, 502);
  }

  return json({
    ok: true,
    checkoutUrl: payload.url,
    sessionId: payload.id,
    productId: product.id,
  });
}

/**
 * POST /api/tokens/webhook
 *
 * Stripe webhook handler dedicated to fan-token purchases. Distinct
 * from the primary /webhooks/stripe PPV handler so the two flows can
 * evolve independently. HMAC-SHA256 verification uses the existing
 * STRIPE_WEBHOOK_SECRET (ops may rotate this to a dedicated secret
 * later without code changes).
 *
 * Idempotency: Stripe event ID is passed through to the
 * fulfill_fan_token_purchase RPC as the idempotency_key. Replays
 * short-circuit at the database layer.
 */
export async function handleTokenWebhook(ctx: HandlerCtx): Promise<Response> {
  // This route is intentionally NOT gated by FEATURE_FAN_TOKEN_SYSTEM:
  // if Stripe already has a session in flight, turning the flag off
  // must not drop the fulfillment on the floor. The RPC itself is
  // idempotent so replays are safe.
  const rawBody = await ctx.req.text();
  const signature = ctx.req.headers.get('stripe-signature');
  const webhookSecret = ctx.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return json({ ok: false, error: 'webhook_not_configured' }, 503);
  }

  // Minimal Stripe signature verification inline (avoids a Stripe SDK
  // dependency in the worker). The existing PPV webhook uses the same
  // pattern; we reuse the helper here via a local implementation to
  // keep the route self-contained.
  const match = signature.match(/t=(\d+),v1=([0-9a-f]+)/);
  if (!match) return json({ ok: false, error: 'bad_signature_format' }, 400);
  const [, timestamp, v1] = match;
  const signed = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (expected !== v1) return json({ ok: false, error: 'signature_mismatch' }, 401);

  let event: {
    id?: string;
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  if (event.type !== 'checkout.session.completed') {
    // Not ours; ACK so Stripe stops retrying.
    return json({ ok: true, ignored: true });
  }

  const obj = event.data?.object ?? {};
  const metadata = (obj.metadata as Record<string, string> | undefined) ?? {};
  if (metadata.purchase_type !== 'fan_tokens') {
    return json({ ok: true, ignored: true });
  }

  const userId = metadata.user_id;
  const amount = Number(metadata.token_amount ?? '0');
  if (!userId || !Number.isInteger(amount) || amount <= 0) {
    return json({ ok: false, error: 'bad_metadata' }, 400);
  }
  const eventId = event.id ?? `fallback-${crypto.randomUUID()}`;
  const piId = typeof obj.payment_intent === 'string' ? obj.payment_intent : null;

  const rpc = await ctx.admin.rpc('fulfill_fan_token_purchase', {
    p_user_id: userId,
    p_amount: amount,
    p_stripe_event_id: eventId,
    p_stripe_pi_id: piId,
  });

  if (rpc.error) {
    return json({ ok: false, error: rpc.error.message }, 500);
  }
  return json({ ok: true, ...(rpc.data as Record<string, unknown>) });
}

// ── Test seam ────────────────────────────────────────────────────────────────
// Reset the in-memory rate-limit map — exposed for unit tests.
export function __resetTokenRateLimitForTests(): void {
  awardWindows.clear();
}
