import { LeagueId } from '@/types';
import { leagues } from '@/data/mock';

export const LeagueBadge = ({ leagueId, size = 'sm' }: { leagueId: LeagueId; size?: 'sm' | 'md' }) => {
  const league = leagues.find(l => l.id === leagueId);
  const cls = leagueId === 'sbbl' ? 'league-badge-sbbl' : leagueId === 'wbl' ? 'league-badge-wbl' : 'league-badge-tgifbl';
  return (
    <span className={`${cls} ${size === 'md' ? 'text-sm px-3 py-1' : ''}`}>
      {league?.shortName}
    </span>
  );
};
