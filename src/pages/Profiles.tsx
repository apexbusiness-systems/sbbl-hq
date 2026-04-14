import { useMemo, useState } from 'react';
import { players, leagues } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { useApp } from '@/contexts/AppContext';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { Team } from '@/types';
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

  // Fetch teams data so player cards can resolve team names.
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => apiFetch<{ ok: boolean; teams: Team[] }>('/api/teams'),
    retry: 1,
    staleTime: 120_000,
  });

  const teams = useMemo(() => {
    const apiData = teamsQuery.data?.teams;
    if (Array.isArray(apiData) && apiData.length > 0) return apiData;
    return [];
  }, [teamsQuery.data]);

  const teamMap = useMemo(() => {
    const map: Record<string, Team> = {};
    teams.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [teams]);

  // ⚡ Bolt Performance Optimization: Pre-calculate counts in a single O(N) pass
  // instead of O(N * L) filtering inside the render loop mapping.
  const leagueStats = useMemo(() => {
    const counts: Record<string, { teams: number; players: number }> = {};
    leagues.forEach(l => counts[l.id] = { teams: 0, players: 0 });

    teams.forEach(t => {
      if (counts[t.leagueId]) counts[t.leagueId].teams++;
    });

    players.forEach(p => {
      if (counts[p.leagueId]) counts[p.leagueId].players++;
    });

    return counts;
  }, [teams]);

  const detail = selectedPlayer ? players.find((p) => p.id === selectedPlayer) : null;

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
                          #{p.number}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.position} &middot; {teamMap[p.teamId]?.name}
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
                            {detail.position} &middot; {teamMap[detail.teamId]?.name}
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
            {leagues.map((l) => (
              <div key={l.id} className="panel p-5 space-y-3">
                <div>
                  <LeagueBadge leagueId={l.id} />
                  <h3 className="font-bold mt-2">{l.name}</h3>
                  <p className="text-sm text-muted-foreground">{l.description}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                  <div className="text-center">
                    <p className="text-base font-bold">${l.fee.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Season Fee</p>
                  </div>
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
