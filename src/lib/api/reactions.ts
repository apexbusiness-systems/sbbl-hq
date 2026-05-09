import { apiFetch } from '@/lib/api/client';

export type ReactionKind = 'fire' | 'heart' | 'clap';

export type ReactionAggregate = {
  reaction_type: ReactionKind;
  count: number;
};

export async function fetchReactionAggregate(
  gameId: string,
  windowSeconds = 30,
): Promise<{ ok: boolean; data: ReactionAggregate[] }> {
  return apiFetch(
    `/api/public/streams/${encodeURIComponent(gameId)}/reactions/aggregate?window=${windowSeconds}`,
  );
}
