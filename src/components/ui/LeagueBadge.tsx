import type { LeagueId } from '@/types';
import { getLeagueConfig } from '@/lib/leagues';
import { useState } from 'react';

export const LeagueBadge = ({ leagueId, size = 'sm', showLogo = true }: { leagueId: LeagueId; size?: 'sm' | 'md'; showLogo?: boolean }) => {
  const league = getLeagueConfig(leagueId);
  const [logoFailed, setLogoFailed] = useState(false);
  const imgSize = size === 'md' ? 20 : 16;

  return (
    <span className={`${league.badgeClass} ${size === 'md' ? 'text-sm px-3 py-1' : ''}`}>
      {showLogo && !logoFailed && (
        <img
          src={league.logo}
          alt={league.logoAlt}
          width={imgSize}
          height={imgSize}
          className="inline-block flex-shrink-0"
          style={{ aspectRatio: '1/1' }}
          onError={() => setLogoFailed(true)}
        />
      )}
      <span>{league.shortName}</span>
    </span>
  );
};
