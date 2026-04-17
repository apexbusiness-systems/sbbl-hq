import { apiFetch } from '@/lib/api/client';

export type Sponsor = {
  id: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  click_url: string | null;
  background_color: string | null;
  text_color: string | null;
  weight: number;
  active: boolean;
  league_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function fetchPublicSponsors(leagueId?: string) {
  const params = leagueId ? `?leagueId=${encodeURIComponent(leagueId)}` : '';
  return apiFetch<{ ok: boolean; data: Sponsor[] }>(
    `/api/public/sponsors${params}`,
  );
}

export async function trackSponsorEvent(
  sponsorId: string,
  opts: { kind: 'impression' | 'click'; game_id?: string },
) {
  return apiFetch<{ ok: boolean }>(
    `/api/public/sponsors/${sponsorId}/track`,
    { method: 'POST', body: JSON.stringify(opts) },
  );
}

export async function adminListSponsors() {
  return apiFetch<{ ok: boolean; data: Sponsor[] }>('/api/ops/sponsors');
}

export async function adminCreateSponsor(input: Partial<Sponsor>) {
  return apiFetch<{ ok: boolean; sponsor: Sponsor }>('/api/ops/sponsors', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function adminUpdateSponsor(id: string, input: Partial<Sponsor>) {
  return apiFetch<{ ok: boolean; sponsor: Sponsor }>(
    `/api/ops/sponsors/${id}`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function adminDeleteSponsor(id: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/ops/sponsors/${id}/delete`,
    { method: 'POST', body: '{}' },
  );
}
