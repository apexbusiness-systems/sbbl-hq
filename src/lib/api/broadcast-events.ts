import { apiFetch } from '@/lib/api/client';
import type { LivestreamBroadcastEvent, BroadcastEventStatus } from '@/types';

export interface BroadcastEventListResponse {
  ok: boolean;
  data: LivestreamBroadcastEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface BroadcastEventDetailResponse {
  ok: boolean;
  data: LivestreamBroadcastEvent;
}

export async function fetchPublicBroadcastEvents(opts: {
  status?: BroadcastEventStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<BroadcastEventListResponse> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return apiFetch<BroadcastEventListResponse>(
    `/api/public/broadcast-events${qs ? `?${qs}` : ''}`,
  );
}

export async function fetchPublicBroadcastEvent(
  slug: string,
): Promise<BroadcastEventDetailResponse> {
  return apiFetch<BroadcastEventDetailResponse>(
    `/api/public/broadcast-events/${encodeURIComponent(slug)}`,
  );
}

export async function adminListBroadcastEvents(opts: {
  limit?: number;
  offset?: number;
} = {}): Promise<BroadcastEventListResponse> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return apiFetch<BroadcastEventListResponse>(
    `/api/ops/broadcast-events${qs ? `?${qs}` : ''}`,
  );
}

export async function adminCreateBroadcastEvent(payload: {
  title: string;
  slug?: string;
  description?: string;
  scheduled_start_at?: string;
  stream_url?: string;
  embed_url?: string;
  thumbnail_url?: string;
  visibility?: 'public' | 'private' | 'unlisted';
}): Promise<BroadcastEventDetailResponse> {
  return apiFetch<BroadcastEventDetailResponse>('/api/ops/broadcast-events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateBroadcastEvent(
  id: string,
  payload: Partial<{
    title: string;
    description: string;
    scheduled_start_at: string;
    stream_url: string;
    embed_url: string;
    thumbnail_url: string;
    visibility: 'public' | 'private' | 'unlisted';
  }>,
): Promise<BroadcastEventDetailResponse> {
  return apiFetch<BroadcastEventDetailResponse>(
    `/api/ops/broadcast-events/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
}

export async function adminTransitionBroadcastStatus(
  id: string,
  status: BroadcastEventStatus,
): Promise<BroadcastEventDetailResponse> {
  return apiFetch<BroadcastEventDetailResponse>(
    `/api/ops/broadcast-events/${id}/status`,
    { method: 'POST', body: JSON.stringify({ status }) },
  );
}
