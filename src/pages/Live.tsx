import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { games, players, products } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import gameAction from '@/assets/game-action.svg';
import { Lock, Play, MessageSquare, Share2, Scissors, ShoppingBag, Check, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api/client';

type ViewerState = 'locked' | 'preview' | 'purchased';

const LivePage = () => {
  const { addToBag, authRole, hasPremiumPlayerAccess, isAdmin, playerSubscriptionEndsAt } = useApp();
  const { user, session } = useAuth();
  const token = session?.access_token ?? null;
  const [ppvEntitled, setPpvEntitled] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const liveGame = games.find(g => g.status === 'live') || games[0];

  // Derive viewer entitlement from auth — no prototype toggle.
  // Admins and active premium players always have access.
  // Otherwise check for a PPV purchase for this specific game.
  const viewerState = useMemo<ViewerState>(() => {
    if (!user) return 'locked';
    if (isAdmin || hasPremiumPlayerAccess) return 'purchased';
    if (ppvEntitled) return 'purchased';
    return 'preview';
  }, [user, isAdmin, hasPremiumPlayerAccess, ppvEntitled]);

  // Fetch per-game PPV entitlement from worker once we have a logged-in user
  // who doesn't already have full premium access.
  useEffect(() => {
    if (!user || isAdmin || hasPremiumPlayerAccess) return;
    apiFetch<{ entitled: boolean }>(`/api/streams/${liveGame.id}/access`, {}, token)
      .then(res => { if (res.entitled) setPpvEntitled(true); })
      .catch(() => { /* network error — stay in preview */ });
  }, [user?.id, liveGame.id, isAdmin, hasPremiumPlayerAccess, token]);

  const [comments, setComments] = useState([
    { user: 'CourtSide_Fan', text: 'Rivera is on fire tonight!' },
    { user: 'HoopHead23', text: 'That crossover was nasty 🔥' },
    { user: 'SBBL_Official', text: 'Kings lead entering Q4' },
    { user: 'DunkMaster', text: 'Block party at the rim!' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState({ fire: 142, heart: 89, clap: 67 });
  const [clipSaved, setClipSaved] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const featuredProducts = products.filter(p => p.sale);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselProduct = featuredProducts[carouselIdx] ?? products[0];

  useEffect(() => {
    if (featuredProducts.length <= 1) return;
    const id = setInterval(() => setCarouselIdx(i => (i + 1) % featuredProducts.length), 4000);
    return () => clearInterval(id);
  }, [featuredProducts.length]);

  const handleShare = async () => {
    const shareData = {
      title: `${liveGame.homeTeam.name} vs ${liveGame.awayTeam.name} — Live on SBBL HQ`,
      text: `Watch the game live: ${liveGame.score?.home}–${liveGame.score?.away} in Q4`,
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

  // TODO: replace with POST /api/streams/:gameId/purchase → Stripe checkout
  const handlePurchaseAccess = () => {
    toast.info('Payment integration coming soon. Contact league admin for access.');
  };

  const sidebar = (
    <div className="space-y-4">
      {/* Featured Merch Carousel — sale items, eye-level with video */}
      {featuredProducts.length > 0 && (
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
              {carouselProduct.price > 0 ? `Add to Bag — ₱${carouselProduct.price.toLocaleString()}` : 'Claim Reward'}
            </button>
          </div>
        </div>
      )}

      {/* Top Performers */}
      <div className="panel p-4">
        <h3 className="font-display font-bold text-sm mb-3">Top Performers</h3>
        {players.slice(0, 3).map(p => (
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

  return (
    <div className="min-h-screen">
      {/*
        Desktop layout: 3-col grid
          - Left 2 cols: video stacked above actions+chat
          - Right 1 col: sticky merch sidebar always visible beside video
        Mobile: single column, sidebar below chat
      */}
      <div className="lg:container lg:py-4">
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

          {/* LEFT: video + actions + chat */}
          <div className="lg:col-span-2 flex flex-col">

            {/* Broadcast Area */}
            <div className="relative aspect-video bg-muted overflow-hidden lg:rounded-sm">
              {viewerState === 'locked' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background px-4 text-center">
                  <Lock className="w-12 h-12 text-muted-foreground mb-4" />
                  <h2 className="font-display text-2xl font-bold mb-2">Sign In to Watch</h2>
                  <p className="text-sm text-muted-foreground mb-4">You need an account to access live streams.</p>
                  <Link to="/login" className="gold-bg px-6 py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm">
                    Sign In
                  </Link>
                </div>
              ) : viewerState === 'preview' ? (
                <div className="absolute inset-0">
                  <img src={gameAction} alt="Game preview" className="w-full h-full object-cover opacity-40" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    <LeagueBadge leagueId={liveGame.leagueId} size="md" />
                    <div className="mt-4 mb-2">
                      <span className="stat-numeral text-4xl md:text-5xl">{liveGame.homeTeam.name}</span>
                      <span className="stat-numeral text-4xl md:text-5xl text-primary mx-4">{liveGame.score?.home} — {liveGame.score?.away}</span>
                      <span className="stat-numeral text-4xl md:text-5xl">{liveGame.awayTeam.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-6">{liveGame.venue} · {liveGame.court} · Q4 8:42</p>
                    <div className="flex flex-col items-center gap-3">
                      {hasPremiumPlayerAccess && authRole === 'player' ? (
                        // Should not normally reach preview if premium — belt-and-suspenders
                        <button disabled className="gold-bg px-8 py-3.5 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center gap-2 opacity-80">
                          <Play className="w-4 h-4" /> Free Player Access Unlocked
                        </button>
                      ) : (
                        <button
                          disabled={purchasing}
                          onClick={async () => {
                            setPurchasing(true);
                            try {
                              const res = await apiFetch<{ url: string }>(`/api/streams/${liveGame.id}/purchase`, { method: 'POST' }, token);
                              if (res.url) window.location.href = res.url;
                            } catch {
                              toast.error('Could not start checkout. Please try again.');
                            } finally {
                              setPurchasing(false);
                            }
                          }}
                          className="gold-bg px-8 py-3.5 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center gap-2 disabled:opacity-60"
                        >
                          <Play className="w-4 h-4" /> {purchasing ? 'Redirecting…' : `Purchase Access — $${liveGame.ppvPrice.toFixed(2)}`}
                        </button>
                      )}
                      <p className="text-[11px] text-muted-foreground max-w-xs">
                        Session-bound access. Do not share your stream link. Account watermark applied.
                      </p>
                      {authRole === 'player' && (
                        <p className="text-[11px] text-muted-foreground">
                          Player tier: {hasPremiumPlayerAccess ? `active through ${playerSubscriptionEndsAt ? new Date(playerSubscriptionEndsAt).toLocaleDateString() : 'this cycle'}` : 'inactive (renew in Billing for free monthly livestream access)'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0">
                  <img src={gameAction} alt="Live game" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 panel-glass px-4 py-2 flex items-center gap-4">
                    <LeagueBadge leagueId={liveGame.leagueId} />
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{liveGame.homeTeam.name}</span>
                      <span className="stat-numeral text-xl text-live">{liveGame.score?.home}</span>
                      <span className="text-xs text-muted-foreground">—</span>
                      <span className="stat-numeral text-xl text-live">{liveGame.score?.away}</span>
                      <span className="text-sm font-medium">{liveGame.awayTeam.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
                      <span className="text-[10px] text-live font-semibold uppercase">Live · Q4</span>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 text-[10px] text-foreground/10 font-mono">
                    SESSION-BOUND · ACC-2847
                  </div>
                </div>
              )}
            </div>

            {/* Actions + Chat */}
            <div className="container lg:px-0 py-4 space-y-4">
              {/* Actions Bar */}
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

              {/* Mobile-only sidebar (below chat on small screens) */}
              <div className="lg:hidden">{sidebar}</div>
            </div>
          </div>

          {/* RIGHT: sticky sidebar — always visible beside video on desktop */}
          <div className="hidden lg:block sticky top-[73px]">
            {sidebar}
          </div>

        </div>
      </div>
    </div>
  );
};

export default LivePage;
