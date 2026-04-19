/**
 * Preflight API client.
 * Thin typed wrapper over /api/streams/:gameId/preflight. Callers should
 * fetch through this — never hand-roll the endpoint path, never parse
 * the response ad-hoc.
 */
import { apiFetch } from '@/lib/api/client';
import type { PreflightSnapshot } from '@/lib/preflight/types';

export async function fetchPreflightSnapshot(gameId: string): Promise<PreflightSnapshot> {
  const res = await apiFetch<PreflightSnapshot | { ok: false; error: string }>(
    `/api/streams/${encodeURIComponent(gameId)}/preflight`,
  );
  if ('ok' in res && res.ok !== true) {
    throw new Error((res as { error: string }).error || 'preflight_failed');
  }
  return res as PreflightSnapshot;
}
