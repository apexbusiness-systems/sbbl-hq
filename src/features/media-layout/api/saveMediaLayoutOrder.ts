import { apiFetch } from '@/lib/api/client';
import type { MediaLayoutResponse } from '../types/types';
import { normalizeOrderedIds } from '../lib/hash';

export async function saveMediaLayoutOrder(payload: {
  sectionSlug: string;
  orderedMediaAssetIds: string[];
  idempotencyKey: string;
  expectedSectionUpdatedAt: string;
}) {
  const normalized = normalizeOrderedIds(payload.orderedMediaAssetIds);
  return apiFetch<{ ok: boolean; data: MediaLayoutResponse }>(`/ops/media-layout/${payload.sectionSlug}/save`, {
    method: 'POST',
    body: JSON.stringify({
      orderedMediaAssetIds: normalized,
      idempotencyKey: payload.idempotencyKey,
      expectedSectionUpdatedAt: payload.expectedSectionUpdatedAt,
    }),
  });
}
