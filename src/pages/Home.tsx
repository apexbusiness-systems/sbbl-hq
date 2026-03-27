import { useApp } from '@/contexts/AppContext';
import { leagues, games, players, products, mediaAssets } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import heroImage from '@/assets/hero-basketball.jpg';
import gameAction from '@/assets/game-action.jpg';
import { motion } from 'framer-motion';
import { Play, Clock, ShoppingBag, Trophy, ChevronRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  const { activeLeague, addToBag } = useApp();
  const league = leagues.find(l => l.id === activeLeague)!;
  const leagueGames = games.filter(g => g.leagueId === activeLeague);
  const liveGames = games.filter(g => g.status === 'live');
  const upcomingGames = games.filter(g => g.status === 'upcoming').slice(0, 3);
  const featuredPlayers = players.filter(p => p.leagueId === activeLeague).slice(0, 3);
  const featuredProducts = products.slice(0, 4);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative h-[70vh] min-h-[500px] max-h-[720px] overflow-hidden">
        <img src={heroImage} alt="SBBL HQ Basketball" className="absolute inset-0 w-full h-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
        <div className="relative h-full container flex flex-col justify-end pb-12 md:pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <LeagueBadge leagueId={activeLeague} size="md" />
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mt-4 leading-[0.95] tracking-tighter">
              {league.shortName}<br />
              <span className="text-primary">Season Live</span>
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-md mt-4 leading-relaxed">
              {league.description}
            </p>
            <div className="flex items-center gap-3 mt-6">
              <Link to="/live" className="gold-bg px-6 py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center gap-2">
                <Play className="w-4 h-4" /> Watch Live
              </Link>
              <Link to="/schedules" className="px-6 py-3 border border-border font-display font-medium text-sm uppercase tracking-wider rounded-sm text-foreground hover:bg-secondary transition-colors">
                Full Schedule
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Now Strip */}
      {liveGames.length > 0 && (
        <section className="border-b border-border">
          <div className="container py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-2 h-2 rounded-full bg-live"><div className="absolute inset-0 rounded-full bg-live animate-ping" /></div>
              <span className="text-xs font-semibold uppercase tracking-widest text-live">Live Now</span>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hidden">
              {liveGames.map(g => (
                <Link key={g.id} to="/live" className="panel flex-shrink-0 p-4 min-w-[280px] hover:border-live/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <LeagueBadge leagueId={g.leagueId} />
                    <span className="text-xs text-muted-foreground">{g.venue}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{g.homeTeam.name}</div>
                    <div className="stat-numeral text-lg text-live">{g.score?.home}</div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-sm font-medium">{g.awayTeam.name}</div>
                    <div className="stat-numeral text-lg text-live">{g.score?.away}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="container py-8 md:py-12 space-y-12">
        {/* Upcoming Games */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl md:text-2xl font-bold">Upcoming Games</h2>
            <Link to="/schedules" className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingGames.map(g => (
              <div key={g.id} className="panel p-4">
                <div className="flex items-center gap-2 mb-3">
                  <LeagueBadge leagueId={g.leagueId} />
                  <span className="text-xs text-muted-foreground">{g.date} · {g.time}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{g.homeTeam.name}</span>
                    <span className="text-xs text-muted-foreground">{g.homeTeam.record.wins}-{g.homeTeam.record.losses}</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">vs</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{g.awayTeam.name}</span>
                    <span className="text-xs text-muted-foreground">{g.awayTeam.record.wins}-{g.awayTeam.record.losses}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">{g.venue} · {g.court}</span>
                  <span className="stat-numeral text-xs text-primary">PPV ${g.ppvPrice.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Players */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl md:text-2xl font-bold">Featured Players</h2>
            <Link to="/profiles" className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
              All Profiles <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredPlayers.map(p => (
              <div key={p.id} className="panel overflow-hidden group">
                <div className="relative h-48 overflow-hidden">
                  <img src={p.avatar} alt={p.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="flex items-center gap-2">
                      <span className="stat-numeral text-2xl text-primary">#{p.number}</span>
                      <div>
                        <p className="font-display font-bold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.position} · {leagues.find(l => l.id === p.leagueId)?.shortName}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 grid grid-cols-4 gap-2">
                  {[
                    { label: 'PTS', value: p.stats.pts },
                    { label: 'REB', value: p.stats.reb },
                    { label: 'AST', value: p.stats.ast },
                    { label: 'STL', value: p.stats.stl },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="stat-numeral text-base">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Store Drops */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl md:text-2xl font-bold">Store Drops</h2>
            <Link to="/store" className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
              Shop All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredProducts.map(p => (
              <div key={p.id} className="panel overflow-hidden group cursor-pointer" onClick={() => addToBag(p.id)}>
                <div className="relative aspect-square overflow-hidden">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  {p.badge && (
                    <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-primary text-primary-foreground">{p.badge}</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <p className="stat-numeral text-sm text-primary mt-0.5">{p.price > 0 ? `₱${p.price.toLocaleString()}` : 'Reward'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Engagement Strip */}
        <section className="panel p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-sm"><Zap className="w-5 h-5 text-primary" /></div>
              <div>
                <h3 className="font-display font-bold text-sm mb-1">Watch Streak</h3>
                <p className="text-xs text-muted-foreground">Catch 5 consecutive live games to unlock exclusive merch discounts and reward badges.</p>
                <div className="flex gap-1 mt-2">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-6 h-1.5 rounded-full ${i <= 3 ? 'bg-primary' : 'bg-secondary'}`} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-sm"><Trophy className="w-5 h-5 text-primary" /></div>
              <div>
                <h3 className="font-display font-bold text-sm mb-1">Season Rewards</h3>
                <p className="text-xs text-muted-foreground">Earn points through purchases, watch time, and social shares. Redeem for exclusive drops.</p>
                <p className="stat-numeral text-lg text-primary mt-1">2,450 pts</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-sm"><ShoppingBag className="w-5 h-5 text-primary" /></div>
              <div>
                <h3 className="font-display font-bold text-sm mb-1">Featured Drop</h3>
                <p className="text-xs text-muted-foreground">SBBL All-Star Media Day Collection — limited release jerseys and signed accessories.</p>
                <Link to="/store" className="text-xs text-primary font-semibold mt-1 inline-block">Shop Now →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Media Highlights */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl md:text-2xl font-bold">Highlights</h2>
            <Link to="/media" className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
              All Media <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mediaAssets.filter(m => m.status === 'published').map(m => (
              <div key={m.id} className="panel overflow-hidden group">
                <div className="relative aspect-video overflow-hidden">
                  <img src={m.thumbnail} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                    <div>
                      <LeagueBadge leagueId={m.leagueId} />
                      <p className="font-display font-bold text-sm mt-1">{m.title}</p>
                    </div>
                    <div className="p-2 bg-primary/20 rounded-full"><Play className="w-4 h-4 text-primary" /></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
