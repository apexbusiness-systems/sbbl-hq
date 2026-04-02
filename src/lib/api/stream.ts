/**
 * src/lib/api/stream.ts
 *
 * Stream management API — admin config, live status, access overrides,
 * session history, and revenue reporting.
 *
 * Routes required in worker (see STREAM_OPS_WORKER_PATCH.md):
 *   GET  /api/streams/status            → public, poll for isLive + viewerCount
 *   GET  /ops/streams/config            → league_admin: read stream config
 *   POST /ops/streams/config            → super_admin:  update collection ID / title / source
 *   POST /ops/streams/status            → super_admin:  go live / end broadcast
 *   GET  /ops/streams/sessions          → league_admin: session history
 *   POST /ops/access/override           → super_admin:  grant / revoke PPV access
 *   GET  /ops/revenue                   → league_admin: PPV revenue summary
 *   GET  /ops/review                    → league_admin: review queue (replaces stub)
 *   POST /ops/review/:id/resolve        → league_admin: resolve review item
 */

import { apiFetch } from '@/lib/api/client';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@/lib/api/idempotency';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StreamConfig {
  collectionId: string;       // Switcher Studio collection ID
  title: string;              // broadcast title shown in Ops panel
  source: 'main' | 'backup' | 'test';
  isLive: boolean;
  viewerCount: number;
  updatedAt?: string;
}

export interface StreamSession {
  id: string;
  gameId: string;
  gameName?: string;
  leagueId: string;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number;
  peakViewers: number;
  totalPpvRevenue: number;
  source: string;
}

export interface ReviewItem {
  id: string;
  type: 'rule_conflict' | 'source_conflict' | 'publish_review' | 'stream_issue' | 'moderation';
  title: string;
  description?: string;
  league?: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface RevenueSnapshot {
  totalPpvRevenue: number;
  totalPpvOrders: number;
  totalInviteRedemptions: number;
  recentSessions: StreamSession[];
}

export interface AccessOverridePayload {
  email?: string;
  userId?: string;
  gameId: string;
  action: 'grant' | 'revoke';
  reason?: string;
}

export interface UserAccessLookup {
  userId: string;
  email: string;
  roles: string[];
  hasPpvAccess: boolean;
  ppvEntitlements: Array<{ gameId: string; grantedAt: string; grantedBy: string; method: string }>;
}

// ── Public Endpoints ─────────────────────────────────────────────────────────

/** Poll current stream status — no auth required */
export async function fetchPublicStreamStatus(gameId?: string) {
  const qs = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
  return apiFetch<{ ok: boolean; isLive: boolean; title: string; viewerCount: number; collectionId: string }>(
    `/api/streams/status${qs}`,
  );
}

// ── Admin Config ─────────────────────────────────────────────────────────────

/** Fetch full stream config — requires league_admin or higher */
export async function fetchAdminStreamConfig(token: string | null) {
  return apiFetch<{ ok: boolean; config: StreamConfig }>('/ops/streams/config', {}, token);
}

/** Persist stream config changes — requires super_admin */
export async function updateStreamConfig(
  patch: Partial<Pick<StreamConfig, 'collectionId' | 'title' | 'source'>>,
  token: string | null,
) {
  return apiFetch<{ ok: boolean; config: StreamConfig }>('/ops/streams/config', {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey('ops-stream-config') },
    body: JSON.stringify(patch),
  }, token);
}

/** Go live / end broadcast — requires super_admin */
export async function setStreamLive(isLive: boolean, token: string | null) {
  return apiFetch<{ ok: boolean; isLive: boolean; startedAt?: string; endedAt?: string }>(
    '/ops/streams/status',
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-stream-live-${isLive}`) },
      body: JSON.stringify({ isLive }),
    },
    token,
  );
}

// ── Session History ──────────────────────────────────────────────────────────

/** Fetch recent broadcast sessions — requires league_admin */
export async function fetchStreamSessions(token: string | null) {
  return apiFetch<{ ok: boolean; sessions: StreamSession[] }>(
    '/ops/streams/sessions',
    {},
    token,
  );
}

// ── Revenue ──────────────────────────────────────────────────────────────────

/** Fetch PPV revenue snapshot — requires league_admin */
export async function fetchStreamRevenue(token: string | null) {
  return apiFetch<{ ok: boolean } & RevenueSnapshot>('/ops/revenue', {}, token);
}

// ── Access Override ──────────────────────────────────────────────────────────

/** Look up a user's stream access status by email — requires super_admin */
export async function lookupUserAccess(email: string, token: string | null) {
  return apiFetch<{ ok: boolean; user: UserAccessLookup }>(
    `/ops/access/lookup?email=${encodeURIComponent(email)}`,
    {},
    token,
  );
}

/** Grant or revoke manual PPV access — requires super_admin */
export async function submitAccessOverride(
  payload: AccessOverridePayload,
  token: string | null,
) {
  return apiFetch<{ ok: boolean; userId: string; action: string; gameId: string }>(
    '/ops/access/override',
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-access-${payload.action}-${payload.gameId}`) },
      body: JSON.stringify(payload),
    },
    token,
  );
}

// ── Review Queue ─────────────────────────────────────────────────────────────

/** Fetch ops review queue — requires league_admin */
export async function fetchReviewQueue(token: string | null) {
  return apiFetch<{ ok: boolean; queue: ReviewItem[] }>('/ops/review', {}, token);
}

/** Resolve a review item — requires league_admin */
export async function resolveReviewItem(
  id: string,
  resolution: 'resolved' | 'dismissed',
  token: string | null,
) {
  return apiFetch<{ ok: boolean }>(
    `/ops/review/${id}/resolve`,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-review-${id}`) },
      body: JSON.stringify({ resolution }),
    },
    token,
  );
}
