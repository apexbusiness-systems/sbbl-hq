/**
 * src/lib/api/stream.ts
 *
 * Stream management API — admin config, live status, access overrides,
 * session history, and revenue reporting.
 *
 * Routes required in worker (see STREAM_OPS_WORKER_PATCH.md):
 *   GET  /api/streams/status            → public, poll for isLive + viewerCount
 *   GET  /ops/streams/config            → league_admin: read stream config
 *   POST /ops/streams/config            → super_admin:  update stream URL / title / source
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
  /** Stream URL (historically named collectionId for Switcher Studio; now repurposed as a direct stream/embed URL). */
  collectionId: string;
  title: string;              // broadcast title shown in Ops panel
  source: 'main' | 'backup' | 'test';
  isLive: boolean;
  viewerCount: number;
  updatedAt?: string;
}

export interface PublicStreamStatus {
  ok: boolean;
  isLive: boolean;
  title: string;
  viewerCount: number;
}

export interface StreamPlaybackSession {
  ok: boolean;
  playback: {
    type: 'url';
    url: string;
    expiresAt: string;
    heartbeatIntervalSec: number;
  };
  session: {
    id: string;
    gameId: string;
  };
}

export interface StreamComment {
  id: string;
  message: string;
  createdAt: string;
  userId: string;
  userDisplayName?: string;
  status?: 'active' | 'hidden';
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
  return apiFetch<PublicStreamStatus>(
    `/api/streams/status${qs}`,
  );
}

export async function createPlaybackSession(
  gameId: string,
  sessionKey: string,
  token: string | null,
) {
  return apiFetch<StreamPlaybackSession>(
    `/api/streams/${encodeURIComponent(gameId)}/session`,
    {
      method: 'POST',
      body: JSON.stringify({ sessionKey }),
    },
    token,
  );
}

export async function heartbeatPlaybackSession(
  gameId: string,
  sessionId: string,
  token: string | null,
) {
  return apiFetch<{ ok: boolean; sessionId: string; expiresAt: string }>(
    `/api/streams/${encodeURIComponent(gameId)}/session/heartbeat`,
    {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    },
    token,
  );
}

export async function endPlaybackSession(
  gameId: string,
  sessionId: string,
  token: string | null,
) {
  return apiFetch<{ ok: boolean; ended: boolean }>(
    `/api/streams/${encodeURIComponent(gameId)}/session/end`,
    {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    },
    token,
  );
}

export async function fetchStreamComments(
  gameId: string,
  limit = 40,
  options: { includeHidden?: boolean; token?: string | null } = {},
) {
  const params = new URLSearchParams({
    limit: String(Math.min(100, Math.max(1, limit))),
  });
  if (options.includeHidden) params.set('includeHidden', '1');
  return apiFetch<{ ok: boolean; comments: StreamComment[] }>(
    `/api/streams/${encodeURIComponent(gameId)}/comments?${params.toString()}`,
    {},
    options.token,
  );
}

export async function postStreamComment(gameId: string, message: string, token: string | null) {
  return apiFetch<{ ok: boolean; comment: StreamComment }>(
    `/api/streams/${encodeURIComponent(gameId)}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ message }),
    },
    token,
  );
}

export async function moderateStreamComment(
  gameId: string,
  commentId: string,
  action: 'hide' | 'restore',
  token: string | null,
) {
  return apiFetch<{ ok: boolean; commentId: string; status: 'active' | 'hidden' }>(
    `/ops/streams/${encodeURIComponent(gameId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-comment-${commentId}-${action}`) },
      body: JSON.stringify({ action }),
    },
    token,
  );
}

export async function resetStreamReactions(gameId: string, token: string | null) {
  return apiFetch<{ ok: boolean; gameId: string; reset: true }>(
    `/ops/streams/${encodeURIComponent(gameId)}/reactions/reset`,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-reactions-reset-${gameId}`) },
      body: JSON.stringify({}),
    },
    token,
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
export async function setStreamLive(
  isLive: boolean,
  token: string | null,
) {
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

// ── Super Admin Comp Codes ───────────────────────────────────────────────────

export interface CompCode {
  code: string;
  gameId: string;
  usedBy?: string | null;
  usedAt?: string | null;
  expiresAt: string;
  note?: string | null;
  createdAt: string;
}

/**
 * Generate a super-admin complimentary access code. Unlimited per game.
 * Redeemer gets a free playback session with the same rules as PPV
 * (IP-locked, one-device, 6-hour session cap).
 */
export async function generateCompCode(
  gameId: string,
  options: { note?: string; expiresInHours?: number } = {},
  token: string | null,
) {
  return apiFetch<{ ok: boolean; code: string; gameId: string; expiresAt: string; note?: string | null; createdAt: string }>(
    '/ops/streams/comp-code',
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-comp-code-${gameId}-${Date.now()}`) },
      body: JSON.stringify({
        gameId,
        note: options.note ?? null,
        expiresInHours: options.expiresInHours ?? 24,
      }),
    },
    token,
  );
}

/** List recent comp codes for ops tracking (50 most recent). */
export async function listCompCodes(token: string | null) {
  return apiFetch<{ ok: boolean; codes: CompCode[] }>(
    '/ops/streams/comp-code',
    {},
    token,
  );
}

/**
 * Redeem an access code (comp code or regular invite). Only the code is
 * required — the server derives the gameId from the code lookup.
 */
export async function redeemAccessCode(
  code: string,
  options: { captchaToken?: string } = {},
  token: string | null,
) {
  return apiFetch<{ ok: boolean; granted: boolean; idempotent?: boolean }>(
    '/api/invite/redeem',
    {
      method: 'POST',
      body: JSON.stringify({
        code: code.trim(),
        captchaToken: options.captchaToken,
      }),
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
