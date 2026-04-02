import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicHome, type PublicGame } from '@/lib/api/public';
import { apiFetch } from '@/lib/api/client';
import { LiveStreamPlayer } from '@/components/LiveStreamPlayer';
import { CASLNudge } from '@/components/CASLNudge';
import { MessageSquare, Share2, Scissors, ShoppingBag, Check, ChevronLeft, ChevronRight, Tag, Radio, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import type { LeagueId } from '@/types';

type LiveProduct = { id: string; name: string; price: number; image_url?: string; category?: string };

const NoLiveGame = ({ upcomingGames }: { upcomingGames: PublicGame[] }) => {
  const next = upcomingGames[0];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center py-24">
      <div className="panel p-10 max-w-md w-full">
        <Radio className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <h1 className="font-display text-2xl font-bold mb-2">No Live Game</h1>
        <p className="text-sm text-muted-foreground mb-6">No game is in progress right now. Check back when the next game starts.</p>
        {next && (
          <div className="border border-border rounded-sm p-4 text-left">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Next Game</p>
            <p className="font-display font-bold text-sm">{next.home_team?.name ?? 'TBD'} vs {next.away_team?.name ?? 'TBD'}</p>
            {next.scheduled_at && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(next.scheduled_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
            {next.venue && <p className="text-[10px] text-muted-foreground mt-1">{next.venue}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const LivePage = () => {
  const { addToBag, hasPremiumPlayerAccess, activeLeague } = useApp();
  const { user, session, roles } = useAuth();
  const token = session?.access_token ?? null;

  const homeQuery = useQuery({
    queryKey: ['public-home-live', activeLeague],
    queryFn: () => fetchPublicHome(LEAGUE_REGISTRY.find(l => l.id === activeLeague)?.code ?? 'SBBL'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const liveGames = homeQuery.data?.liveGames ?? [];
  const upcomingGames = homeQuery.data?.upcomingGames ?? [];
  const liveGame = liveGames[0] ?? null;

  const productsQuery = useQuery({
    queryKey: ['public-products-live'],
    queryFn: () => apiFetch<{ ok: boolean; data: LiveProduct[] }>('/api/public/products'),
    staleTime: 60_000,
  });
  const featuredProducts = productsQuery.data?.data ?? [];

  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselProduct = featuredProducts[carouselIdx] ?? null;

  const [comments, setComments] = useState<{ user: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState({ fire: 0, heart: 0, clap: 0 });
  const [clipSaved, setClipSaved] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (featuredProducts.length <= 1) return;
    const id = setInterval(() => setCarouselIdx(i => (i + 1) % featuredProducts.length), 4000);
    return () => clearInterval(id);
  }, [featuredProducts.length]);

  const handleShare = async () => {
    const title = liveGame ? `${liveGame.home_team?.name ?? 'TBD'} vs ${liveGame.away_team?.name ?? 'TBD'} — Live on SBBL HQ` : 'SBBL HQ — Live';
    if (navigator.share) {
      try { await navigator.share({ title, url: window.location.href }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  const handleClip = () => { setClipSaved(true); toast.success('Clip saved to your Media library'); setTimeout(() => setClipSaved(false), 2500); };
  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setComments(prev => [...prev, { user: 'You', text }]);
    setChatInput('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  if (homeQuery.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="panel p-8 text-center">
          <Radio className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-muted-foreground">Checking for live games…</p>
        </div>
      </div>
    );
  }

  const gameForPlayer = liveGame ? {
    id: liveGame.id,
    leagueId: (LEAGUE_REGISTRY.find(l => l.code === liveGame.league_code)?.id ?? 'sbbl') as LeagueId,
    homeTeam: { id: liveGame.home_team_id ?? '', name: liveGame.home_team?.name ?? 'Home' },
    awayTeam: { id: liveGame.away_team_id ?? '', name: liveGame.away_team?.name ?? 'Away' },
    venue: liveGame.venue ?? '', court: liveGame.court ?? '',
    date: liveGame.scheduled_at?.split('T')[0] ?? '',
    time: liveGame.scheduled_at?.split('T')[1]?.slice(0, 5) ?? '',
    status: liveGame.status as 'live' | 'upcoming' | 'final',
    score: liveGame.home_score != null && liveGame.away_score != null
      ? { home: liveGame.home_score, away: liveGame.away_score } : undefined,
    ppvPrice: 2.50,
  } : null;

  const sidebar = (
    <div className="space-y-4">
      {carouselProduct && (
        <div className="panel overflow-hidden">
          <div className="relative aspect-square overflow-hidden bg-secondary">
            {carouselProduct.image_url
              ? <img key={carouselProduct.id} src={carouselProduct.image_url} alt={carouselProduct.name} className="w-full h-full object-cover animate-fade-in" loading="lazy" />
              : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-muted-foreground opacity-30" /></div>
            }
            <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider rounded-sm"><Tag className="w-2.5 h-2.5" /> Store</span>
            {featuredProducts.length > 1 && (
              <>
                <button onClick={() => setCarouselIdx(i => (i - 1 + featuredProducts.length) % featuredProducts.length)} className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <button onClick={() => setCarouselIdx(i => (i + 1) % featuredProducts.length)} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
              </>
            )}
          </div>
          <div className="p-4">
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Featured · {carouselIdx + 1}/{featuredProducts.length}</p>
            <p className="font-display font-bold text-sm mt-1 truncate">{carouselProduct.name}</p>
            <button onClick={() => addToBag(carouselProduct.id)} className="mt-3 w-full gold-bg py-2.5 font-display font-bold text-xs uppercase tracking-wider rounded-sm inline-flex items-center justify-center gap-2">
              <ShoppingBag className="w-3.5 h-3.5" />
              {carouselProduct.price > 0 ? `Add to Bag — ₱${carouselProduct.price.toLocaleString()}` : 'Claim Reward'}
            </button>
          </div>
        </div>
      )}
      {gameForPlayer ? (
        <div className="panel p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><Radio className="w-3 h-3 text-primary animate-pulse" /> Live Score</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground truncate">{gameForPlayer.homeTeam.name}</p>
              <p className="stat-numeral text-3xl text-primary">{gameForPlayer.score?.home ?? 0}</p>
            </div>
            <span className="text-xs text-muted-foreground font-bold">VS</span>
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground truncate">{gameForPlayer.awayTeam.name}</p>
              <p className="stat-numeral text-3xl">{gameForPlayer.score?.away ?? 0}</p>
            </div>
          </div>
          {gameForPlayer.venue && <p className="text-[10px] text-muted-foreground text-center mt-2">{gameForPlayer.venue}</p>}
        </div>
      ) : (
        <div className="panel p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><Radio className="w-3 h-3 text-muted-foreground" /> Next Game</p>
          {upcomingGames[0] ? (
            <div>
              <p className="font-display font-bold text-sm text-center">{upcomingGames[0].home_team?.name ?? 'TBD'} vs {upcomingGames[0].away_team?.name ?? 'TBD'}</p>
              {upcomingGames[0].scheduled_at && (
                <p className="text-xs text-muted-foreground mt-2 text-center flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(upcomingGames[0].scheduled_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">No upcoming games</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="lg:container lg:py-4">
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
          <div className="lg:col-span-2 flex flex-col">
            <div className="relative aspect-video bg-muted overflow-hidden lg:rounded-sm">
              {liveGame ? (
                <LiveStreamPlayer game={gameForPlayer as never} userId={user?.id ?? null} roles={roles} token={token} hasPremiumPlayerAccess={hasPremiumPlayerAccess} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-6 px-4 text-center py-24 bg-background">
                  <div className="max-w-md w-full">
                    <Radio className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                    <h1 className="font-display text-2xl font-bold mb-2">No Live Game</h1>
                    <p className="text-sm text-muted-foreground mb-6">No game is in progress right now. Check back when the next game starts.</p>
                    {upcomingGames[0] && (
                      <div className="border border-border rounded-sm p-4 text-left">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Next Game</p>
                        <p className="font-display font-bold text-sm">{upcomingGames[0].home_team?.name ?? 'TBD'} vs {upcomingGames[0].away_team?.name ?? 'TBD'}</p>
                        {upcomingGames[0].scheduled_at && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(upcomingGames[0].scheduled_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        )}
                        {upcomingGames[0].venue && <p className="text-[10px] text-muted-foreground mt-1">{upcomingGames[0].venue}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="container lg:px-0 py-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => setReactions(r => ({ ...r, fire: r.fire + 1 }))} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors">🔥 <span className="stat-numeral">{reactions.fire}</span></button>
                <button onClick={() => setReactions(r => ({ ...r, heart: r.heart + 1 }))} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors">❤️ <span className="stat-numeral">{reactions.heart}</span></button>
                <button onClick={() => setReactions(r => ({ ...r, clap: r.clap + 1 }))} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors">👏 <span className="stat-numeral">{reactions.clap}</span></button>
                <button onClick={handleClip} className={`panel px-3 py-2 text-xs flex items-center gap-1.5 transition-colors ${clipSaved ? 'border-primary/50 text-primary' : 'hover:border-primary/30'}`}>{clipSaved ? <Check className="w-3.5 h-3.5" /> : <Scissors className="w-3.5 h-3.5" />}{clipSaved ? 'Saved' : 'Clip'}</button>
                <button onClick={handleShare} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors"><Share2 className="w-3.5 h-3.5" /> Share</button>
              </div>
              <div className="panel">
                <div className="p-4 border-b border-border flex items-center gap-2"><MessageSquare className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Live Chat</span></div>
                <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                  {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No messages yet — be the first to cheer!</p>}
                  {comments.map((c, i) => (<div key={i} className="flex gap-2"><span className="text-xs font-semibold shrink-0 text-primary">{c.user}</span><span className="text-xs text-foreground">{c.text}</span></div>))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }} placeholder={user ? 'Send a message…' : 'Sign in to chat'} disabled={!user} className="flex-1 bg-secondary px-3 py-2 text-xs rounded-sm border border-border focus:outline-none focus:border-primary/50 disabled:opacity-50" />
                  <button onClick={handleSendChat} disabled={!chatInput.trim() || !user} className="px-3 py-2 text-xs bg-primary text-primary-foreground rounded-sm font-medium disabled:opacity-40 transition-opacity">Send</button>
                </div>
              </div>
              <div className="lg:hidden">{sidebar}</div>
            </div>
          </div>
          <div className="hidden lg:block sticky top-[73px]">{sidebar}</div>
        </div>
      </div>
      <CASLNudge roles={roles} />
    </div>
  );
};

export default LivePage;
