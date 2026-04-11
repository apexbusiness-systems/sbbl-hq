import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useBag } from '@/contexts/BagContext';
import { useAuth } from '@/hooks/use-auth';
import { getSupabaseClient } from '@/lib/supabase/client';
import { apiFetch, getAuthToken } from '@/lib/api/client';
import { games, players, products } from '@/data/mock';
import { LiveStreamPlayer } from '@/components/LiveStreamPlayer';
import { PlayerErrorBoundary } from '@/components/PlayerErrorBoundary';
import { CASLNudge } from '@/components/CASLNudge';
import { fetchPublicHome } from '@/lib/api/public';
import {
  fetchAdminStreamConfig,
  fetchPublicStreamStatus,
  fetchStreamComments,
  generateCompCode,
  postStreamComment,
  setStreamLive,
  updateStreamConfig,
} from '@/lib/api/stream';
import {
  MessageSquare, Share2, Scissors, ShoppingBag, Check,
  ChevronLeft, ChevronRight, Tag,
  Radio, Eye, DollarSign, Settings, X, Ticket, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Game, PlayerProfile } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────
const LEAGUE_IDS = ['sbbl', 'wbl', 'tgifbl'];

function mapHomeGameToUi(row: Record<string, unknown>): Game {
  const homeTeam = (row.home_team as Record<string, unknown> | null) ?? {};
  const awayTeam = (row.away_team as Record<string, unknown> | null) ?? {};
  const leagueCode = String(row.league_code ?? 'SBBL').toLowerCase();
  const leagueId = leagueCode === 'wbl' ? 'wbl' : leagueCode === 'tgifbl' ? 'tgifbl' : 'sbbl';
  return {
    id: String(row.id),
    leagueId,
    homeTeam: { id: String(row.home_team_id ?? 'home'), name: String(homeTeam.name ?? 'Home'), leagueId, division: 'N/A', record: { wins: 0, losses: 0 } },
    awayTeam: { id: String(row.away_team_id ?? 'away'), name: String(awayTeam.name ?? 'Away'), leagueId, division: 'N/A', record: { wins: 0, losses: 0 } },
    venue: String(row.venue ?? 'TBA'),
    court: String(row.court ?? 'Main Court'),
    date: String(row.scheduled_at ?? ''),
    time: String(row.scheduled_at ?? ''),
    status: String(row.status ?? 'upcoming') as Game['status'],
    score: { home: Number(row.home_score ?? 0), away: Number(row.away_score ?? 0) },
    ppvPrice: 4.99,
  };
}

// ── Admin Stream Overlay ──────────────────────────────────────────────────
// Single source of truth for stream management. Renders as a gear-icon
// dropdown overlay on the video wrapper — no duplicate controls anywhere.
// Visible only to super_admin.
function AdminStreamOverlay({
  isLive, setIsLive,
  streamTitle, setStreamTitle,
  viewerCount,
  customStreamUrl, setCustomStreamUrl,
  activeGameId,
}: {
  isLive: boolean;
  setIsLive: (v: boolean) => void;
  streamTitle: string;
  setStreamTitle: (v: string) => void;
  viewerCount: number;
  customStreamUrl: string;
  setCustomStreamUrl: (v: string) => void;
  activeGameId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compNote, setCompNote] = useState('');
  const [compHours, setCompHours] = useState('24');
  const [compGenerating, setCompGenerating] = useState(false);
  const [compCode, setCompCode] = useState<string | null>(null);
  const [compExpiresAt, setCompExpiresAt] = useState<string | null>(null);
  const [compCopied, setCompCopied] = useState(false);

  const handleGenerateCompCode = async () => {
    const gameId = activeGameId ?? 'broadcast';
    setCompGenerating(true);
    try {
      const hours = Number(compHours);
      const expiresInHours = Number.isFinite(hours) && hours > 0 ? Math.min(168, hours) : 24;
      const res = await generateCompCode(
        gameId,
        { note: compNote.trim() || undefined, expiresInHours },
        null,
      );
      if (res.ok) {
        setCompCode(res.code);
        setCompExpiresAt(res.expiresAt);
        toast.success('Comp access code generated');
      }
    } catch (err) {
      toast.error(`Could not generate comp code: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCompGenerating(false);
    }
  };

  const handleCopyCompCode = async () => {
    if (!compCode) return;
    await navigator.clipboard.writeText(compCode);
    setCompCopied(true);
    setTimeout(() => setCompCopied(false), 2500);
    toast.success('Comp code copied to clipboard');
  };

  const handleResetCompCode = () => {
    setCompCode(null);
    setCompExpiresAt(null);
    setCompNote('');
    setCompCopied(false);
  };

  const handleGoLive = async () => {
    const nextLive = !isLive;
    setSaving(true);
    try {
      const token = await getAuthToken();
      // Step 1: Save config (URL + title)
      await updateStreamConfig({ collectionId: customStreamUrl, title: streamTitle }, token);
      // Step 2: Toggle live status — if this fails, config is saved but
      // stream state is unchanged. Admin sees the error and can retry
      // the toggle without re-entering the URL.
      try {
        await setStreamLive(nextLive, token);
      } catch (liveErr) {
        toast.error(`Config saved, but live toggle failed: ${liveErr instanceof Error ? liveErr.message : String(liveErr)}. Try again.`);
        setSaving(false);
        return;
      }
      setIsLive(nextLive);
      toast.success(nextLive ? 'Stream is LIVE' : 'Stream ended');
      if (nextLive) setOpen(false);
    } catch (err) {
      toast.error(`Failed to save config: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Gear button — always visible in top-left of video wrapper */}
      <button
        onClick={() => setOpen(o => !o)}
        className="absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors group"
        title="Stream controls"
      >
        <Settings className={`w-4.5 h-4.5 text-white/80 group-hover:text-white transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {/* Live badge — top-right */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${
          isLive ? 'bg-red-600/90 text-white' : 'bg-black/60 text-white/70'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-white/50'}`} />
          {isLive ? 'Live' : 'Offline'}
        </span>
        {viewerCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-black/60 text-white/80 backdrop-blur-sm">
            <Eye className="w-3 h-3" /> {viewerCount}
          </span>
        )}
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-14 left-3 z-30 w-80 max-w-[calc(100%-24px)] bg-black/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-white/90">Broadcast Controls</span>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-1.5 bg-white/5 rounded">
                <Radio className={`w-3 h-3 mx-auto mb-0.5 ${isLive ? 'text-red-400' : 'text-white/40'}`} />
                <p className="stat-numeral text-xs text-white/90">{isLive ? 'LIVE' : 'OFF'}</p>
              </div>
              <div className="text-center p-1.5 bg-white/5 rounded">
                <Eye className="w-3 h-3 mx-auto mb-0.5 text-white/40" />
                <p className="stat-numeral text-xs text-white/90">{viewerCount}</p>
              </div>
              <div className="text-center p-1.5 bg-white/5 rounded">
                <DollarSign className="w-3 h-3 mx-auto mb-0.5 text-white/40" />
                <p className="stat-numeral text-xs text-white/90">$0</p>
              </div>
            </div>

            {/* Stream URL */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-white/50 block mb-1">Stream URL</label>
              <input
                type="text"
                value={customStreamUrl}
                onChange={e => setCustomStreamUrl(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary/50"
                placeholder="YouTube, Twitch, or direct URL…"
              />
            </div>

            {/* Stream Title */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-white/50 block mb-1">Broadcast Title</label>
              <input
                type="text"
                value={streamTitle}
                onChange={e => setStreamTitle(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary/50"
                placeholder="e.g. SBBL Finals Game 3"
              />
            </div>

            {/* Go Live / End Stream — super admin can toggle live at any time,
                even without a URL configured yet. The player handles the
                "no URL configured" state gracefully. */}
            <button
              onClick={handleGoLive}
              disabled={saving}
              className={`w-full py-2.5 font-display font-bold text-xs uppercase tracking-wider rounded transition-colors disabled:opacity-40 ${
                isLive
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              {saving ? 'Saving…' : isLive ? 'End Stream' : 'Go Live'}
            </button>

            {/* ── Comp Access Code Generator ──────────────────────────────
                Super-admin-only widget. Generates an unlimited, single-use,
                IP-locked access code. Redeemer gets the same 6-hour capped,
                one-device-enforced session as a paid PPV purchase. */}
            <div className="border-t border-white/10 pt-3 mt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                  <Ticket className="w-3 h-3" /> Comp Access Code
                </span>
                {compCode && (
                  <button
                    onClick={handleResetCompCode}
                    className="text-[9px] uppercase tracking-wider text-white/40 hover:text-white/70"
                    title="Generate another"
                  >
                    New
                  </button>
                )}
              </div>

              {compCode ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-[11px] text-amber-300 break-all leading-tight">
                      {compCode}
                    </code>
                    <button
                      onClick={handleCopyCompCode}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors shrink-0"
                      title="Copy code"
                      aria-label="Copy comp code"
                    >
                      {compCopied
                        ? <Check className="w-3.5 h-3.5 text-green-400" />
                        : <Copy className="w-3.5 h-3.5 text-white/70" />}
                    </button>
                  </div>
                  {compExpiresAt && (
                    <p className="text-[9px] text-white/50">
                      Redeemable until {new Date(compExpiresAt).toLocaleString()} ·
                      6h session cap · one-device · IP-locked
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={compNote}
                    onChange={e => setCompNote(e.target.value)}
                    maxLength={200}
                    className="w-full bg-white/10 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 mb-2"
                    placeholder="Note (optional) — e.g. 'Comped for J. Smith'"
                  />
                  <div className="flex gap-2 mb-2">
                    <label className="text-[9px] uppercase tracking-wider text-white/40 flex items-center gap-1.5 flex-1">
                      Expires in
                      <input
                        type="number"
                        min={1}
                        max={168}
                        value={compHours}
                        onChange={e => setCompHours(e.target.value)}
                        className="flex-1 bg-white/10 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500/50"
                      />
                      hrs
                    </label>
                  </div>
                  <button
                    onClick={handleGenerateCompCode}
                    disabled={compGenerating}
                    className="w-full py-2 font-display font-bold text-[11px] uppercase tracking-wider rounded bg-amber-500 text-black hover:bg-amber-400 transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                  >
                    <Ticket className="w-3 h-3" />
                    {compGenerating ? 'Generating…' : 'Generate Comp Code'}
                  </button>
                  <p className="text-[9px] text-white/40 mt-1.5 leading-relaxed">
                    Single-use · IP-locked · 6h session · one-device
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Live Page ─────────────────────────────────────────────────────────
const LivePage = () => {
  const { hasPremiumPlayerAccess } = useApp();
  const { addToBag } = useBag();

  // --- Top Performers Carousel Logic ---
  /* eslint-disable @typescript-eslint/no-explicit-any */

  const [activeLeagueIdx, setActiveLeagueIdx] = useState(0);
  // leagueIds is moved outside to avoid dependency array issues

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLeagueIdx((prev) => (prev + 1) % LEAGUE_IDS.length);
    }, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, []);

  const { data: leaderboardsData = [] } = useQuery({
    queryKey: ['public-leaderboards', LEAGUE_IDS[activeLeagueIdx]],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.rpc('get_leaderboards', { p_filters: { league: LEAGUE_IDS[activeLeagueIdx] } });
      return data?.leaders || [];
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });

  const topPerformers = useMemo(() => {
    // leaderboardsData is already sorted by points descending from the RPC.
    return leaderboardsData.slice(0, 3).map((p: any) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar, // the RPC does not currently return avatar_url, but we map what we have or let fallback handle it
      position: p.position || 'N/A',
      pts: p.pts || 0,
      league_id: p.league_id,
    }));
  }, [leaderboardsData]);

  const { user, session, roles } = useAuth();
  const isSuperAdmin = roles.includes('super_admin');
  // Any privileged role (roster player, paid fan, or super admin) gets the
  // camera-only broadcast fallback when the admin has flipped the stream live
  // but no real live game row exists yet. Non-privileged fans still need a
  // real game + PPV entitlement.
  const hasPrivilegedBroadcastAccess =
    roles.includes('player') || roles.includes('paid_fan') || isSuperAdmin;
  const [liveGame, setLiveGame] = useState<Game | null>(null);

  // Admin stream state — fetched from backend (single source of truth)
  const [isStreamLive, setIsStreamLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState('Live Game Broadcast');
  const [viewerCount, setViewerCount] = useState(0);
  const [customStreamUrl, setCustomStreamUrl] = useState('');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  // Auto-sync stream status from backend
  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const home = await fetchPublicHome();
        const liveRows = (home.data?.liveGames ?? []) as Array<Record<string, unknown>>;
        const upcomingRows = (home.data?.upcomingGames ?? []) as Array<Record<string, unknown>>;
        const selected = liveRows[0] ?? upcomingRows[0] ?? null;
        if (active && selected) {
          setLiveGame(mapHomeGameToUi(selected));
          setActiveGameId(String(selected.id));
        }
        if (isSuperAdmin) {
          // Admin needs full config — pass null so apiFetch uses getAuthToken()
          // which auto-refreshes expired JWTs. Never pass an explicit token from
          // a React closure here; it goes stale and causes endless 401 loops.
          const res = await fetchAdminStreamConfig(null);
          if (active && res?.config) {
            setIsStreamLive(res.config.isLive);
            setStreamTitle(res.config.title);
            setCustomStreamUrl(res.config.collectionId || ''); // collectionId stores the stream URL
          }
        } else {
          // Public poller
          const res = await fetchPublicStreamStatus();
          if (active && res?.ok) {
            setIsStreamLive(Boolean(res.isLive));
            setStreamTitle(typeof res.title === 'string' ? res.title : 'Live Game Broadcast');
            setViewerCount(typeof res.viewerCount === 'number' && res.viewerCount >= 0 ? res.viewerCount : 0);
          }
        }
      } catch {
        // Poller errors are non-fatal; next tick retries with a fresh token.
      }
    };

    void fetchStatus();
    // Poll every 15 seconds for viewers
    const id = setInterval(fetchStatus, 15000);
    return () => { active = false; clearInterval(id); };
  }, [isSuperAdmin]);

  const [comments, setComments] = useState<Array<{ id: string; user: string; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');

  // ── Real reactions (persisted + Realtime-broadcast) ──────────────────────
  const [reactions, setReactions] = useState({ fire: 0, heart: 0, clap: 0 });

  // Fetch initial counts whenever the active game is known
  useEffect(() => {
    if (!activeGameId) return;
    void apiFetch<{ ok: boolean; fire: number; heart: number; clap: number }>(
      `/api/streams/${activeGameId}/reactions`,
    ).then(data => {
      if (data.ok) setReactions({ fire: data.fire, heart: data.heart, clap: data.clap });
    }).catch(() => {});
  }, [activeGameId]);

  // Subscribe to Supabase Realtime — broadcast every new reaction to all viewers
  useEffect(() => {
    if (!activeGameId) return;
    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel(`stream-reactions-${activeGameId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_reactions', filter: `game_id=eq.${activeGameId}` },
        (payload) => {
          const type = (payload.new as { reaction_type: string }).reaction_type as 'fire' | 'heart' | 'clap';
          if (['fire', 'heart', 'clap'].includes(type)) {
            setReactions(r => ({ ...r, [type]: r[type] + 1 }));
          }
        },
      )
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }, [activeGameId]);

  const postReaction = useCallback(async (type: 'fire' | 'heart' | 'clap') => {
    // Optimistic update immediately
    setReactions(r => ({ ...r, [type]: r[type] + 1 }));
    // Persist to DB (auth required; silently skip if not signed in)
    if (!user?.id || !activeGameId || !session) return;
    try {
      await apiFetch(`/api/streams/${activeGameId}/react`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
    } catch {
      // non-critical — optimistic update already applied
    }
  }, [activeGameId, user?.id, session]);

  const fallbackBroadcastGame = useMemo<Game | null>(() => {
    // Camera-only live mode has no real game row; use "broadcast" alias routes.
    // Accessible to any privileged role (player, paid_fan, super_admin). Regular
    // fans still see "No Active Broadcast" and must wait for a real game + PPV.
    if (!hasPrivilegedBroadcastAccess || !isStreamLive || liveGame) return null;
    return {
      id: 'broadcast',
      leagueId: 'sbbl',
      homeTeam: { id: 'broadcast-home', name: 'SBBL', leagueId: 'sbbl', division: 'N/A', record: { wins: 0, losses: 0 } },
      awayTeam: { id: 'broadcast-away', name: 'Live', leagueId: 'sbbl', division: 'N/A', record: { wins: 0, losses: 0 } },
      venue: 'SBBL HQ',
      court: 'Main Feed',
      date: new Date().toISOString(),
      time: new Date().toISOString(),
      status: 'live',
      score: { home: 0, away: 0 },
      ppvPrice: 0,
    };
  }, [hasPrivilegedBroadcastAccess, isStreamLive, liveGame]);
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
    if (!text || !liveGame?.id || !session) return;
    void postStreamComment(liveGame.id, text, null)
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
              className="w-full h-full object-contain animate-fade-in"
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
        {topPerformers.length > 0 ? topPerformers.map((p: PlayerProfile | any) => (
          <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <PlayerAvatar src={p.avatar} alt={p.name} className="w-8 h-8" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                 <p className="text-xs font-medium truncate">{p.name || 'Unknown Player'}</p>
                 <span className="text-[8px] px-1 py-0.5 rounded-sm bg-muted text-muted-foreground uppercase">{p.league_id}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{p.position}</p>
            </div>
            <span className="stat-numeral text-sm text-primary">{p.pts ? p.pts.toFixed(1) : '0.0'} PTS</span>
          </div>
        )) : (
          <div className="text-xs text-muted-foreground py-4 text-center">Loading players...</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="lg:container lg:py-4">
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

          {/* LEFT: broadcast area + actions + chat */}
          <div className="lg:col-span-2 flex flex-col">

            {/* Broadcast Area — admin overlay + access-gate player */}
            <div className="relative aspect-video bg-muted overflow-hidden lg:rounded-sm">
              {/* Admin stream overlay — inside the video wrapper, super_admin only */}
              {isSuperAdmin && (
                  <AdminStreamOverlay
                    isLive={isStreamLive}
                    setIsLive={setIsStreamLive}
                    streamTitle={streamTitle}
                    setStreamTitle={setStreamTitle}
                    viewerCount={viewerCount}
                    customStreamUrl={customStreamUrl}
                    setCustomStreamUrl={setCustomStreamUrl}
                    activeGameId={activeGameId}
                  />
                )}

              {(liveGame || fallbackBroadcastGame) ? (
                <PlayerErrorBoundary>
                  <LiveStreamPlayer
                    game={(liveGame ?? fallbackBroadcastGame)!}
                    userId={user?.id ?? null}
                    roles={roles}
                    hasPremiumPlayerAccess={hasPremiumPlayerAccess}
                    isStreamLive={isStreamLive}
                  />
                </PlayerErrorBoundary>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-black/80 px-6">
                  <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center mb-3">
                    <Radio className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-white/70 font-medium">No Active Broadcast</p>
                  <p className="text-xs text-white/40 mt-1">Check back when a game is scheduled or a stream goes live.</p>
                </div>
              )}
            </div>

            {/* Actions + Chat */}
            <div className="container lg:px-0 py-4 space-y-4">
              {/* Reaction bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => postReaction('fire')} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors">
                  🔥 <span className="stat-numeral">{reactions.fire}</span>
                </button>
                <button onClick={() => postReaction('heart')} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors">
                  ❤️ <span className="stat-numeral">{reactions.heart}</span>
                </button>
                <button onClick={() => postReaction('clap')} className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors">
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
                    disabled={!chatInput.trim() || !session || !liveGame?.id}
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
