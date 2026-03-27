import { useState } from 'react';
import { players, teams, leagues } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { useApp } from '@/contexts/AppContext';
import { Trophy, Award, Users, ChevronRight } from 'lucide-react';

type ProfileView = 'players' | 'teams' | 'leagues';

const ProfilesPage = () => {
  const { activeLeague } = useApp();
  const [view, setView] = useState<ProfileView>('players');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const filteredPlayers = players;
  const filteredTeams = teams;
  const detail = selectedPlayer ? players.find(p => p.id === selectedPlayer) : null;

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">Players, teams, and leagues</p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit mb-8">
          {(['players', 'teams', 'leagues'] as ProfileView[]).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${view === v ? 'bg-card text-foreground' : 'text-muted-foreground'}`}>
              {v}
            </button>
          ))}
        </div>

        {view === 'players' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredPlayers.map(p => (
                <div key={p.id} onClick={() => setSelectedPlayer(p.id)} className={`panel overflow-hidden cursor-pointer group transition-colors ${selectedPlayer === p.id ? 'border-primary/50' : ''}`}>
                  <div className="relative h-44 overflow-hidden">
                    <img src={p.avatar} alt={p.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <span className="stat-numeral text-2xl text-primary">#{p.number}</span>
                      <p className="font-display font-bold text-sm">{p.name}</p>
                    </div>
                    <div className="absolute top-2 right-2">
                      <LeagueBadge leagueId={p.leagueId} />
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{p.position} · {teams.find(t => t.id === p.teamId)?.name}</span>
                    <span className="stat-numeral text-sm text-primary">{p.stats.pts} PPG</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Player Detail */}
            <div>
              {detail ? (
                <div className="panel p-4 sticky top-24 space-y-4">
                  <div className="relative">
                    <img src={detail.avatar} alt={detail.name} className="w-full aspect-[4/5] object-cover object-top rounded-sm" loading="lazy" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-card p-4">
                      <span className="stat-numeral text-3xl text-primary">#{detail.number}</span>
                      <h3 className="font-display text-xl font-bold">{detail.name}</h3>
                      <p className="text-xs text-muted-foreground">{detail.position} · {teams.find(t => t.id === detail.teamId)?.name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.badges.map(b => (
                      <span key={b} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-[10px] font-semibold rounded-sm">
                        <Award className="w-3 h-3" /> {b}
                      </span>
                    ))}
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

        {view === 'teams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTeams.map(t => (
              <div key={t.id} className="panel p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display font-bold">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{t.division}</p>
                  </div>
                  <LeagueBadge leagueId={t.leagueId} />
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="stat-numeral text-2xl text-success">{t.record.wins}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="stat-numeral text-2xl text-destructive">{t.record.losses}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Losses</p>
                  </div>
                  <div className="text-center">
                    <p className="stat-numeral text-2xl">{((t.record.wins / (t.record.wins + t.record.losses)) * 100).toFixed(0)}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Win %</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">Roster: {players.filter(p => p.teamId === t.id).map(p => p.name).join(', ') || 'View full roster'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'leagues' && (
          <div className="space-y-4">
            {leagues.map(l => (
              <div key={l.id} className="panel p-6">
                <div className="flex items-center gap-3 mb-3">
                  <LeagueBadge leagueId={l.id} size="md" />
                  <h3 className="font-display text-xl font-bold">{l.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{l.description}</p>
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
                  <div>
                    <p className="stat-numeral text-xl text-primary">₱{l.fee.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Season Fee</p>
                  </div>
                  <div>
                    <p className="stat-numeral text-xl">{teams.filter(t => t.leagueId === l.id).length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Teams</p>
                  </div>
                  <div>
                    <p className="stat-numeral text-xl">{players.filter(p => p.leagueId === l.id).length}</p>
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
