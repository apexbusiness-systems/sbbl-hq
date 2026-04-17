import { apiFetch } from '@/lib/api/client';

export type DigestSection = {
  title: string;
  items: Array<{ label: string; value?: string }>;
};

export type Digest = {
  id: string;
  league_id: string | null;
  week_start: string;
  week_end: string;
  headline: string;
  summary: string;
  sections: DigestSection[];
  model: string;
  generated_at: string;
};

export async function fetchDigest(leagueCode = 'SBBL') {
  return apiFetch<{ ok: boolean; digest: Digest }>(
    `/api/public/digest?league=${encodeURIComponent(leagueCode)}`,
  );
}

export async function regenerateDigest(leagueCode: string) {
  return apiFetch<{ ok: boolean; digest: Digest }>(
    `/api/ops/digest/${encodeURIComponent(leagueCode)}/regenerate`,
    { method: 'POST', body: '{}' },
  );
}

export async function fetchObsCommand() {
  return apiFetch<{ ok: boolean; data: Array<Record<string, unknown>> }>(
    '/api/ops/obs/commands',
  );
}

export async function enqueueObsCommand(input: {
  kind: string;
  payload?: Record<string, unknown>;
  game_id?: string;
}) {
  return apiFetch<{ ok: boolean; command: Record<string, unknown> }>(
    '/api/ops/obs/commands',
    { method: 'POST', body: JSON.stringify(input) },
  );
}
