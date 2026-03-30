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
  gameResult: string; leagueId: string; date: string;
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
  imageUrl: string;
  leagueId?: string | null;
}) {
  return apiFetch<{ ok: boolean; productId: string; mediaAssetId: string }>('/ops/store/media', {
    method: 'POST',
    headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey('ops-store-media') },
    body: JSON.stringify(payload),
  });
}
