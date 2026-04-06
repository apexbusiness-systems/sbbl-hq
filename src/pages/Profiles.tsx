import { useMemo, useState } from 'react';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { useApp } from '@/contexts/AppContext';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { Team, PlayerProfile } from '@/types';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { Award, Lock, Activity } from 'lucide-react';

// ProfileView only covers Players and Leagues.
// Teams has been permanently removed from Profiles — it lives exclusively
// under the /teams route (TeamsPage), which has Standings, Rosters, and Stats.
type ProfileView = 'players' | 'leagues';

const PlayerDetail = ({ id }: { id: string }) => {
  const { data: playersQuery } = useQuery<{ data: PlayerProfile[] }>({
    queryKey: ['profiles-players'],
    queryFn: () => apiFetch<{ ok: boolean; data: PlayerProfile[] }>('/api/leaderboards'),
  });

  const player = playersQuery?.data?.find((p) => p.id === id);

  if (!player) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full border-4 border-primary/20 bg-secondary/50 overflow-hidden">
          <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold">{player.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground uppercase tracking-widest">{player.position}</span>
            <span className="text-primary font-bold">#{player.number}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'PPG', val: player.stats?.pts || 0 },
          { label: 'REB', val: player.stats?.reb || 0 },
          { label: 'AST', val: player.stats?.ast || 0 },
        ].map((s) => (
          <div key={s.label} className="panel p-4 text-center bg-secondary/20">
            <p className="text-2xl font-display font-bold">{s.val}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Award className="w-3.5 h-3.5" />
          Accolades
        </div>
        <div className="flex flex-wrap gap-2">
          {player.badges?.map((b) => (
            <span key={b} className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold rounded-sm">
              {b}
            </span>
          )) || <span className="text-xs text-muted-foreground italic">No badges earned this season.</span>}
        </div>
      </div>
    </div>
  );
};

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

  // Fetch player data (using leaderboards as a proxy for the athlete registry)
  const playersQuery = useQuery({
    queryKey: ['profiles-players'],
    queryFn: () => apiFetch<{ ok: boolean; data: PlayerProfile[] }>('/api/leaderboards'),
    enabled: hasPremiumPlayerAccess, // Only fetch if user has access
    retry: 1,
    staleTime: 300_000,
  });

  const teams = useMemo(() => {
    const apiData = teamsQuery.data?.teams;
    if (Array.isArray(apiData) && apiData.length > 0) return apiData;
    return [];
  }, [teamsQuery.data]);

  const players = useMemo(() => {
    const apiData = playersQuery.data?.data;
    if (Array.isArray(apiData) && apiData.length > 0) return apiData;
    return [];
  }, [playersQuery.data]);

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
            {hasPremiumPlayerAccess ? (
              /* Full player grid for premium users */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {players.length === 0 && !playersQuery.isLoading ? (
                   <div className="panel p-8 text-center col-span-full">
                     <p className="text-sm text-muted-foreground">No player profiles found.</p>
                   </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {players.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPlayer(p.id)}
                          className={`w-full text-left panel overflow-hidden group transition-colors ${
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
                                {p.position} &middot; {teams.find((t) => t.id === p.teamId)?.name || 'Independent'}
                                &nbsp;&nbsp;
                                <span className="text-foreground font-medium">{p.stats?.pts || 0}</span> PPG
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="panel p-6">
                      {selectedPlayer ? (
                        <PlayerDetail id={selectedPlayer} />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center py-12">
                          <Activity className="w-8 h-8 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">Select a player to view detailed profile</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Lock screen for non-premium users */
              <div className="panel p-20 text-center flex flex-col items-center justify-center bg-secondary/10">
                <div className="p-4 bg-primary/10 rounded-full mb-6">
                  <Lock className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-3">Premium Content Locked</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                  The player directory and individual performance profiles are exclusive to registered SBBL HQ players.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="btn-primary px-8">Upgrade to Premium</button>
                  <button className="btn-secondary px-8">Learn More</button>
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <LeagueBadge leagueId={l.id} />
                    <h3 className="font-bold mt-2">{l.name}</h3>
                  </div>
                  <img src={l.logo} alt={l.logoAlt} className="w-10 h-10 object-contain opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  Official participation in the {l.name} includes season membership, stat tracking, and live stream coverage.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <div className="text-center bg-secondary/30 p-2 rounded-sm" key="teams">
                    <p className="text-sm font-bold">{teams.filter((t) => t.leagueId === l.id).length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Teams</p>
                  </div>
                  <div className="text-center bg-secondary/30 p-2 rounded-sm" key="players">
                    <p className="text-sm font-bold">{players.filter((p) => p.leagueId === l.id).length || '-'}</p>
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
