import { apiFetch } from '@/lib/api/client';

export type HighlightKind = 'manual' | 'auto_score' | 'auto_cheer';

export type Highlight = {
  id: string;
  game_id: string;
  kind: HighlightKind;
  period: number | null;
  clock_seconds: number | null;
  home_score: number | null;
  away_score: number | null;
  player_id: string | null;
  title: string | null;
  description: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  occurred_at: string;
  created_at: string;
};

// Public
export async function fetchHighlights(gameId: string) {
  return apiFetch<{ ok: boolean; data: Highlight[] }>(
    `/api/public/highlights/${encodeURIComponent(gameId)}`,
  );
}

// Admin
export async function markHighlight(input: {
  game_id: string;
  title?: string;
  description?: string;
  player_id?: string;
  media_url?: string;
}) {
  return apiFetch<{ ok: boolean; highlight: Highlight }>(
    '/api/ops/highlights/mark',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function updateHighlight(
  id: string,
  patch: Partial<Pick<Highlight, 'title' | 'description' | 'media_url' | 'thumbnail_url'>>,
) {
  return apiFetch<{ ok: boolean; highlight: Highlight }>(
    `/api/ops/highlights/${encodeURIComponent(id)}`,
    { method: 'POST', body: JSON.stringify(patch) },
  );
}

export async function deleteHighlight(id: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/ops/highlights/${encodeURIComponent(id)}/delete`,
    { method: 'POST', body: '{}' },
  );
}
