import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { getAuthToken } from '@/lib/api/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { games, players, products } from '@/data/mock';
import { LiveStreamPlayer } from '@/components/LiveStreamPlayer';
import { CASLNudge } from '@/components/CASLNudge';
import { fetchPublicStreamStatus, fetchAdminStreamConfig, updateStreamConfig, setStreamLive } from '@/lib/api/stream';
import { MessageSquare, Share2, Scissors, ShoppingBag, Check, ChevronLeft, ChevronRight, Tag, ChevronDown, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const LivePage = () => {
  const { addToBag, hasPremiumPlayerAccess } = useApp();
  const { user, session, roles } = useAuth();
  const token = session?.access_token ?? null;
  const queryClient = useQueryClient();
  const isSuperAdmin = roles.includes('super_admin');

  // ── Stream admin dropdown state ──────────────────────────────────────
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [adminStreamForm, setAdminStreamForm] = useState({
    collectionId: '',
    title: '',
    source: 'main' as 'main' | 'backup' | 'test',
  });

  const streamStatusQuery = useQuery({
    queryKey: ['live-stream-status'],
    queryFn: () => fetchPublicStreamStatus(),
    refetchInterval: 15_000,
  });

  const streamConfigQuery = useQuery({
    queryKey: ['live-stream-config'],
    queryFn: async () => fetchAdminStreamConfig(await getAuthToken()),
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    const cfg = streamConfigQuery.data?.config;
    if (!cfg) return;
    setAdminStreamForm(prev => {
      if (
        prev.collectionId === cfg.collectionId &&
        prev.title === cfg.title &&
        prev.source === cfg.source
      ) return prev;
      return { collectionId: cfg.collectionId, title: cfg.title, source: cfg.source };
    });
  }, [streamConfigQuery.data?.config]);

  const streamConfigMutation = useMutation({
    mutationFn: async () => updateStreamConfig(adminStreamForm, await getAuthToken()),
    onSuccess: async (res) => {
      setAdminStreamForm({
        collectionId: res.config.collectionId,
        title: res.config.title,
        source: res.config.source,
      });
      await queryClient.invalidateQueries({ queryKey: ['live-stream-config'] });
      await queryClient.invalidateQueries({ queryKey: ['live-stream-status'] });
      toast.success('Stream config saved');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save config'),
  });

  const streamLiveMutation = useMutation({
    mutationFn: async (nextLive: boolean) => setStreamLive(nextLive, await getAuthToken()),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['live-stream-status'] });
      await queryClient.invalidateQueries({ queryKey: ['live-stream-config'] });
      toast.success(res.isLive ? 'Stream is now LIVE' : 'Stream ended — viewers see offline screen');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update live status'),
  });

  const isLive = streamStatusQuery.data?.isLive ?? false;
  const viewerCount = streamStatusQuery.data?.viewerCount ?? 0;

  const liveGame = games.find(g => g.status === 'live') || games[0];

  const [comments, setComments] = useState<{ user: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState({ fire: 0, heart: 0, clap: 0 });
  const [clipSaved, setClipSaved] = useState(false);
  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<{ ok: boolean; data: typeof players }>('/api/stats'),
    enabled: !!session,
    retry: 1,
    staleTime: 30_000,
  });
  const topPerformers = useMemo(() => {
    const apiData = statsQuery.data?.data;
    const source = (Array.isArray(apiData) && apiData.length > 0 && 'stats' in (apiData[0] ?? {})) ? apiData : players;
    return source.filter(p => p.teamId === liveGame.homeTeam.id || p.teamId === liveGame.awayTeam.id).sort((a, b) => b.stats.pts - a.stats.pts).slice(0, 3);
  }, [statsQuery.data, liveGame]);
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

                {/* Stream Admin Dropdown — super_admin only */}
                {isSuperAdmin && (
                  <div className="relative ml-auto">
                    <button
                      onClick={() => setShowAdminDropdown(d => !d)}
                      className="panel px-3 py-2 text-xs flex items-center gap-2 hover:border-primary/30 transition-colors"
                    >
                      {/* Live status pill */}
                      <span className={`flex items-center gap-1.5 font-semibold ${
                        isLive ? 'text-success' : 'text-muted-foreground'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isLive ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                        }`} />
                        {isLive ? 'LIVE' : 'OFFLINE'}
                      </span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${showAdminDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showAdminDropdown && (
                      <div className="absolute bottom-full right-0 mb-2 w-72 bg-card border border-border rounded-sm shadow-2xl z-50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stream Admin</span>
                          <span className="text-[10px] text-muted-foreground">{viewerCount.toLocaleString()} viewers</span>
                        </div>

                        {/* Go Live / End Broadcast */}
                        {showLiveConfirm ? (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {isLive
                                ? 'End the broadcast? Viewers will see the offline screen.'
                                : 'Push stream live to all viewers. Confirm Switcher Studio is ready.'}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowLiveConfirm(false)}
                                className="flex-1 px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-secondary transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                disabled={streamLiveMutation.isPending}
                                onClick={() => {
                                  streamLiveMutation.mutate(!isLive);
                                  setShowLiveConfirm(false);
                                }}
                                className={`flex-1 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-60 ${
                                  isLive
                                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                    : 'bg-success text-black hover:bg-success/90'
                                }`}
                              >
                                {streamLiveMutation.isPending ? '…' : isLive ? 'End Stream' : 'Confirm Live'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowLiveConfirm(true)}
                            className={`w-full py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors ${
                              isLive
                                ? 'bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20'
                                : 'bg-success text-black hover:bg-success/90'
                            }`}
                          >
                            {isLive ? 'End Broadcast' : 'Go Live'}
                          </button>
                        )}

                        {/* Broadcast ID */}
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Broadcast ID</label>
                          <input
                            placeholder="Switcher collection ID"
                            className="w-full bg-secondary border border-border rounded-sm px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
                            value={adminStreamForm.collectionId}
                            onChange={e => setAdminStreamForm(s => ({ ...s, collectionId: e.target.value }))}
                          />
                        </div>

                        {/* Stream Title */}
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Stream Title</label>
                          <input
                            placeholder="Broadcast title"
                            className="w-full bg-secondary border border-border rounded-sm px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
                            value={adminStreamForm.title}
                            onChange={e => setAdminStreamForm(s => ({ ...s, title: e.target.value }))}
                          />
                        </div>

                        {/* Source */}
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Source</label>
                          <select
                            className="w-full bg-secondary border border-border rounded-sm px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
                            value={adminStreamForm.source}
                            onChange={e => setAdminStreamForm(s => ({ ...s, source: e.target.value as 'main' | 'backup' | 'test' }))}
                          >
                            <option value="main">Main</option>
                            <option value="backup">Backup</option>
                            <option value="test">Test</option>
                          </select>
                        </div>

                        {/* Save Config + Open Switcher */}
                        <div className="flex gap-2 pt-1">
                          <button
                            disabled={streamConfigMutation.isPending}
                            onClick={() => streamConfigMutation.mutate()}
                            className="flex-1 gold-bg py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm disabled:opacity-60"
                          >
                            {streamConfigMutation.isPending ? 'Saving…' : 'Save Config'}
                          </button>
                          <button
                            onClick={() => {
                              queryClient.invalidateQueries({ queryKey: ['live-stream-status'] });
                              queryClient.invalidateQueries({ queryKey: ['live-stream-config'] });
                              toast.success('Feed refreshed');
                            }}
                            className="px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-secondary transition-colors"
                            title="Refresh feed"
                          >
                            ↺
                          </button>
                        </div>

                        <button
                          onClick={() => window.open('https://studio.switcherstudio.com', '_blank')}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-sm hover:bg-secondary transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> Open Switcher Studio
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
