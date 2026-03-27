import { useState } from 'react';
import { mediaAssets, leagues } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { Play, Share2, Upload, Eye, Clock } from 'lucide-react';

const statusColors = { draft: 'text-muted-foreground', ready: 'text-warning', published: 'text-success' };

const MediaPage = () => {
  const [filter, setFilter] = useState<'all' | 'highlight' | 'clip' | 'poster' | 'photo'>('all');
  const [shareModal, setShareModal] = useState<string | null>(null);

  const filtered = filter === 'all' ? mediaAssets : mediaAssets.filter(m => m.type === filter);

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Media</h1>
            <p className="text-sm text-muted-foreground mt-1">Highlights, clips, and editorial content</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hidden pb-2">
          {(['all', 'highlight', 'clip', 'poster', 'photo'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm whitespace-nowrap transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {f === 'all' ? 'All Media' : f + 's'}
            </button>
          ))}
        </div>

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
                <button onClick={() => setShareModal(m.id)} className="p-1.5 text-muted-foreground hover:text-foreground"><Share2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Share Modal */}
        {shareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setShareModal(null)} />
            <div className="relative panel p-6 w-full max-w-sm animate-fade-in">
              <h3 className="font-display font-bold text-lg mb-4">Share Content</h3>
              <div className="space-y-3">
                <button className="w-full p-3 bg-secondary rounded-sm text-sm text-left hover:bg-secondary/80 transition-colors">Copy Share Link</button>
                <button className="w-full p-3 bg-secondary rounded-sm text-sm text-left hover:bg-secondary/80 transition-colors">Download Card</button>
                <button className="w-full p-3 bg-secondary rounded-sm text-sm text-left hover:bg-secondary/80 transition-colors">Share to Feed</button>
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
