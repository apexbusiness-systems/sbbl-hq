import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { LiveStreamPlayer } from '@/components/LiveStreamPlayer';
import { CASLNudge } from '@/components/CASLNudge';
import { MessageSquare, Share2, Scissors, ShoppingBag, Check, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { fetchPublicHome } from '@/lib/api/public';
import type { Game, Product, PlayerProfile } from '@/types';

const LivePage = () => {
  const { addToBag, hasPremiumPlayerAccess } = useApp();
  const { user, session, roles } = useAuth();
  const token = session?.access_token ?? null;
  const homeQuery = useQuery({
    queryKey: ['public-home-live', 'SBBL'],
    queryFn: () => fetchPublicHome('SBBL'),
    retry: 1,
    staleTime: 30_000,
  });
  const productsQuery = useQuery({
    queryKey: ['public-products'],
    queryFn: () => apiFetch<{ ok: boolean; data: Product[] }>('/api/public/products'),
    retry: 1,
    staleTime: 60_000,
  });

  const liveGame = useMemo<Game | null>(() => {
    const game = homeQuery.data?.liveGames?.[0] ?? homeQuery.data?.upcomingGames?.[0];
    if (!game) return null;
    return {
      id: game.id,
      leagueId: 'sbbl',
      homeTeam: {
        id: game.home_team?.id ?? 'home',
        name: game.home_team?.name ?? 'Home Team',
        leagueId: 'sbbl',
        division: game.home_team?.division_name ?? 'Division',
        record: { wins: 0, losses: 0 },
      },
      awayTeam: {
        id: game.away_team?.id ?? 'away',
        name: game.away_team?.name ?? 'Away Team',
        leagueId: 'sbbl',
        division: game.away_team?.division_name ?? 'Division',
        record: { wins: 0, losses: 0 },
      },
      venue: game.venue ?? 'TBD',
      court: game.court ?? 'TBD',
      date: game.scheduled_at ?? new Date().toISOString(),
      time: game.scheduled_at ?? new Date().toISOString(),
      status: game.status === 'live' ? 'live' : game.status === 'final' ? 'final' : 'upcoming',
      score: game.home_score != null && game.away_score != null ? { home: game.home_score, away: game.away_score } : undefined,
      ppvPrice: 4.99,
    };
  }, [homeQuery.data]);

  const [comments, setComments] = useState<{ user: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState({ fire: 0, heart: 0, clap: 0 });
  const [clipSaved, setClipSaved] = useState(false);
  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<{ ok: boolean; data: PlayerProfile[] }>('/api/stats'),
    enabled: !!session,
    retry: 1,
    staleTime: 30_000,
  });
  const topPerformers = useMemo(() => {
    const apiData = statsQuery.data?.data;
    if (!Array.isArray(apiData) || apiData.length === 0 || !liveGame) return [];
    return apiData.filter(p => p.teamId === liveGame.homeTeam.id || p.teamId === liveGame.awayTeam.id).sort((a, b) => b.stats.pts - a.stats.pts).slice(0, 3);
  }, [statsQuery.data, liveGame]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const featuredProducts = (productsQuery.data?.data ?? []).filter(p => p.sale);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselProduct = featuredProducts[carouselIdx] ?? null;

  useEffect(() => {
    if (featuredProducts.length <= 1) return;
    const id = setInterval(() => setCarouselIdx(i => (i + 1) % featuredProducts.length), 4000);
    return () => clearInterval(id);
  }, [featuredProducts.length]);

  const handleShare = async () => {
    if (!liveGame) return;
    const shareData = {
      title: `${liveGame.homeTeam.name} vs ${liveGame.awayTeam.name} — Live on SBBL HQ`,
      text: `Watch the game live on SBBL HQ`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  const handleClip = () => {
    setClipSaved(true);
    toast.success('Clip saved to your Media library');
    setTimeout(() => setClipSaved(false), 2500);
  };

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setComments(prev => [...prev, { user: 'You', text }]);
    setChatInput('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const sidebar = (
    <div className="space-y-4">
      {/* Featured Merch Carousel */}
      {featuredProducts.length > 0 && carouselProduct && (
        <div className="panel overflow-hidden">
          <div className="relative aspect-square overflow-hidden bg-secondary">
            <img
              key={carouselProduct.id}
              src={carouselProduct.image}
              alt={carouselProduct.name}
              className="w-full h-full object-cover animate-fade-in"
              loading="lazy"
            />
            <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider rounded-sm">
              <Tag className="w-2.5 h-2.5" /> Sale
            </span>
            {featuredProducts.length > 1 && (
              <>
                <button
                  onClick={() => setCarouselIdx(i => (i - 1 + featuredProducts.length) % featuredProducts.length)}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCarouselIdx(i => (i + 1) % featuredProducts.length)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {featuredProducts.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCarouselIdx(i)}
                      className={`h-1.5 rounded-full transition-all ${i === carouselIdx ? 'bg-primary w-3' : 'bg-foreground/30 w-1.5'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="p-4">
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Featured Merch · {carouselIdx + 1}/{featuredProducts.length}</p>
            <p className="font-display font-bold text-sm mt-1 truncate">{carouselProduct.name}</p>
            {carouselProduct.colors && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{carouselProduct.colors[0]}</p>
            )}
            <button
              onClick={() => addToBag(carouselProduct.id)}
              className="mt-3 w-full gold-bg py-2.5 font-display font-bold text-xs uppercase tracking-wider rounded-sm inline-flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {carouselProduct.price > 0 ? `Add to Bag — $${carouselProduct.price.toLocaleString()}` : 'Claim Reward'}
            </button>
          </div>
        </div>
      )}

      {/* Top Performers */}
      <div className="panel p-4">
        <h3 className="font-display font-bold text-sm mb-3">Top Performers</h3>
        {topPerformers.map(p => (
          <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full object-cover" loading="lazy" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground">{p.position}</p>
            </div>
            <span className="stat-numeral text-sm text-primary">{p.stats.pts} PTS</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (homeQuery.isLoading) {
    return <div className="container py-8"><div className="panel p-8 text-center text-sm text-muted-foreground">Loading live game…</div></div>;
  }
  if (homeQuery.isError || !liveGame) {
    return <div className="container py-8"><div className="panel p-8 text-center text-sm text-destructive">Live game unavailable right now.</div></div>;
  }

  return (
    <div className="min-h-screen">
      <div className="lg:container lg:py-4">
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

          {/* LEFT: broadcast area + actions + chat */}
          <div className="lg:col-span-2 flex flex-col">

            {/* Broadcast Area — all access-gate logic lives inside LiveStreamPlayer */}
            <div className="relative aspect-video bg-muted overflow-hidden lg:rounded-sm">
              <LiveStreamPlayer
                game={liveGame}
                userId={user?.id ?? null}
                roles={roles}
                token={token}
                hasPremiumPlayerAccess={hasPremiumPlayerAccess}
              />
            </div>

            {/* Actions + Chat */}
            <div className="container lg:px-0 py-4 space-y-4">
              {/* Reaction bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => setReactions(r => ({ ...r, fire: r.fire + 1 }))} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors">
                  🔥 <span className="stat-numeral">{reactions.fire}</span>
                </button>
                <button onClick={() => setReactions(r => ({ ...r, heart: r.heart + 1 }))} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors">
                  ❤️ <span className="stat-numeral">{reactions.heart}</span>
                </button>
                <button onClick={() => setReactions(r => ({ ...r, clap: r.clap + 1 }))} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors">
                  👏 <span className="stat-numeral">{reactions.clap}</span>
                </button>
                <button
                  onClick={handleClip}
                  className={`panel px-3 py-2 text-xs flex items-center gap-1.5 transition-colors ${clipSaved ? 'border-primary/50 text-primary' : 'hover:border-primary/30'}`}
                >
                  {clipSaved ? <Check className="w-3.5 h-3.5" /> : <Scissors className="w-3.5 h-3.5" />}
                  {clipSaved ? 'Saved' : 'Clip'}
                </button>
                <button onClick={handleShare} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors">
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>
              </div>

              {/* Live Chat */}
              <div className="panel">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Live Chat</span>
                </div>
                <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                  {comments.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-xs font-semibold shrink-0 text-primary">{c.user}</span>
                      <span className="text-xs text-foreground">{c.text}</span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }}
                    placeholder="Send a message..."
                    className="flex-1 bg-secondary px-3 py-2 text-xs rounded-sm border border-border focus:outline-none focus:border-primary/50"
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!chatInput.trim()}
                    className="px-3 py-2 text-xs bg-primary text-primary-foreground rounded-sm font-medium disabled:opacity-40 transition-opacity"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Mobile-only sidebar */}
              <div className="lg:hidden">{sidebar}</div>
            </div>
          </div>

          {/* RIGHT: sticky sidebar */}
          <div className="hidden lg:block sticky top-[73px]">
            {sidebar}
          </div>

        </div>
      </div>

      {/* CASL nudge — one-time per session, bottom-right, easy dismiss */}
      <CASLNudge roles={roles} />
    </div>
  );
};

export default LivePage;
