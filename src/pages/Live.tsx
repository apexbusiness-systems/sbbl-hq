import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { games, players, products } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import gameAction from '@/assets/game-action.jpg';
import { Lock, Play, MessageSquare, Share2, Scissors, Heart, ShoppingBag, AlertTriangle } from 'lucide-react';

type ViewerState = 'locked' | 'preview' | 'purchased';

const LivePage = () => {
  const { addToBag, authRole, hasPremiumPlayerAccess, playerSubscriptionEndsAt } = useApp();
  const [viewerState, setViewerState] = useState<ViewerState>('preview');
  const liveGame = games.find(g => g.status === 'live') || games[0];
  const [comments] = useState([
    { user: 'CourtSide_Fan', text: 'Rivera is on fire tonight!' },
    { user: 'HoopHead23', text: 'That crossover was nasty 🔥' },
    { user: 'SBBL_Official', text: 'Kings lead entering Q4' },
    { user: 'DunkMaster', text: 'Block party at the rim!' },
  ]);
  const [reactions, setReactions] = useState({ fire: 142, heart: 89, clap: 67 });

  return (
    <div className="min-h-screen">
      {/* Broadcast Area */}
      <div className="relative aspect-video max-h-[65vh] bg-muted overflow-hidden">
        {viewerState === 'locked' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background">
            <Lock className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="font-display text-2xl font-bold mb-2">Pay-Per-View Access Required</h2>
            <p className="text-sm text-muted-foreground mb-4">Unlock this live game for just ${liveGame.ppvPrice.toFixed(2)}</p>
            <button onClick={() => setViewerState('preview')} className="gold-bg px-6 py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm">
              Preview Game
            </button>
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
                  <button onClick={() => setViewerState('purchased')} className="gold-bg px-8 py-3.5 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center gap-2">
                    <Play className="w-4 h-4" /> Free Player Access Unlocked
                  </button>
                ) : (
                  <button onClick={() => setViewerState('purchased')} className="gold-bg px-8 py-3.5 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center gap-2">
                    <Play className="w-4 h-4" /> Purchase Access — ${liveGame.ppvPrice.toFixed(2)}
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
            {/* Scorebug */}
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
            {/* Anti-leak watermark */}
            <div className="absolute top-4 right-4 text-[10px] text-foreground/10 font-mono">
              SESSION-BOUND · ACC-2847
            </div>
          </div>
        )}
      </div>

      <div className="container py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
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
            <button className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors"><Scissors className="w-3.5 h-3.5" /> Clip</button>
            <button className="panel px-3 py-2 text-xs flex items-center gap-1.5 hover:border-primary/30 transition-colors"><Share2 className="w-3.5 h-3.5" /> Share</button>
          </div>

          {/* State toggle for prototype */}
          <div className="panel p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Prototype: Entitlement State</p>
            <div className="flex gap-2">
              {(['locked', 'preview', 'purchased'] as ViewerState[]).map(s => (
                <button key={s} onClick={() => setViewerState(s)} className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${viewerState === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="panel">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Live Chat</span>
            </div>
            <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
              {comments.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-xs font-semibold text-primary shrink-0">{c.user}</span>
                  <span className="text-xs text-foreground">{c.text}</span>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border">
              <input type="text" placeholder="Send a message..." className="w-full bg-secondary px-3 py-2 text-xs rounded-sm border border-border focus:outline-none focus:border-primary/50" />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Notable Stats */}
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

          {/* Merch CTA */}
          <div className="panel overflow-hidden">
            <img src={products[0].image} alt={products[0].name} className="w-full aspect-square object-cover" loading="lazy" />
            <div className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Featured Merch</p>
              <p className="font-display font-bold text-sm mt-1">{products[0].name}</p>
              <button onClick={() => addToBag(products[0].id)} className="mt-3 w-full gold-bg py-2.5 font-display font-bold text-xs uppercase tracking-wider rounded-sm inline-flex items-center justify-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5" /> Add to Bag — ₱{products[0].price.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePage;
