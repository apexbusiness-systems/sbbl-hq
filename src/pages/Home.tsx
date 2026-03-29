import { useApp } from '@/contexts/AppContext';
import { getLeagueConfig, leagueCodeFromId } from '@/lib/leagues';
import { fetchPublicHome, type PublicHomeData, type PublicGame } from '@/lib/api/public';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { motion } from 'framer-motion';
import { Play, Clock, Trophy, ChevronRight, Users, Calendar, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

type LoadState = 'loading' | 'loaded' | 'error';

const HomePage = () => {
  const { activeLeague } = useApp();
  const league = getLeagueConfig(activeLeague);
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<PublicHomeData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setErrorMsg(null);
    fetchPublicHome(leagueCodeFromId(activeLeague))
      .then((result) => { if (!cancelled) { setData(result); setState('loaded'); } })
      .catch((err) => { if (!cancelled) { setErrorMsg(err instanceof Error ? err.message : 'Failed to load'); setState('error'); } });
    return () => { cancelled = true; };
  }, [activeLeague]);

  const liveGames = data?.liveGames ?? [];
  const upcomingGames = data?.upcomingGames ?? [];
  const recentGames = data?.recentGames ?? [];
  const hasLive = liveGames.length > 0;

  const isSeasonEmpty =
    state === 'loaded' &&
    data !== null &&
    data.teams.length === 0 &&
    upcomingGames.length === 0 &&
    liveGames.length === 0 &&
    recentGames.length === 0 &&
    (data.totalGames ?? 0) === 0;

  return (
    <div className="min-h-screen">

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0A0A0A]" style={{ minHeight: '480px' }}>

        {/* Court line art — full bleed background texture */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: 'url(/assets/hero-court.svg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 1,
          }}
        />

        {/* Gold radial glow — left anchor */}
        <div className="absolute inset-0 [background:radial-gradient(ellipse_at_20%_60%,rgba(201,168,76,0.12)_0%,transparent_55%)]" />

        {/* Bottom fade to page bg */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

        <div className="relative container py-16 md:py-24 lg:py-28">
          <div className="grid md:grid-cols-[1fr,360px] gap-8 items-start">

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

              {/* League badge — small, subordinate context label */}
              <div className="mb-4">
                <LeagueBadge leagueId={activeLeague} size="sm" />
              </div>

              {/* App + league headline — SBBL HQ is the brand, league name is the content */}
              <h1 className="font-display leading-none uppercase">
                <span className="block text-[clamp(3rem,8vw,6rem)] font-bold tracking-tight text-foreground">
                  {league.shortName}
                </span>
                <span className="block text-[clamp(1.5rem,4vw,2.75rem)] font-bold tracking-wider text-primary mt-1">
                  {data?.season?.name ?? 'Basketball'}
                </span>
              </h1>

              <p className="text-muted-foreground text-sm md:text-base max-w-md mt-5 leading-relaxed">
                {league.name} — live scoring, standings, and team operations across every division.
              </p>

              <div className="flex items-center gap-3 mt-7">
                {hasLive ? (
                  <Link
                    to="/teams"
                    className="gold-bg px-6 py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" /> Live Now
                  </Link>
                ) : (
                  <Link
                    to="/teams"
                    className="gold-bg px-6 py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" /> View Teams
                  </Link>
                )}
                <Link
                  to="/schedules"
                  className="px-6 py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center gap-2 border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  Schedule
                </Link>
              </div>
            </motion.div>

            {/* League Snapshot Card */}
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="panel p-5 bg-card/90 backdrop-blur-sm border-primary/20"
              style={{ boxShadow: '0 0 20px rgba(201,168,76,0.08)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">League Snapshot</p>

              {state === 'loading' && (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 rounded-sm bg-secondary animate-pulse" />
                  ))}
                </div>
              )}

              {state === 'error' && (
                <div className="text-sm text-muted-foreground py-4">
                  <p>Unable to load live data.</p>
                  <p className="text-xs mt-1 text-destructive">{errorMsg}</p>
                </div>
              )}

              {state === 'loaded' && data && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricCard label="Teams" value={data.totalTeams} icon={<Users className="w-3.5 h-3.5 text-primary" />} />
                    <MetricCard label="Rostered" value={data.totalRostered} icon={<BarChart3 className="w-3.5 h-3.5 text-primary" />} />
                    <MetricCard label="Games" value={data.totalGames} icon={<Calendar className="w-3.5 h-3.5 text-primary" />} />
                    <MetricCard label="Live" value={liveGames.length} icon={<Play className="w-3.5 h-3.5 text-live" />} highlight={hasLive} />
                  </div>

                  {data.teams.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Featured Teams</p>
                      <div className="space-y-1.5">
                        {data.teams.slice(0, 4).map((team) => (
                          <div key={team.id} className="flex items-center justify-between text-xs">
                            <span className="text-foreground/90 truncate">{team.name}</span>
                            <span className="text-muted-foreground tabular-nums">{team.roster_count} players</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.teams.length === 0 && (
                    <p className="mt-4 text-xs text-muted-foreground">No teams published for this league yet.</p>
                  )}
                </>
              )}
            </motion.aside>

          </div>
        </div>
      </section>

      {/* ── LIVE GAMES STRIP ─────────────────────────────────── */}
      {hasLive && (
        <section className="border-b border-border">
          <div className="container py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-2 h-2 rounded-full bg-live">
                <div className="absolute inset-0 rounded-full bg-live animate-ping" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-live">Live Now</span>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hidden">
              {liveGames.map((g) => <GameCard key={g.id} game={g} variant="live" />)}
            </div>
          </div>
        </section>
      )}

      <div className="container py-8 md:py-12 space-y-12">

        {/* Upcoming Games */}
        {upcomingGames.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight">Upcoming Games</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingGames.map((g) => <GameCard key={g.id} game={g} variant="upcoming" />)}
            </div>
          </section>
        )}

        {/* Recent Results — visible when season started but no upcoming games */}
        {recentGames.length > 0 && upcomingGames.length === 0 && !hasLive && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight">Recent Results</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentGames.map((g) => <GameCard key={g.id} game={g} variant="upcoming" />)}
            </div>
          </section>
        )}

        {/* Teams grid */}
        {state === 'loaded' && data && data.teams.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight">Teams</h2>
              <Link to="/teams" className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                All Teams <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.teams.slice(0, 6).map((team) => (
                <div key={team.id} className="panel p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display font-bold text-sm">{team.name}</h3>
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">{team.league_code}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {team.division_name && <span>{team.division_name}</span>}
                    <span>{team.season_name}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{team.roster_count} rostered players</span>
                    <Trophy className="w-3.5 h-3.5 text-primary/40" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Truly empty — zero data of any kind */}
        {isSeasonEmpty && (
          <section className="panel p-8 text-center">
            <Calendar className="w-8 h-8 text-primary/40 mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold">Season Coming Soon</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {league.name} is gearing up. Teams, schedules, and live scoring will appear here as the season launches.
            </p>
          </section>
        )}

      </div>
    </div>
  );
};

function MetricCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-sm border p-3 ${highlight ? 'border-live/30 bg-live/5' : 'border-border'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="stat-numeral text-xl">{value || '—'}</p>
    </div>
  );
}

function GameCard({ game, variant }: { game: PublicGame; variant: 'live' | 'upcoming' }) {
  const isLive = variant === 'live';
  const scheduledDate = game.scheduled_at ? new Date(game.scheduled_at) : null;

  return (
    <div className={`panel flex-shrink-0 p-4 ${isLive ? 'min-w-[280px] hover:border-live/30' : ''} transition-colors`}>
      <div className="flex items-center gap-2 mb-2">
        {game.venue && <span className="text-xs text-muted-foreground">{game.venue}</span>}
        {game.court && <span className="text-xs text-muted-foreground">· {game.court}</span>}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{game.home_team?.name ?? 'TBD'}</div>
        {isLive && game.home_score != null && <div className="stat-numeral text-lg text-live">{game.home_score}</div>}
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-sm font-medium">{game.away_team?.name ?? 'TBD'}</div>
        {isLive && game.away_score != null && <div className="stat-numeral text-lg text-live">{game.away_score}</div>}
      </div>
      {!isLive && scheduledDate && (
        <div className="mt-3 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{scheduledDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span>· {scheduledDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
