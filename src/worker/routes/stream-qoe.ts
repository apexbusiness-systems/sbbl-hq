/**
 * StreamForge QoE ingest + health report routes.
 *
 * POST /api/streams/:gameId/qoe
 *   Fire-and-forget beacon ingest. No auth required — payloads carry only an
 *   anonymous sessionIdHash; PII is never collected. Rate-limiting is handled
 *   at the outer Worker layer (120 req/min per IP). The route validates the
 *   payload through the single trust boundary (`parseBeaconPayload`), merges
 *   it into a per-game rolling aggregate stored in the Cloudflare Cache API,
 *   and returns 204. Any cache failure is swallowed so beacon delivery can
 *   never impact the player.
 *
 * GET /api/streams/:gameId/qoe
 *   Returns the current health report for ops dashboards.
 *   Requires super_admin role (checked via the -verified header set by the
 *   Worker JWT layer). Returns { ok: true, report: null } when no data exists.
 *
 * Storage design
 * --------------
 *   The Cloudflare Cache API is used as a zero-cost, zero-DB, edge-local
 *   rolling aggregate store. Key: `https://sbbl-hq.icu/__cache/qoe/:gameId`.
 *   TTL: 10 minutes (cache-control: public, max-age=600). The aggregate is
 *   O(1) in memory and disk regardless of sample count (running sums only).
 *   Cache is per-datacenter and approximate — that is sufficient for QoE.
 */

import type { HandlerCtx } from '../shared';
import { json } from '../shared';
import {
  mergeBeaconIntoAggregate,
  parseBeaconPayload,
  toHealthReport,
  type AggregatedHealth,
} from '@/lib/stream/streamforge';

/** Cache key for a game's QoE aggregate. */
function qoeCacheUrl(gameId: string): string {
  return `https://sbbl-hq.icu/__cache/qoe/${encodeURIComponent(gameId)}`;
}

/**
 * POST /api/streams/:gameId/qoe
 *
 * Ingest a QoE beacon. No auth required — fire-and-forget telemetry.
 * Responds 204 No Content on success; 4xx on validation failure.
 */
export async function handleQoeIngest({
  req,
  params,
}: HandlerCtx): Promise<Response> {
  const gameId = params.gameId ?? '';
  if (!gameId || gameId.length > 128) {
    return json({ ok: false, error: 'invalid_game_id' }, 400);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const beacon = parseBeaconPayload(raw);
  if (!beacon) {
    return json({ ok: false, error: 'invalid_payload' }, 400);
  }

  // Cross-game pollution guard: the beacon's gameId must match the URL param.
  // This prevents a malicious client from poisoning a different game's aggregate.
  if (beacon.gameId !== gameId) {
    return json({ ok: false, error: 'game_id_mismatch' }, 400);
  }

  // ── Cache API aggregate (zero-DB, zero-KV) ──────────────────────────────
  try {
    const cfCaches = caches as unknown as { default: Cache };
    const cache = cfCaches.default;
    const cacheKey = new Request(qoeCacheUrl(gameId));
    const cached = await cache.match(cacheKey);
    const existing: AggregatedHealth | null = cached
      ? ((await cached.json()) as AggregatedHealth)
      : null;
    const merged = mergeBeaconIntoAggregate(existing, beacon);
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(merged), {
        headers: {
          'content-type': 'application/json',
          // 10-minute TTL: aggregate stays readable briefly even when
          // beacons stop (stream ended), then naturally evicts.
          'cache-control': 'public, max-age=600',
        },
      }),
    );
  } catch {
    // Cache write failures are silent — never break beacon delivery.
  }

  // 204 No Content: fire-and-forget semantics, no response body needed.
  return new Response(null, { status: 204 });
}

/**
 * GET /api/streams/:gameId/qoe
 *
 * Return the current health report for a game. Ops-only (super_admin).
 */
export async function handleQoeHealthReport({
  req,
  params,
}: HandlerCtx): Promise<Response> {
  const roles = (req.headers.get('x-sbbl-roles-verified') ?? '').split(',');
  if (!roles.includes('super_admin')) throw new Error('forbidden');

  const gameId = params.gameId ?? '';
  if (!gameId) {
    return json({ ok: false, error: 'invalid_game_id' }, 400);
  }

  try {
    const cfCaches = caches as unknown as { default: Cache };
    const cache = cfCaches.default;
    const cacheKey = new Request(qoeCacheUrl(gameId));
    const cached = await cache.match(cacheKey);
    if (!cached) return json({ ok: true, report: null });
    const aggregate = (await cached.json()) as AggregatedHealth;
    return json({ ok: true, report: toHealthReport(aggregate) });
  } catch {
    return json({ ok: false, error: 'cache_unavailable' }, 500);
  }
}
