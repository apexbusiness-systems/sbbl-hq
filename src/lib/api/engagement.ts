import { apiFetch } from '@/lib/api/client';

export type PollOption = { id: string; label: string };
export type PollKind = 'poll' | 'prediction' | 'trivia';
export type PollStatus = 'draft' | 'open' | 'locked' | 'closed';

export type Poll = {
  id: string;
  game_id: string | null;
  kind: PollKind;
  question: string;
  options: PollOption[];
  status: PollStatus;
  points_award: number;
  closes_at: string | null;
  created_at: string;
  correct_option_id?: string | null;
};

export type PollResults = {
  ok: boolean;
  poll: Poll;
  total_votes: number;
  tallies: Record<string, number>;
};

export type GamificationRow = {
  user_id: string;
  display_name: string;
  total_points: number;
  correct_count: number;
};

export type WatchParty = {
  id: string;
  name: string;
  game_id: string;
  host_user_id: string;
  max_members: number;
  status: 'open' | 'closed';
  created_at: string;
  join_code?: string;
};

// ── Public reads ─────────────────────────────────────────────────────
export async function fetchPolls(gameId?: string) {
  const params = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
  return apiFetch<{ ok: boolean; data: Poll[] }>(
    `/api/public/engagement/polls${params}`,
  );
}

export async function fetchPollResults(pollId: string) {
  return apiFetch<PollResults>(`/api/public/engagement/polls/${pollId}/results`);
}

export async function fetchEngagementLeaderboard() {
  return apiFetch<{ ok: boolean; data: GamificationRow[] }>(
    '/api/public/engagement/leaderboard',
  );
}

// ── Authenticated ────────────────────────────────────────────────────
export async function castVote(pollId: string, optionId: string) {
  return apiFetch<{ ok: boolean }>(`/api/engagement/polls/${pollId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ option_id: optionId }),
  });
}

export async function fetchMyPoints() {
  return apiFetch<{
    ok: boolean;
    total: number;
    history: Array<{
      id: string;
      reason: string;
      points: number;
      game_id: string | null;
      poll_id: string | null;
      created_at: string;
    }>;
  }>('/api/engagement/me/points');
}

export async function createWatchParty(gameId: string, name: string, maxMembers = 25) {
  return apiFetch<{ ok: boolean; party: WatchParty }>(
    '/api/engagement/watch-parties',
    {
      method: 'POST',
      body: JSON.stringify({ game_id: gameId, name, max_members: maxMembers }),
    },
  );
}

export async function listWatchParties(gameId?: string) {
  const params = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
  return apiFetch<{ ok: boolean; data: WatchParty[] }>(
    `/api/engagement/watch-parties${params}`,
  );
}

export async function joinWatchParty(partyId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/engagement/watch-parties/${partyId}/join`,
    { method: 'POST', body: '{}' },
  );
}

export async function joinWatchPartyByCode(code: string) {
  return apiFetch<{ ok: boolean; party_id: string }>(
    '/api/engagement/watch-parties/join-by-code',
    { method: 'POST', body: JSON.stringify({ code }) },
  );
}

// ── Admin ───────────────────────────────────────────────────────────
export async function createPoll(input: {
  game_id?: string | null;
  kind: PollKind;
  question: string;
  options: PollOption[];
  correct_option_id?: string | null;
  points_award?: number;
  closes_at?: string | null;
  status?: 'draft' | 'open';
}) {
  return apiFetch<{ ok: boolean; poll: Poll }>(
    '/api/ops/engagement/polls',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function updatePoll(
  pollId: string,
  patch: Partial<Pick<Poll, 'status' | 'correct_option_id' | 'points_award' | 'closes_at'>>,
) {
  return apiFetch<{ ok: boolean; poll: Poll }>(
    `/api/ops/engagement/polls/${pollId}`,
    { method: 'POST', body: JSON.stringify(patch) },
  );
}

export async function gradePoll(pollId: string) {
  return apiFetch<{ ok: boolean; awarded: number }>(
    `/api/ops/engagement/polls/${pollId}/grade`,
    { method: 'POST', body: '{}' },
  );
}
