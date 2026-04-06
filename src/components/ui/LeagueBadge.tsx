import type { LeagueId } from '@/types';
import { getLeagueConfig } from '@/lib/leagues';
import { useState } from 'react';

export const LeagueBadge = ({ leagueId, size = 'sm', showLogo = true }: { leagueId: LeagueId; size?: 'sm' | 'md' | 'lg'; showLogo?: boolean }) => {
  const league = getLeagueConfig(leagueId);
  const [logoFailed, setLogoFailed] = useState(false);
  const imgSize = size === 'lg' ? 32 : size === 'md' ? 20 : 16;

  return (
    <span className={`inline-flex items-center gap-2 rounded-sm font-bold uppercase tracking-wider ${league.badgeClass} ${
      size === 'lg' ? 'text-lg px-6 py-2 border-2 border-current/20 shadow-xl shadow-current/10' :
      size === 'md' ? 'text-sm px-3 py-1 border border-current/10' :
      'text-[10px] px-1.5 py-0.5 border border-current/10'
    }`}>
      {showLogo && !logoFailed && (
        <img
          src={league.logo}
          alt={league.logoAlt}
          width={imgSize}
          height={imgSize}
          className="flex-shrink-0"
          style={{ aspectRatio: '1/1' }}
          onError={() => setLogoFailed(true)}
        />
      )}
      <span>{league.shortName}</span>
    </span>
  );
};
