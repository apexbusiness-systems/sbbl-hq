import { useEffect, useMemo, useState } from 'react';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { useApp } from '@/contexts/AppContext';
import { useQuery } from '@tanstack/react-query';
import { fetchTeams, type TeamCard } from '@/lib/api/teams';
import { LEAGUE_REGISTRY, type LeagueIdentity } from '@/lib/leagues';
import { Award, Users, Lock } from 'lucide-react';
import type { LeagueId, StatLine } from '@/types';

type ProfileView = 'players' | 'teams' | 'leagues';

type ProfilePlayer = {
  id: string;
  name: string;
  number: number;
  position: string;
  teamId: string;
  leagueId: LeagueId;
  avatar: string;
  stats: StatLine;
};

const emptyStats: StatLine = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fls: 0, min: 0 };

const ProfilesPage = () => {
  const { hasPremiumPlayerAccess } = useApp();
  const [view, setView] = useState<ProfileView>('players');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
    retry: 1,
    staleTime: 120_000,
  });

  const teams = useMemo<TeamCard[]>(() => teamsQuery.data?.teams ?? [], [teamsQuery.data]);

  const filteredPlayers = useMemo<ProfilePlayer[]>(() => {
    return teams.flatMap((team) => {
      const leagueId = team.league_code.toLowerCase() as LeagueId;
      return team.players.map((player) => {
        const first = player.first_name?.trim() ?? '';
        const last = player.last_name?.trim() ?? '';
        const fullName = [first, last].filter(Boolean).join(' ').trim();
        return {
          id: player.id,
          name: fullName || `Player ${String(player.id).slice(0, 6)}`,
          number: player.jersey_number ?? 0,
          position: player.position ?? 'N/A',
          teamId: team.id,
          leagueId,
          avatar: player.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'Player')}&background=111111&color=ffffff`,
          stats: emptyStats,
        };
      });
    });
  }, [teams]);

  const detail = selectedPlayer ? filteredPlayers.find((p) => p.id === selectedPlayer) ?? null : null;

  const leagueCards = useMemo(() => {
    const teamCountByLeague = new Map<string, number>();
    const playerCountByLeague = new Map<string, number>();

    teams.forEach((team) => {
      const key = team.league_code.toLowerCase();
      teamCountByLeague.set(key, (teamCountByLeague.get(key) ?? 0) + 1);
      playerCountByLeague.set(key, (playerCountByLeague.get(key) ?? 0) + team.players.length);
    });

    return LEAGUE_REGISTRY.map((league: LeagueIdentity) => ({
      league,
      teamCount: teamCountByLeague.get(league.id) ?? 0,
      playerCount: playerCountByLeague.get(league.id) ?? 0,
    }));
  }, [teams]);

  const views: ProfileView[] = useMemo(
    () => (hasPremiumPlayerAccess ? ['players', 'teams', 'leagues'] : ['teams', 'leagues']),
    [hasPremiumPlayerAccess],
  );

  useEffect(() => {
    if (!views.includes(view)) setView('teams');
  }, [view, views]);

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">Players, teams, and leagues</p>
        </div>

        <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit mb-8">
          {views.map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${view === v ? 'bg-card text-foreground' : 'text-muted-foreground'}`}>
              {v}
            </button>
          ))}
        </div>

        {!hasPremiumPlayerAccess && (
          <div className="panel p-4 mb-6 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Player profiles and leaderboard-linked profile tabs unlock only with an active player registration renewal.</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Lock className="w-3 h-3" /> Player tier required</span>
          </div>
        )}

        {teamsQuery.isLoading ? <div className="panel p-8 text-center text-sm text-muted-foreground">Loading profiles…</div> : null}
        {teamsQuery.isError ? <div className="panel p-8 text-center text-sm text-destructive">Could not load profiles.</div> : null}

        {view === 'players' && hasPremiumPlayerAccess && !teamsQuery.isLoading && !teamsQuery.isError && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredPlayers.map(p => (
                <div key={p.id} onClick={() => setSelectedPlayer(p.id)} className={`panel overflow-hidden cursor-pointer group transition-colors ${selectedPlayer === p.id ? 'border-primary/50' : ''}`}>
                  <div className="relative h-44 overflow-hidden">
                    <img src={p.avatar} alt={p.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <span className="stat-numeral text-2xl text-primary">#{p.number || '--'}</span>
                      <p className="font-display font-bold text-sm">{p.name}</p>
                    </div>
                    <div className="absolute top-2 right-2">
                      <LeagueBadge leagueId={p.leagueId} />
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{p.position} · {teams.find(t => t.id === p.teamId)?.name ?? 'Team'}</span>
                    <span className="stat-numeral text-sm text-primary">0 PPG</span>
                  </div>
                </div>
              ))}
            </div>

            <div>
              {detail ? (
                <div className="panel p-4 sticky top-24 space-y-4">
                  <div className="relative">
                    <img src={detail.avatar} alt={detail.name} className="w-full aspect-[4/5] object-cover object-top rounded-sm" loading="lazy" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-card p-4">
                      <span className="stat-numeral text-3xl text-primary">#{detail.number || '--'}</span>
                      <h3 className="font-display text-xl font-bold">{detail.name}</h3>
                      <p className="text-xs text-muted-foreground">{detail.position} · {teams.find(t => t.id === detail.teamId)?.name ?? 'Team'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-[10px] font-semibold rounded-sm"><Award className="w-3 h-3" /> Active Player</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(detail.stats).map(([key, val]) => (
                      <div key={key} className="text-center p-2 bg-secondary rounded-sm">
                        <p className="stat-numeral text-base">{val}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{key}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="panel p-8 text-center">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Select a player to view profile</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'teams' && !teamsQuery.isLoading && !teamsQuery.isError && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map(t => (
              <div key={t.id} className="panel p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display font-bold">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{t.division_name ?? 'Division'}</p>
                  </div>
                  <LeagueBadge leagueId={t.league_code.toLowerCase() as LeagueId} />
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="stat-numeral text-2xl text-success">{t.stats.wins}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="stat-numeral text-2xl text-destructive">{t.stats.losses}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Losses</p>
                  </div>
                  <div className="text-center">
                    <p className="stat-numeral text-2xl">{(Number(t.stats.winPct) * 100).toFixed(0)}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Win %</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">Roster: {t.players.map(p => [p.first_name, p.last_name].filter(Boolean).join(' ')).filter(Boolean).join(', ') || 'View full roster'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'leagues' && !teamsQuery.isLoading && !teamsQuery.isError && (
          <div className="space-y-4">
            {leagueCards.map(({ league, teamCount, playerCount }) => (
              <div key={league.id} className="panel p-6">
                <div className="flex items-center gap-3 mb-3">
                  <LeagueBadge leagueId={league.id} size="md" />
                  <h3 className="font-display text-xl font-bold">{league.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{league.shortName} league profile and roster directory.</p>
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
                  <div>
                    <p className="stat-numeral text-xl">{teamCount}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Teams</p>
                  </div>
                  <div>
                    <p className="stat-numeral text-xl">{playerCount}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Players</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilesPage;
