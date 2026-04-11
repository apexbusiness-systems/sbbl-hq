import { apiFetch } from '@/lib/api/client';
import type { MediaLayoutResponse } from '../types/types';

export async function resetMediaLayout(payload: {
  sectionSlug: string;
  idempotencyKey: string;
  expectedSectionUpdatedAt: string;
}) {
  return apiFetch<{ ok: boolean; data: MediaLayoutResponse }>(`/ops/media-layout/${payload.sectionSlug}/reset`, {
    method: 'POST',
    body: JSON.stringify({
      idempotencyKey: payload.idempotencyKey,
      expectedSectionUpdatedAt: payload.expectedSectionUpdatedAt,
    }),
  });
}
