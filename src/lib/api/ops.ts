import { apiFetch } from '@/lib/api/client';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@/lib/api/idempotency';

export type ImportJob = {
  id: string;
  job_type: string;
  status: string;
  total_rows: number;
  inserted_rows: number;
  failed_rows: number;
  created_at: string;
  error_summary: string | null;
};

export async function fetchOpsBootstrap() {
  return apiFetch<{
    ok: boolean;
    user: { userId: string; email: string | null };
    roles: string[];
    references: Record<string, Array<{ id: string; name: string; code?: string }>>;
    importHistory: ImportJob[];
  }>('/ops/bootstrap');
}

export async function fetchImportHistory() {
  return apiFetch<{ ok: boolean; jobs: ImportJob[] }>('/ops/imports/history');
}

export async function submitCsvImport(kind: 'teams' | 'players' | 'schedules' | 'events', rows: Record<string, string>[]) {
  return apiFetch<{ ok: boolean; summary: ImportJob }>(`/ops/imports/${kind}`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-${kind}`) },
    body: JSON.stringify({ rows }),
  });
}

export async function parseEventImage(imageBase64: string, mimeType: string) {
  return apiFetch<{
    ok: boolean;
    data: { title: string; location: string; date: string; leagueId: string };
  }>('/ops/event/parse', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType }),
  });
}

export async function parsePotgImage(imageBase64: string, mimeType: string) {
  return apiFetch<{
    ok: boolean;
    data: { playerName: string; team: string; pts: number; rebs: number; assts: number; gameResult: string };
  }>('/ops/potg/parse', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType }),
  });
}

export async function submitPotgRecord(payload: {
  playerName: string; team: string; pts: number; rebs: number; assts: number;
  gameResult: string; leagueId: string; date: string; imageUrl?: string;
}) {
  return apiFetch<{ ok: boolean; jobId: string; matched: boolean }>('/ops/potg/submit', {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey('ops-potg') },
    body: JSON.stringify(payload),
  });
}

export async function uploadStoreMedia(payload: {
  title: string;
  price: number;
  category: string;
  publishStatus: 'draft' | 'published';
  sale?: boolean;
  imageUrl: string;
  leagueId?: string | null;
}) {
  return apiFetch<{ ok: boolean; productId: string; mediaAssetId: string }>('/ops/store/media', {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey('ops-store-media') },
    body: JSON.stringify(payload),
  });
}

export async function fetchOpsList(entity: 'teams' | 'players' | 'products' | 'events') {
  return apiFetch<{ ok: boolean; data: unknown[] }>(`/ops/list/${entity}`);
}

// ── Media Editor (Admin) ──────────────────────────────────────────────────
// Super-admin CRUD over media_publications (covers drafts + archived rows
// that the public /api/public/media feed intentionally hides).

export type MediaPublicationStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export type OpsMediaPublication = {
  id: string;
  mediaAssetId: string;
  surface: string;
  title: string;
  subtitle: string | null;
  status: MediaPublicationStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  sortAt: string | null;
  sortOrder: number | null;
  leagueId: string | null;
  leagueCode: string | null;
  leagueName: string | null;
  type: string;
  thumbnail: string;
  createdAt: string | null;
  pinnedAt: string | null;
  needsReview: boolean;
  parserConfidence: number | null;
};

export type OpsStaleMedia = {
  id: string;
  title: string;
  surface: string;
  status: string;
  thumbnail: string;
  createdAt: string | null;
};

export type OpsMediaListFilters = {
  status?: MediaPublicationStatus | 'all';
  surface?: string | 'all';
  leagueId?: string;
  needsReview?: boolean;
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'sort_order';
  limit?: number;
};

export async function fetchOpsMediaList(filters: OpsMediaListFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.surface && filters.surface !== 'all') params.set('surface', filters.surface);
  if (filters.leagueId) params.set('leagueId', filters.leagueId);
  if (filters.needsReview) params.set('needsReview', 'true');
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  const suffix = qs.length > 0 ? `?${qs}` : '';
  return apiFetch<{ ok: boolean; data: OpsMediaPublication[] }>(`/ops/list/media${suffix}`);
}

export async function patchOpsMediaPublication(
  id: string,
  payload: {
    title?: string;
    subtitle?: string | null;
    status?: MediaPublicationStatus;
    leagueId?: string | null;
    sortAt?: string;
  },
) {
  return apiFetch<{ ok: boolean; data: Record<string, unknown> }>(
    `/ops/media/publications/${id}`,
    {
      method: 'PATCH',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-media-patch-${id}`) },
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteOpsMediaPublication(id: string) {
  return apiFetch<{ ok: boolean; data: Record<string, unknown> }>(
    `/ops/media/publications/${id}`,
    {
      method: 'DELETE',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-media-delete-${id}`) },
    },
  );
}

export async function updateOpsMediaPublicationOrder(items: Array<{ id: string; sortOrder: number }>) {
  return apiFetch<{ ok: boolean; updated: number }>('/ops/media/publications/order', {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey('ops-media-order-save') },
    body: JSON.stringify({ items }),
  });
}

export async function patchOpsEntity(entity: 'teams' | 'players' | 'products' | 'events' | 'schedules', id: string, payload: Record<string, unknown>) {
  return apiFetch<{ ok: boolean; data: unknown }>(`/ops/${entity}/${id}`, {
    method: 'PATCH',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-patch-${entity}-${id}`) },
    body: JSON.stringify(payload),
  });
}

export async function deleteOpsEntity(entity: 'teams' | 'players' | 'products' | 'events', id: string) {
  return apiFetch<{ ok: boolean; data: unknown }>(`/ops/${entity}/${id}`, {
    method: 'DELETE',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-delete-${entity}-${id}`) },
  });
}

export async function submitScoresImport(rows: Record<string, string>[]) {
  return apiFetch<{ ok: boolean; inserted: number; failed: number; errors: string[] }>('/ops/scores/import', {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey('ops-scores-csv') },
    body: JSON.stringify({ rows }),
  });
}

// ── manualOpsAction — routes to real schema-correct endpoints ─────────────
// The scaffold /ops/manual/:kind/:action route has been deleted from the worker
// (it had schema drift: products.publish_status, products.inventory_qty, etc.).
// This function keeps the same call signature for Ops.tsx but routes each
// action to the correct real backend path.
export async function manualOpsAction(
  kind: 'team' | 'player' | 'schedule' | 'event' | 'store',
  action: 'create' | 'delete' | 'suspend' | 'batch_create',
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const idem = (tag: string) => ({ [IDEMPOTENCY_HEADER]: createIdempotencyKey(tag) });

  // ── Teams ──────────────────────────────────────────────────────────────
  if (kind === 'team') {
    if (action === 'create') {
      return apiFetch('/ops/imports/teams', {
        method: 'POST', ...idem('manual-team-create'),
        body: JSON.stringify({ rows: [{ name: payload.name, leagueId: payload.leagueId, seasonId: payload.seasonId, division: payload.division }] }),
      });
    }
    if (action === 'delete') {
      return apiFetch(`/ops/teams/${payload.id}`, { method: 'DELETE', ...idem(`manual-team-delete-${payload.id}`) });
    }
  }

  // ── Players ────────────────────────────────────────────────────────────
  if (kind === 'player') {
    if (action === 'create') {
      return apiFetch('/ops/imports/players', {
        method: 'POST', ...idem('manual-player-create'),
        body: JSON.stringify({ rows: [{ userId: payload.userId, teamId: payload.teamId, leagueId: payload.leagueId, jerseyNumber: payload.jerseyNumber, position: payload.position }] }),
      });
    }
    if (action === 'suspend') {
      return apiFetch(`/ops/players/${payload.id}`, {
        method: 'PATCH', ...idem(`manual-player-suspend-${payload.id}`),
        body: JSON.stringify({ is_suspended: true }),
      });
    }
    if (action === 'delete') {
      return apiFetch(`/ops/players/${payload.id}`, { method: 'DELETE', ...idem(`manual-player-delete-${payload.id}`) });
    }
  }

  // ── Schedules ──────────────────────────────────────────────────────────
  if (kind === 'schedule') {
    if (action === 'create') {
      return apiFetch('/ops/imports/schedules', {
        method: 'POST', ...idem('manual-schedule-create'),
        body: JSON.stringify({ rows: [{ leagueId: payload.leagueId, seasonId: payload.seasonId, startsAt: payload.startsAt, endsAt: payload.endsAt }] }),
      });
    }
    if (action === 'delete') {
      return apiFetch(`/ops/schedules/${payload.id}`, { method: 'DELETE', ...idem(`manual-schedule-delete-${payload.id}`) });
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────
  if (kind === 'event') {
    if (action === 'create') {
      return apiFetch('/ops/imports/events', {
        method: 'POST', ...idem('manual-event-create'),
        body: JSON.stringify({ rows: [{ title: payload.title, location: payload.location, date: payload.date, leagueId: payload.leagueId }] }),
      });
    }
    if (action === 'delete') {
      return apiFetch(`/ops/events/${payload.id}`, { method: 'DELETE', ...idem(`manual-event-delete-${payload.id}`) });
    }
  }

  // ── Store ──────────────────────────────────────────────────────────────
  if (kind === 'store') {
    if (action === 'batch_create') {
      return apiFetch('/ops/products/batch', {
        method: 'POST', ...idem('manual-store-batch'),
        body: JSON.stringify({ items: payload.items }),
      });
    }
    if (action === 'suspend') {
      return apiFetch(`/ops/products/${payload.id}`, {
        method: 'PATCH', ...idem(`manual-store-suspend-${payload.id}`),
        body: JSON.stringify({ status: 'archived' }),
      });
    }
    if (action === 'delete') {
      return apiFetch(`/ops/products/${payload.id}`, { method: 'DELETE', ...idem(`manual-store-delete-${payload.id}`) });
    }
  }

  return { ok: false, error: `no_route_for_${kind}_${action}` };
}

// ── Generic media publish ─────────────────────────────────────────────────
// Writes media_assets + media_publications for any surface without creating a
// store product. Used by the Events tab (surface='event') and ad-hoc uploads.
export async function publishMedia(payload: {
  title: string;
  surface: 'potg' | 'event' | 'store' | 'media_feed';
  leagueId?: string | null;
  date?: string;
  imageUrl: string;
  publishStatus?: 'draft' | 'published';
}) {
  return apiFetch<{ ok: boolean; mediaAssetId: string; publicationId: string }>(
    '/ops/media/publish',
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-media-publish-${payload.surface}-${payload.title}`) },
      body: JSON.stringify(payload),
    }
  );
}

// ── Canonical ingest API ──────────────────────────────────────────────────

export type IngestKind = 'potg' | 'store' | 'event' | 'generic';

export type IngestJob = {
  id: string;
  kind: IngestKind;
  state: string;
  confidence: number | null;
  asset_path: string;
  payload: Record<string, unknown>;
  parse_result: Record<string, unknown> | null;
  media_asset_id: string | null;
  publication_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

/** Step 1 — get a signed upload URL for the private media-ingest bucket. */
export async function ingestPresign(kind: IngestKind, filename: string) {
  return apiFetch<{ ok: boolean; signedUrl: string; token: string; objectPath: string }>(
    '/ops/ingest/presign',
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ingest-presign-${kind}`) },
      body: JSON.stringify({ kind, filename }),
    }
  );
}

/** Step 2 — submit metadata after binary upload completes. */
export async function ingestSubmit(payload: {
  kind: IngestKind;
  objectPath: string;
  publicUrl: string;
  title: string;
  leagueId?: string | null;
  publishStatus?: 'draft' | 'published';
  idempotencyKey?: string;
  meta?: Record<string, unknown>;
}) {
  return apiFetch<{
    ok: boolean;
    jobId: string;
    state: string;
    mediaAssetId: string;
    publicationId: string;
    deduplicated?: boolean;
  }>('/ops/ingest/submit', {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: payload.idempotencyKey ?? createIdempotencyKey(`ingest-submit-${payload.kind}`) },
    body: JSON.stringify(payload),
  });
}

/** Poll job status. */
export async function ingestStatus(jobId: string) {
  return apiFetch<{ ok: boolean; job: IngestJob }>(`/ops/ingest/${jobId}`);
}

/** Approve a projected/needs_review job → publishes to media_publications. */
export async function ingestApprove(jobId: string) {
  return apiFetch<{ ok: boolean; jobId: string; publicationId: string; publishedAt: string }>(
    `/ops/ingest/${jobId}/approve`,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ingest-approve-${jobId}`) },
      body: JSON.stringify({}),
    }
  );
}

/** Reject a job → archives publication, marks job failed. Replayable. */
export async function ingestReject(jobId: string, reason?: string) {
  return apiFetch<{ ok: boolean; jobId: string; state: string }>(
    `/ops/ingest/${jobId}/reject`,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ingest-reject-${jobId}`) },
      body: JSON.stringify({ reason }),
    }
  );
}

/** Replay a failed or needs_review job from scratch. */
export async function ingestReplay(jobId: string) {
  return apiFetch<{ ok: boolean; jobId: string; state: string }>(
    `/ops/ingest/${jobId}/replay`,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ingest-replay-${jobId}`) },
      body: JSON.stringify({}),
    }
  );
}

// ── Media Command Center — new endpoints ─────────────────────────────────

/** Bulk archive up to 100 media publications (all-or-nothing; pinned items rejected). */
export async function bulkArchiveOpsMedia(ids: string[]) {
  return apiFetch<{ ok: boolean; archived: number; ids: string[]; error?: string; invalidIds?: string[] }>(
    '/ops/media/bulk-archive',
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-media-bulk-archive-${ids.sort().join('-').slice(0, 64)}`) },
      body: JSON.stringify({ ids }),
    }
  );
}

/** Pin a media publication (excludes from stale cleanup; blocks archive until unpinned). */
export async function pinOpsMediaPublication(id: string) {
  return apiFetch<{ ok: boolean; data: { id: string; pinnedAt: string } }>(
    `/ops/media/publications/${id}/pin`,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-media-pin-${id}`) },
      body: JSON.stringify({ pin: true }),
    }
  );
}

/** Unpin a media publication. */
export async function unpinOpsMediaPublication(id: string) {
  return apiFetch<{ ok: boolean; data: { id: string; pinnedAt: null } }>(
    `/ops/media/publications/${id}/pin`,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-media-unpin-${id}`) },
      body: JSON.stringify({ pin: false }),
    }
  );
}

/** Restore an archived media publication back to draft. */
export async function restoreOpsMediaPublication(id: string) {
  return apiFetch<{ ok: boolean; data: { id: string; status: string } }>(
    `/ops/media/publications/${id}/restore`,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-media-restore-${id}`) },
      body: JSON.stringify({}),
    }
  );
}

/** List stale unpinned media older than `days` days (default 30). */
export async function fetchOpsStaleMedia(days = 30) {
  return apiFetch<{ ok: boolean; data: OpsStaleMedia[]; days: number }>(
    `/ops/media/stale?days=${days}`
  );
}

/** Archive a confirmed set of stale media IDs. Server re-validates and skips pinned items. */
export async function archiveOpsStaleMedia(ids: string[], idempotencyKey: string) {
  return apiFetch<{ ok: boolean; archived: number }>(
    '/ops/media/stale/archive',
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      body: JSON.stringify({ ids }),
    }
  );
}
