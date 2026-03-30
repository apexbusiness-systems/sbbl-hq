import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mediaAssets } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { useApp } from '@/contexts/AppContext';
import { LeagueId } from '@/types';
import { Play, Share2, Upload, Eye, Clock, Check } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = { draft: 'text-muted-foreground', ready: 'text-warning', published: 'text-success' };

const MediaPage = () => {
  const { activeLeague } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<'all' | 'highlight' | 'clip' | 'poster' | 'photo'>('all');
  const [shareModal, setShareModal] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // League filter — URL param sync, default to active league
  const paramLeague = searchParams.get('league');
  const initialLeague: LeagueId | 'all' =
    paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague))
      ? (paramLeague as LeagueId | 'all')
      : activeLeague;
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(initialLeague);

  useEffect(() => {
    if (paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague))) {
      setLeagueFilter(paramLeague as LeagueId | 'all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLeagueChange = (val: LeagueId | 'all') => {
    setLeagueFilter(val);
    setSearchParams(val === 'all' ? {} : { league: val }, { replace: true });
  };

  const filtered = mediaAssets.filter(m => {
    const leagueMatch = leagueFilter === 'all' || m.leagueId === leagueFilter;
    const typeMatch = typeFilter === 'all' || m.type === typeFilter;
    return leagueMatch && typeMatch;
  });

  const shareAsset = shareModal ? mediaAssets.find(m => m.id === shareModal) : null;
  const activeLeagueObj = leagueFilter !== 'all' ? LEAGUE_REGISTRY.find(l => l.id === leagueFilter) : null;

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/media#${shareModal}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => { setCopied(false); setShareModal(null); }, 1500);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleNativeShare = async () => {
    if (!shareAsset) return;
    const shareData = {
      title: shareAsset.title,
      text: `${shareAsset.title} — SBBL HQ`,
      url: `${window.location.origin}/media#${shareModal}`,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); setShareModal(null); } catch { /* cancelled */ }
    } else {
      await handleCopyLink();
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Media</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {leagueFilter === 'all'
                ? 'Highlights, clips, and editorial content'
                : `${activeLeagueObj?.name ?? leagueFilter.toUpperCase()} media library`}
            </p>
          </div>
        </div>

        {/* League filter */}
        <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit mb-4 overflow-x-auto">
          <button
            onClick={() => handleLeagueChange('all')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap ${leagueFilter === 'all' ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All Org
          </button>
          {LEAGUE_REGISTRY.map(l => (
            <button
              key={l.id}
              onClick={() => handleLeagueChange(l.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap ${
                leagueFilter === l.id
                  ? `bg-card ${l.accentClass} border border-current/20`
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <img src={l.logo} alt="" width={14} height={14} className="flex-shrink-0 opacity-80" style={{ aspectRatio: '1/1' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {l.shortName}
            </button>
          ))}
        </div>

        {/* Type filters */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hidden pb-2">
          {(['all', 'highlight', 'clip', 'poster', 'photo'] as const).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)} className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm whitespace-nowrap transition-colors ${typeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {f === 'all' ? 'All Media' : f + 's'}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="panel p-12 text-center">
            <p className="text-sm text-muted-foreground">No media found for this filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(m => (
              <div key={m.id} className="panel overflow-hidden group">
                <div className="relative aspect-video overflow-hidden">
                  <img src={m.thumbnail} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-transparent to-transparent" />
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold uppercase ${statusColors[m.status]}`}>
                      {m.status === 'published' ? <Eye className="w-3 h-3 inline mr-0.5" /> : m.status === 'ready' ? <Clock className="w-3 h-3 inline mr-0.5" /> : <Upload className="w-3 h-3 inline mr-0.5" />}
                      {m.status}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <LeagueBadge leagueId={m.leagueId} />
                    <p className="font-display font-bold text-sm mt-1">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.type} · {m.date}</p>
                  </div>
                  {(m.type === 'highlight' || m.type === 'clip') && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="p-3 bg-primary/20 rounded-full backdrop-blur-sm"><Play className="w-6 h-6 text-primary" /></div>
                    </div>
                  )}
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{m.type}</span>
                  <button onClick={() => { setShareModal(m.id); setCopied(false); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Share2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Share Modal */}
        {shareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setShareModal(null)} />
            <div className="relative panel p-6 w-full max-w-sm animate-fade-in">
              <h3 className="font-display font-bold text-lg mb-1">Share Content</h3>
              {shareAsset && <p className="text-xs text-muted-foreground mb-4 truncate">{shareAsset.title}</p>}
              <div className="space-y-3">
                <button
                  onClick={handleCopyLink}
                  className="w-full p-3 bg-secondary rounded-sm text-sm text-left hover:bg-secondary/80 transition-colors flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4 text-primary" /> : null}
                  {copied ? 'Link Copied!' : 'Copy Share Link'}
                </button>
                <button
                  onClick={handleNativeShare}
                  className="w-full p-3 bg-secondary rounded-sm text-sm text-left hover:bg-secondary/80 transition-colors"
                >
                  Share to Feed
                </button>
                <a
                  href={shareAsset?.thumbnail}
                  download={shareAsset?.title ?? 'media'}
                  className="block w-full p-3 bg-secondary rounded-sm text-sm text-left hover:bg-secondary/80 transition-colors"
                >
                  Download Card
                </a>
              </div>
              <button onClick={() => setShareModal(null)} className="w-full mt-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaPage;
