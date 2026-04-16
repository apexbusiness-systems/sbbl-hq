import type { LeagueId, PlayerOfTheGame } from '@/types';

/**
 * Shape of a row returned by GET /api/public/potg. Corresponds to the
 * `media_publications` table joined with its `render_payload` metadata.
 *
 * The Worker writes `render_payload` with keys
 * {playerName, team, pts, rebs, assts, gameResult, leagueId, thumbnail, date}
 * when a POTG submission is accepted (see handleSubmitPotg in
 * src/worker/index.ts — the `potgMeta` object).
 */
type PotgPublicationRow = {
  id: string;
  title?: string | null;
  surface?: string | null;
  league_id?: string | null;
  status?: string | null;
  render_payload?: Record<string, unknown> | null;
  published_at?: string | null;
  created_at?: string | null;
};

function toLeagueId(input: unknown): LeagueId {
  const raw = String(input ?? '').toLowerCase();
  if (raw === 'wbl') return 'wbl';
  if (raw === 'tgifbl' || raw === 'tgif') return 'tgifbl';
  return 'sbbl';
}

/**
 * Map `/api/public/potg` rows into the PlayerOfTheGame shape consumed by
 * PotgCard. This is the ONLY place the UI turns media_publications into a
 * POTG card — keeping this mapping centralized prevents drift when the
 * publication schema evolves.
 */
export function mapPotgPublicationRows(
  rows: ReadonlyArray<Record<string, unknown>> | null | undefined,
): PlayerOfTheGame[] {
  if (!Array.isArray(rows)) return [];
  const out: PlayerOfTheGame[] = [];
  for (const raw of rows) {
    const row = raw as PotgPublicationRow;
    const payload = (row.render_payload ?? {}) as Record<string, unknown>;
    const leagueId = toLeagueId(payload.leagueId ?? row.league_id);
    const playerName = String(payload.playerName ?? '').trim();
    if (!playerName) continue;
    out.push({
      id: String(row.id),
      leagueId,
      playerName,
      team: String(payload.team ?? ''),
      pts: Number(payload.pts ?? 0),
      rebs: Number(payload.rebs ?? 0),
      assts: Number(payload.assts ?? 0),
      gameResult: String(payload.gameResult ?? ''),
      date: String(
        payload.date ??
          row.published_at ??
          row.created_at ??
          '',
      ),
      image: payload.thumbnail ? String(payload.thumbnail) : undefined,
    });
  }
  return out;
}
