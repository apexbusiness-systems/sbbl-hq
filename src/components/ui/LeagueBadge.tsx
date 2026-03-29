import { LeagueId } from '@/types';
import { getLeagueConfig } from '@/lib/leagues';

export const LeagueBadge = ({ leagueId, size = 'sm' }: { leagueId: LeagueId; size?: 'sm' | 'md' }) => {
  const league = getLeagueConfig(leagueId);
  const cls = leagueId === 'sbbl' ? 'league-badge-sbbl' : leagueId === 'wbl' ? 'league-badge-wbl' : 'league-badge-tgifbl';
  return (
    <span className={`${cls} ${size === 'md' ? 'text-sm px-3 py-1' : ''}`}>
      {league.shortName}
    </span>
  );
};
