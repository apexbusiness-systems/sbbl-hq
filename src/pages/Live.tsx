import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { fetchPublicStreamStatus, fetchAdminStreamConfig, updateStreamConfig, setStreamLive } from '@/lib/api/stream';
import { getAuthToken } from '@/lib/api/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { games, players, products } from '@/data/mock';
import { LiveStreamPlayer } from '@/components/LiveStreamPlayer';
import { CASLNudge } from '@/components/CASLNudge';
import { MessageSquare, Share2, Scissors, ShoppingBag, Check, ChevronLeft, ChevronRight, Tag, Settings2, ExternalLink, Radio, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const LivePage = () => {
  const queryClient = useQueryClient();
  const { addToBag, hasPremiumPlayerAccess } = useApp();
  const { user, session, roles } = useAuth();
  const token = session?.access_token ?? null;
  const isSuperAdmin = roles.includes('super_admin');

  const liveGame = games.find(g => g.status === 'live') || games[0];

  // ── Stream status (public — no auth) ──────────────────────────────────────────────
  const streamStatusQuery = useQuery({
    queryKey: ['stream-status', liveGame.id],
    queryFn: () => fetchPublicStreamStatus(liveGame.id),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
  const collectionId = streamStatusQuery.data?.collectionId ?? '0fea533c-e97a-42e7-9424-48499ea1b81c';
  const isStreamLive = streamStatusQuery.data?.isLive ?? false;
  const viewerCount  = streamStatusQuery.data?.viewerCount ?? 0;

  // ── Admin config (super_admin only) ────────────────────────────────────────────
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({ collectionId: '', title: '', source: 'main' as 'main' | 'backup' | 'test' });
  const [showGoLiveConfirm, setShowGoLiveConfirm] = useState(false);

  const streamConfigQuery = useQuery({
    queryKey: ['live-stream-config'],
    queryFn: async () => fetchAdminStreamConfig(await getAuthToken()),
    enabled: isSuperAdmin,
  });

  // Sync admin form from DB config
  useEffect(() => {
    const cfg = streamConfigQuery.data?.config;
    if (!cfg) return;
    setAdminForm(prev => {
      if (prev.collectionId === cfg.collectionId && prev.title === cfg.title && prev.source === cfg.source) return prev;
      return { collectionId: cfg.collectionId, title: cfg.title, source: cfg.source };
    });
  }, [streamConfigQuery.data?.config]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => updateStreamConfig(adminForm, await getAuthToken()),
    onSuccess: async (res) => {
      setAdminForm({ collectionId: res.config.collectionId, title: res.config.title, source: res.config.source });
      await queryClient.invalidateQueries({ queryKey: ['live-stream-config'] });
      await queryClient.invalidateQueries({ queryKey: ['stream-status', liveGame.id] });
      toast.success('Stream config saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const goLiveMutation = useMutation({
    mutationFn: async (next: boolean) => setStreamLive(next, await getAuthToken()),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['stream-status', liveGame.id] });
      await queryClient.invalidateQueries({ queryKey: ['live-stream-config'] });
      toast.success(res.isLive ? 'Stream is now LIVE' : 'Stream ended');
      setShowGoLiveConfirm(false);
    },
    onError: (e: Error) => { toast.error(e.message); setShowGoLiveConfirm(false); },
  });

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
                collectionId={collectionId}
              />
            </div>

            {/* Actions + Chat */}
            <div className="container lg:px-0 py-4 space-y-4">
              {/* Reaction bar + Stream Admin Dropdown */}
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
                      onClick={() => setAdminOpen(o => !o)}
                      className={`panel px-3 py-2 text-xs flex items-center gap-1.5 transition-colors ${
                        isStreamLive ? 'border-green-500/50 text-green-400' : 'hover:border-primary/30'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span className="font-semibold uppercase tracking-wide">
                        {isStreamLive ? 'LIVE' : 'OFFLINE'}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {adminOpen && (
                      <div className="absolute bottom-full mb-2 right-0 z-50 w-80 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                            <Settings2 className="w-3 h-3" /> Stream Admin
                          </span>
                          <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${
                            isStreamLive ? 'text-green-500' : 'text-red-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isStreamLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                            }`} />
                            {isStreamLive ? 'Live' : 'Offline'}
                          </div>
                        </div>

                        {/* Go Live / End Broadcast */}
                        <button
                          disabled={goLiveMutation.isPending}
                          onClick={() => setShowGoLiveConfirm(true)}
                          className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-60 ${
                            isStreamLive
                              ? 'bg-red-500/10 text-red-400 border border-red-500/40 hover:bg-red-500/20'
                              : 'bg-green-500 text-black hover:bg-green-400'
                          }`}
                        >
                          {goLiveMutation.isPending ? 'Updating…' : (isStreamLive ? 'End Broadcast' : 'Go Live')}
                        </button>

                        {/* Stats row */}
                        <div className="flex gap-3 pt-1 border-t border-zinc-800/50">
                          <div>
                            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Viewers</p>
                            <p className="font-mono text-sm text-white">{isStreamLive ? viewerCount.toLocaleString() : '—'}</p>
                          </div>
                        </div>

                        {/* Collection ID */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">Switcher Broadcast ID</label>
                          <input
                            type="text"
                            value={adminForm.collectionId}
                            onChange={e => setAdminForm(f => ({ ...f, collectionId: e.target.value }))}
                            placeholder="e.g. 0fea533c-e97a-42e7-..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-zinc-600"
                          />
                        </div>

                        {/* Stream Title */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">Stream Title</label>
                          <input
                            type="text"
                            value={adminForm.title}
                            onChange={e => setAdminForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-zinc-600"
                          />
                        </div>

                        {/* Source */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">Source</label>
                          <select
                            value={adminForm.source}
                            onChange={e => setAdminForm(f => ({ ...f, source: e.target.value as 'main' | 'backup' | 'test' }))}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-zinc-600"
                          >
                            <option value="main">Main Feed</option>
                            <option value="backup">Backup Feed</option>
                            <option value="test">Test Loop</option>
                          </select>
                        </div>

                        {/* Save Config */}
                        <button
                          disabled={saveConfigMutation.isPending}
                          onClick={() => saveConfigMutation.mutate()}
                          className="w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-amber-500 text-black hover:bg-amber-400 transition-colors disabled:opacity-60"
                        >
                          {saveConfigMutation.isPending ? 'Saving…' : 'Save Config'}
                        </button>

                        {/* Quick links */}
                        <div className="flex gap-2 pt-1 border-t border-zinc-800/50">
                          <button
                            onClick={() => window.open('https://studio.switcherstudio.com', '_blank')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-zinc-400 hover:text-white bg-zinc-900 rounded-md transition-colors border border-zinc-800 hover:border-zinc-600"
                          >
                            <ExternalLink className="w-3 h-3" /> Switcher Studio
                          </button>
                          <button
                            onClick={() => window.location.reload()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-zinc-400 hover:text-white bg-zinc-900 rounded-md transition-colors border border-zinc-800 hover:border-zinc-600"
                          >
                            Refresh Feed
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Go Live / End confirmation modal */}
                    {showGoLiveConfirm && (
                      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowGoLiveConfirm(false)}>
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                          <h3 className="font-display font-bold text-lg mb-2">{isStreamLive ? 'End Broadcast?' : 'Go Live?'}</h3>
                          <p className="text-zinc-400 text-sm mb-6">
                            {isStreamLive
                              ? 'This will take the stream offline. All active viewers will see the offline screen.'
                              : 'This pushes the stream live for all viewers. Make sure Switcher Studio is ready and broadcasting.'}
                          </p>
                          <div className="flex justify-end gap-3">
                            <button onClick={() => setShowGoLiveConfirm(false)} className="px-4 py-2 text-sm font-medium hover:bg-zinc-800 rounded-lg transition-colors">
                              Cancel
                            </button>
                            <button
                              disabled={goLiveMutation.isPending}
                              onClick={() => goLiveMutation.mutate(!isStreamLive)}
                              className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-60 ${
                                isStreamLive ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-500 text-black hover:bg-green-400'
                              }`}
                            >
                              {goLiveMutation.isPending ? 'Updating…' : (isStreamLive ? 'End Stream' : 'Confirm Go Live')}
                            </button>
                          </div>
                        </div>
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
