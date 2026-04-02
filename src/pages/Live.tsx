import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { games, players, products } from '@/data/mock';
import { LiveStreamPlayer } from '@/components/LiveStreamPlayer';
import { CASLNudge } from '@/components/CASLNudge';
import {
  MessageSquare, Share2, Scissors, ShoppingBag, Check,
  ChevronLeft, ChevronRight, Tag, ChevronDown, ChevronUp,
  Radio, Eye, DollarSign, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Admin Stream Controls (collapsible panel) ─────────────────────────────
// Visible only to super_admin. Manages stream state passed to LiveStreamPlayer
// via props — no embed logic duplicated here.
function AdminStreamControls({
  isLive, setIsLive,
  streamTitle, setStreamTitle,
  viewerCount,
}: {
  isLive: boolean;
  setIsLive: (v: boolean) => void;
  streamTitle: string;
  setStreamTitle: (v: string) => void;
  viewerCount: number;
  streamSource: 'switcher' | 'custom';
  setStreamSource: (v: 'switcher' | 'custom') => void;
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
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Stream Source</label>
              <select
                value={streamSource}
                onChange={e => setStreamSource(e.target.value as 'switcher' | 'custom')}
                className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              >
                <option value="switcher">Switcher Studio Embed</option>
                <option value="custom">Custom URL (YouTube/HLS)</option>
              </select>
            </div>
            {streamSource === 'custom' ? (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Custom Stream URL</label>
                <input
                  type="text"
                  value={customStreamUrl}
                  onChange={e => setCustomStreamUrl(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                  placeholder="e.g. https://youtu.be/..."
                />
              </div>
            ) : (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Stream Title</label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={e => setStreamTitle(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                  placeholder="Live Game Broadcast"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsLive(!isLive);
                toast.success(isLive ? 'Stream set to offline' : 'Stream set to live');
              }}
              className={`flex-1 py-2.5 font-display font-bold text-sm uppercase tracking-wider rounded-sm transition-colors ${
                isLive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              {isLive ? 'End Stream' : 'Go Live'}
            </button>
            <a
              href="https://app.switcherstudio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 bg-secondary border border-border rounded-sm text-xs font-medium inline-flex items-center gap-1.5 hover:border-primary/30 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Switcher Studio
            </a>
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

  const liveGame = games.find(g => g.status === 'live') || games[0];

  // Admin stream state — passed to LiveStreamPlayer via props
  const [isStreamLive, setIsStreamLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState('Live Game Broadcast');
  const [viewerCount] = useState(0);
  const [streamSource, setStreamSource] = useState<'switcher' | 'custom'>('switcher');
  const [customStreamUrl, setCustomStreamUrl] = useState('');

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
              <LiveStreamPlayer
                game={liveGame}
                userId={user?.id ?? null}
                roles={roles}
                token={token}
                hasPremiumPlayerAccess={hasPremiumPlayerAccess}
                isStreamLive={isStreamLive}
                streamSource={streamSource}
                customStreamUrl={customStreamUrl}
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
