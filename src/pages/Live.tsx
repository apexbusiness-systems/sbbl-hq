import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { players, products } from '@/data/mock';
import { LiveStreamPlayer } from '@/components/LiveStreamPlayer';
import { CASLNudge } from '@/components/CASLNudge';
import { fetchPublicHome } from '@/lib/api/public';
import { fetchStreamComments, postStreamComment } from '@/lib/api/stream';
import {
  MessageSquare, Share2, Scissors, ShoppingBag, Check,
  ChevronLeft, ChevronRight, Tag, ChevronDown, ChevronUp,
  Radio, Eye, DollarSign, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Game } from '@/types';

// ── Admin Stream Controls (collapsible panel) ─────────────────────────────
// Visible only to super_admin. Manages stream state passed to LiveStreamPlayer
// via props — no embed logic duplicated here.
function AdminStreamControls({
  isLive, setIsLive,
  streamTitle, setStreamTitle,
  viewerCount,
  streamSource, setStreamSource,
  customStreamUrl, setCustomStreamUrl,
}: {
  isLive: boolean;
  setIsLive: (v: boolean) => void;
  streamTitle: string;
  setStreamTitle: (v: string) => void;
  viewerCount: number;
  streamSource: 'custom' | 'cloudflare';
  setStreamSource: (v: 'custom' | 'cloudflare') => void;
  customStreamUrl: string;
  setCustomStreamUrl: (v: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="panel border-primary/30 mb-4 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-sm uppercase tracking-wider">Super Admin</span>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isLive ? 'bg-red-500/20 text-red-400' : 'bg-secondary text-muted-foreground'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-muted-foreground'}`} />
            {isLive ? 'Live' : 'Offline'}
          </span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Controls — collapsible */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-4 border-t border-border">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 pt-3">
            <div className="text-center p-2 bg-secondary/50 rounded-sm">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Radio className="w-3 h-3 text-muted-foreground" />
              </div>
              <p className="stat-numeral text-lg">{isLive ? 'LIVE' : 'OFF'}</p>
              <p className="text-[9px] text-muted-foreground uppercase">Stream</p>
            </div>
            <div className="text-center p-2 bg-secondary/50 rounded-sm">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Eye className="w-3 h-3 text-muted-foreground" />
              </div>
              <p className="stat-numeral text-lg">{viewerCount}</p>
              <p className="text-[9px] text-muted-foreground uppercase">Viewers</p>
            </div>
            <div className="text-center p-2 bg-secondary/50 rounded-sm">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="w-3 h-3 text-muted-foreground" />
              </div>
              <p className="stat-numeral text-lg">0</p>
              <p className="text-[9px] text-muted-foreground uppercase">PPV Rev</p>
            </div>
          </div>

          {/* Stream settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Custom Stream URL (ReactPlayer)</label>
              <input
                type="text"
                value={customStreamUrl}
                onChange={e => setCustomStreamUrl(e.target.value)}
                className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                placeholder="e.g. https://youtu.be/..."
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const nextLive = !isLive;
                try {
                  const { setStreamLive, updateStreamConfig } = await import('@/lib/api/stream');
                  const token = await import('@/lib/api/client').then(m => m.getAuthToken());
                  
                  // Save the twitch URL
                  await updateStreamConfig({ collectionId: customStreamUrl }, token);
                  // Set database live status
                  await setStreamLive(nextLive, token);
                  
                  setIsLive(nextLive);
                  toast.success(nextLive ? 'Stream set to live' : 'Stream set to offline');
                } catch (err) {
                  toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
              className={`flex-1 py-2.5 font-display font-bold text-sm uppercase tracking-wider rounded-sm transition-colors ${
                isLive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              {isLive ? 'End Stream' : 'Go Live'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Live Page ─────────────────────────────────────────────────────────
const LivePage = () => {
  const { addToBag, hasPremiumPlayerAccess } = useApp();
  const { user, session, roles } = useAuth();
  const token = session?.access_token ?? null;
  const isSuperAdmin = roles.includes('super_admin');
  const [liveGame, setLiveGame] = useState<Game | null>(null);

  // Admin stream state — fetched from backend
  const [isStreamLive, setIsStreamLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState('Live Game Broadcast');
  const [viewerCount, setViewerCount] = useState(0);
  const [streamSource, setStreamSource] = useState<'custom' | 'cloudflare'>('custom');
  const [customStreamUrl, setCustomStreamUrl] = useState('');
  const mapHomeGameToUi = (row: Record<string, unknown>): Game => {
    const homeTeam = (row.home_team as Record<string, unknown> | null) ?? {};
    const awayTeam = (row.away_team as Record<string, unknown> | null) ?? {};
    const leagueCode = String(row.league_code ?? 'SBBL').toLowerCase();
    const leagueId = leagueCode === 'wbl' ? 'wbl' : leagueCode === 'tgifbl' ? 'tgifbl' : 'sbbl';
    return {
      id: String(row.id),
      leagueId,
      homeTeam: {
        id: String(row.home_team_id ?? 'home'),
        name: String(homeTeam.name ?? 'Home'),
        leagueId,
        division: 'N/A',
        record: { wins: 0, losses: 0 },
      },
      awayTeam: {
        id: String(row.away_team_id ?? 'away'),
        name: String(awayTeam.name ?? 'Away'),
        leagueId,
        division: 'N/A',
        record: { wins: 0, losses: 0 },
      },
      venue: String(row.venue ?? 'TBA'),
      court: String(row.court ?? 'Main Court'),
      date: String(row.scheduled_at ?? ''),
      time: String(row.scheduled_at ?? ''),
      status: String(row.status ?? 'upcoming') as Game['status'],
      score: {
        home: Number(row.home_score ?? 0),
        away: Number(row.away_score ?? 0),
      },
      ppvPrice: 4.99,
    };
  };

  // Auto-sync stream status from backend
  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const home = await fetchPublicHome();
        const liveRows = (home.data?.liveGames ?? []) as Array<Record<string, unknown>>;
        const upcomingRows = (home.data?.upcomingGames ?? []) as Array<Record<string, unknown>>;
        const selected = liveRows[0] ?? upcomingRows[0] ?? null;
        if (active && selected) setLiveGame(mapHomeGameToUi(selected));
        if (isSuperAdmin) {
          // Admin needs full config
          const { fetchAdminStreamConfig } = await import('@/lib/api/stream');
          const res = await fetchAdminStreamConfig(token);
          if (active && res?.config) {
            setIsStreamLive(res.config.isLive);
            setStreamTitle(res.config.title);
            setCustomStreamUrl(res.config.collectionId || ''); // Repurposing collectionId for Stream URL
          }
        } else {
          // Public poller
          const { fetchPublicStreamStatus } = await import('@/lib/api/stream');
          const res = await fetchPublicStreamStatus();
          if (active && res) {
            setIsStreamLive(res.isLive);
            setStreamTitle(res.title);
            setViewerCount(res.viewerCount);
          }
        }
      } catch (err) {
        // silently ignore poller errors
      }
    };
    
    void fetchStatus();
    // Poll every 15 seconds for viewers
    const id = setInterval(fetchStatus, 15000);
    return () => { active = false; clearInterval(id); };
  }, [isSuperAdmin, token]);

  const [comments, setComments] = useState<Array<{ id: string; user: string; text: string }>>([]);
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

  useEffect(() => {
    if (!liveGame?.id) return;
    let active = true;
    const fetchComments = async () => {
      try {
        const res = await fetchStreamComments(liveGame.id, 60);
        if (!active) return;
        setComments(res.comments.map((comment) => ({
          id: comment.id,
          user: comment.userDisplayName ?? 'Fan',
          text: comment.message,
        })));
      } catch {
        // non-blocking for playback UX
      }
    };
    void fetchComments();
    const id = setInterval(fetchComments, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [liveGame?.id]);

  const handleShare = async () => {
    if (!liveGame) return;
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
    if (!text || !liveGame?.id || !token) return;
    void postStreamComment(liveGame.id, text, token)
      .then((res) => {
        setComments(prev => [...prev, {
          id: res.comment.id,
          user: 'You',
          text: res.comment.message,
        }]);
        setChatInput('');
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'chat_failed';
        if (message === 'rate_limited') {
          toast.error('Chat is rate-limited. Please slow down.');
        } else {
          toast.error('Could not send message.');
        }
      });
  };

  const sidebar = (
    <div className="space-y-4">
      {/* Featured Merch Carousel */}
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
      <div className="lg:container lg:py-4">
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

          {/* LEFT: admin controls + broadcast area + actions + chat */}
          <div className="lg:col-span-2 flex flex-col">

            {/* Admin stream controls — super_admin only */}
            {isSuperAdmin && (
              <div className="container lg:px-0 pt-4 lg:pt-0">
                <AdminStreamControls
                  isLive={isStreamLive}
                  setIsLive={setIsStreamLive}
                  streamTitle={streamTitle}
                  setStreamTitle={setStreamTitle}
                  viewerCount={viewerCount}
                  streamSource={streamSource}
                  setStreamSource={setStreamSource}
                  customStreamUrl={customStreamUrl}
                  setCustomStreamUrl={setCustomStreamUrl}
                />
              </div>
            )}

            {/* Broadcast Area — access-gate logic lives inside LiveStreamPlayer */}
            <div className="relative aspect-video bg-muted overflow-hidden lg:rounded-sm">
              {liveGame ? (
                <LiveStreamPlayer
                  game={liveGame}
                  userId={user?.id ?? null}
                  roles={roles}
                  token={token}
                  hasPremiumPlayerAccess={hasPremiumPlayerAccess}
                  isStreamLive={isStreamLive}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Loading live game data…
                </div>
              )}
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
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
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
                    disabled={!chatInput.trim() || !token || !liveGame?.id}
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
