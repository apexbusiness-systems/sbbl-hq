import { apiFetch } from '@/lib/api/client';
import type { MediaLayoutResponse } from '../types/types';

export async function getMediaLayout(sectionSlug: string) {
  const response = await apiFetch<{ ok: boolean; data: MediaLayoutResponse }>(`/ops/media-layout/${sectionSlug}`);
  return response.data;
}
