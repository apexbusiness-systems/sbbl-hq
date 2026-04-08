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
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-${kind}`, { rows }) },
    body: JSON.stringify({ rows }),
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
  imageUpload?: { base64: string; mimeType: string; fileName?: string };
}) {
  return apiFetch<{ ok: boolean; jobId: string; matched: boolean }>('/ops/potg/submit', {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey('ops-potg', payload) },
    body: JSON.stringify(payload),
  });
}

export async function uploadStoreMedia(payload: {
  title: string;
  price: number;
  category: string;
  publishStatus: 'draft' | 'published';
  sale?: boolean;
  imageUrl?: string;
  imageUpload?: { base64: string; mimeType: string; fileName?: string };
  leagueId?: string | null;
}) {
  return apiFetch<{ ok: boolean; jobId: string; productId: string | null; mediaAssetId: string; publicationId: string | null }>('/ops/store/media', {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey('ops-store-media', payload) },
    body: JSON.stringify(payload),
  });
}

export async function fetchOpsList(entity: 'teams' | 'players' | 'products' | 'events') {
  return apiFetch<{ ok: boolean; data: unknown[] }>(`/ops/list/${entity}`);
}

export async function patchOpsEntity(entity: 'teams' | 'players' | 'products' | 'events' | 'schedules', id: string, payload: Record<string, unknown>) {
  return apiFetch<{ ok: boolean; data: unknown }>(`/ops/${entity}/${id}`, {
    method: 'PATCH',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-patch-${entity}-${id}`, payload) },
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
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey('ops-scores-csv', { rows }) },
    body: JSON.stringify({ rows }),
  });
}

export async function manualOpsAction(
  kind: 'team' | 'player' | 'schedule' | 'event' | 'store',
  action: 'create' | 'delete' | 'suspend' | 'batch_create',
  payload: Record<string, unknown>,
) {
  return apiFetch<{ ok: boolean; error?: string }>(`/ops/manual/${kind}/${action}`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-manual-${kind}-${action}`, payload) },
    body: JSON.stringify(payload),
  });
}

// â”€â”€ Ingest Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type IngestJob = {
  id: string;
  source: string;
  state: string;
  media_asset_id: string | null;
  publication_id: string | null;
  payload: Record<string, unknown>;
  error_detail: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
};

export async function getIngestJobStatus(jobId: string) {
  return apiFetch<{ ok: boolean; job: IngestJob }>(`/ops/ingest/${jobId}`);
}

export async function approveIngestJob(jobId: string) {
  return apiFetch<{ ok: boolean; state: string }>(`/ops/ingest/${jobId}/approve`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-ingest-approve-${jobId}`, { action: 'approve' }) },
  });
}

export async function rejectIngestJob(jobId: string) {
  return apiFetch<{ ok: boolean; state: string }>(`/ops/ingest/${jobId}/reject`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-ingest-reject-${jobId}`, { action: 'reject' }) },
  });
}

export async function replayIngestJob(jobId: string) {
  return apiFetch<{ ok: boolean; newJobId: string; state: string }>(`/ops/ingest/${jobId}/replay`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(`ops-ingest-replay-${jobId}`, { action: 'replay' }) },
  });
}



