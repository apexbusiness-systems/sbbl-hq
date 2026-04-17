import { useMemo, useState } from 'react';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { useApp } from '@/contexts/AppContext';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { LEAGUE_REGISTRY, leagueIdFromCode } from '@/lib/leagues';
import type { PlayerProfile, LeagueId } from '@/types';
import type { TeamCard } from '@/lib/api/teams';
import { Award, Lock } from 'lucide-react';

// ProfileView only covers Players and Leagues.
// Teams has been permanently removed from Profiles — it lives exclusively
// under the /teams route (TeamsPage), which has Standings, Rosters, and Stats.
type ProfileView = 'players' | 'leagues';

const ProfilesPage = () => {
  const { hasPremiumPlayerAccess } = useApp();

  // Always default to 'players' — the tab is always visible to all users.
  // Non-premium users see a lock/upgrade prompt instead of the data.
  const [view, setView] = useState<ProfileView>('players');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  // Fetch teams data so player cards can resolve team names. /api/teams
  // returns TeamCard[] (league_code: "SBBL"/"WBL"/"TGIFBL"), not Team[].
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => apiFetch<{ ok: boolean; teams: TeamCard[] }>('/api/teams'),
    retry: 1,
    staleTime: 120_000,
  });

  const teams = useMemo<TeamCard[]>(() => {
    const apiData = teamsQuery.data?.teams;
    return Array.isArray(apiData) ? apiData : [];
  }, [teamsQuery.data]);

  const teamMap = useMemo(() => {
    const map: Record<string, TeamCard> = {};
    teams.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [teams]);

  // Players come from the tier-gated /api/stats endpoint (the old
  // /api/public/stats was consolidated into /api/stats which now handles
  // both anonymous and authenticated callers and returns tier-appropriate
  // stat lines). Fetch only when premium so we don't burn network for
  // users who will see the lock screen anyway.
  const playersQuery = useQuery({
    queryKey: ['profiles-players'],
    queryFn: () =>
      apiFetch<{ ok: boolean; tier: 'full' | 'minimal'; data: PlayerProfile[] }>(
        '/api/stats',
      ),
    retry: 1,
    staleTime: 60_000,
    enabled: hasPremiumPlayerAccess,
  });

  const players = useMemo<PlayerProfile[]>(() => {
    const apiData = playersQuery.data?.data;
    return Array.isArray(apiData) ? apiData : [];
  }, [playersQuery.data]);

  const leagueStats = useMemo(() => {
    const counts: Record<LeagueId, { teams: number; players: number }> = {
      sbbl: { teams: 0, players: 0 },
      wbl: { teams: 0, players: 0 },
      tgifbl: { teams: 0, players: 0 },
    };
    // TeamCard exposes league_code (UPPER): convert to LeagueId via the
    // canonical leagueIdFromCode helper so this mapping survives future
    // code/id renames.
    teams.forEach((t) => {
      const id = leagueIdFromCode(t.league_code);
      if (counts[id]) counts[id].teams++;
    });
    players.forEach((p) => {
      if (counts[p.leagueId]) counts[p.leagueId].players++;
    });
    return counts;
  }, [teams, players]);

  const detail = useMemo(
    () => (selectedPlayer ? players.find((p) => p.id === selectedPlayer) : null),
    [selectedPlayer, players],
  );

  // Both tabs are always shown. 'players' is always first and always visible.
  const views: ProfileView[] = ['players', 'leagues'];

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">Players and leagues</p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit mb-8">
          {views.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                view === v ? 'bg-card text-foreground' : 'text-muted-foreground'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Players View */}
        {view === 'players' && (
          <div>
            {!hasPremiumPlayerAccess ? (
              /* Lock screen for non-premium users — tab is always visible */
              <div className="panel p-8 text-center space-y-4">
                <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Player profiles and leaderboard-linked profile tabs unlock only with an active
                  player registration renewal.
                </p>
                <span className="inline-block text-xs font-semibold uppercase tracking-wider px-3 py-1 bg-secondary rounded-sm">
                  Player tier required
                </span>
              </div>
            ) : (
              /* Full player grid for premium users */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlayer(p.id)}
                      className={`panel overflow-hidden cursor-pointer group transition-colors ${
                        selectedPlayer === p.id ? 'border-primary/50' : ''
                      }`}
                    >
                      <div className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                          {p.number ? `#${p.number}` : '—'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.position || '—'}{p.teamId && teamMap[p.teamId]?.name ? ` · ${teamMap[p.teamId].name}` : ''}
                            &nbsp;&nbsp;
                            <span className="text-foreground font-medium">{p.stats.pts}</span> PPG
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Player Detail */}
                <div className="panel p-6">
                  {detail ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-lg font-bold">
                          #{detail.number}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{detail.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {detail.position || '—'}{detail.teamId && teamMap[detail.teamId]?.name ? ` · ${teamMap[detail.teamId].name}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {detail.badges.map((b) => (
                          <span key={b} className="flex items-center gap-1 text-xs px-2 py-1 bg-secondary rounded-sm">
                            <Award className="w-3 h-3" /> {b}
                          </span>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {Object.entries(detail.stats).map(([key, val]) => (
                          <div key={key} className="panel p-3 text-center">
                            <p className="text-xl font-bold">{val}</p>
                            <p className="text-xs text-muted-foreground uppercase">{key}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Select a player to view profile
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leagues View */}
        {view === 'leagues' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {LEAGUE_REGISTRY.map((l) => (
              <div key={l.id} className="panel p-5 space-y-3">
                <div>
                  <LeagueBadge leagueId={l.id} />
                  <h3 className="font-bold mt-2">{l.name}</h3>
                  <p className="text-sm text-muted-foreground">{l.shortName}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <div className="text-center">
                    <p className="text-base font-bold">{leagueStats[l.id]?.teams ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Teams</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold">{leagueStats[l.id]?.players ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Players</p>
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
