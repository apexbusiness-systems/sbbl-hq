import { useState, useEffect, useMemo, type SyntheticEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { LeagueId, MediaAsset } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { ingestPresign, ingestSubmit } from '@/lib/api/ops';
import { createIdempotencyKey } from '@/lib/api/idempotency';
import { MAX_UPLOAD_BYTES, minimizeVideoForUpload } from '@/lib/videoMinimizer';
import { Play, Share2, Upload, Eye, Clock, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = { draft: 'text-muted-foreground', ready: 'text-warning', published: 'text-success' };

const MediaPage = () => {
  const { activeLeague, setActiveLeague } = useApp();
  const { roles, isSignedIn } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<'all' | 'highlight' | 'clip' | 'poster' | 'photo'>('all');
  const [shareModal, setShareModal] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [assetOrientation, setAssetOrientation] = useState<Record<string, 'portrait' | 'landscape'>>({});
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoCaption, setVideoCaption] = useState('');
  const [videoSection, setVideoSection] = useState<'highlight' | 'clip'>('clip');
  const [videoLeague, setVideoLeague] = useState<LeagueId>(activeLeague);
  const [uploadPublishNow, setUploadPublishNow] = useState(true);

  // League filter — URL param sync, default to active league
  const paramLeague = searchParams.get('league');
  const initialLeague: LeagueId | 'all' =
    paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague))
      ? (paramLeague as LeagueId | 'all')
      : activeLeague;
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(initialLeague);

  const handleLeagueChange = (val: LeagueId | 'all') => {
    setLeagueFilter(val);
    if (val !== 'all') setActiveLeague(val);
    setSearchParams({ league: val }, { replace: true });
  };

  const isValidParam = paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague));

  useEffect(() => {
    if (isValidParam) {
      setLeagueFilter(paramLeague as LeagueId | 'all');
    } else if (activeLeague) {
      setLeagueFilter(activeLeague);
    }
  }, [activeLeague, paramLeague, isValidParam]);

  const mediaQuery = useQuery({
    queryKey: ['public-media'],
    queryFn: () => apiFetch<{ ok: boolean; data: MediaAsset[] }>('/api/public/media'),
    retry: 1,
    staleTime: 60_000,
  });

  const posterProjectionQuery = useQuery({
    queryKey: ['public-media-posters'],
    queryFn: () => apiFetch<{ ok: boolean; data: MediaAsset[] }>('/api/public/media/posters'),
    retry: 1,
    staleTime: 60_000,
    enabled: typeFilter === 'poster',
  });

  // No fallback data — surface the real state. Fail loud, never fake.
  const allMedia = useMemo<MediaAsset[]>(() => {
    const apiData = mediaQuery.data?.data;
    return Array.isArray(apiData) ? apiData : [];
  }, [mediaQuery.data]);

  const posterProjection = useMemo<MediaAsset[]>(() => {
    const projected = posterProjectionQuery.data?.data;
    return Array.isArray(projected) ? projected : [];
  }, [posterProjectionQuery.data]);

  const filtered = useMemo(() => {
    const baseList = typeFilter === 'poster'
      ? [...allMedia, ...posterProjection]
      : allMedia;

    const dedupedById = baseList.filter((item, idx, arr) =>
      arr.findIndex(candidate => candidate.id === item.id) === idx,
    );

    return dedupedById.filter(m => {
      const leagueMatch = leagueFilter === 'all' || m.leagueId === leagueFilter;
      const typeMatch = typeFilter === 'all' || m.type === typeFilter;
      return leagueMatch && typeMatch;
    });
  }, [allMedia, posterProjection, leagueFilter, typeFilter]);

  const shareAsset = shareModal ? [...allMedia, ...posterProjection].find(m => m.id === shareModal) : null;
  const activeLeagueObj = leagueFilter !== 'all' ? LEAGUE_REGISTRY.find(l => l.id === leagueFilter) : null;
  const canUploadVideo = isSignedIn && roles.some(role => role === 'super_admin' || role === 'league_admin');

  const resolveAspectRatio = (id: string, mediaType: MediaAsset['type']) => {
    const orientation = assetOrientation[id];
    if (orientation === 'landscape') return '4 / 3';
    if (orientation === 'portrait') return '3 / 4';
    return mediaType === 'highlight' || mediaType === 'clip' ? '16 / 9' : '3 / 4';
  };

  const handleAssetLoad = (id: string, event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const orientation = img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait';
    setAssetOrientation(prev => (prev[id] === orientation ? prev : { ...prev, [id]: orientation }));
  };

  const handleCopyLink = async () => {
    const url = `${globalThis.location.origin}/media#${shareModal}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => { setCopied(false); setShareModal(null); }, 1500);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleNativeShare = async () => {
    if (shareAsset) {
      const shareData = {
        title: shareAsset.title,
        text: `${shareAsset.title} — SBBL HQ`,
        url: `${globalThis.location.origin}/media#${shareModal}`,
      };
      if (navigator.share) {
        try { await navigator.share(shareData); setShareModal(null); } catch { /* cancelled */ }
      } else {
        await handleCopyLink();
      }
    }
  };

  const handleVideoUpload = async () => {
    if (!canUploadVideo) {
      toast.error('Only league admins and super-admins can upload videos.');
      return;
    }
    if (!videoFile) {
      toast.error('Select a video file first.');
      return;
    }
    if (!videoTitle.trim()) {
      toast.error('Video title is required.');
      return;
    }
    if (videoCaption.trim().length > 140) {
      toast.error('Caption must be 140 characters or less.');
      return;
    }

    setUploadingVideo(true);
    try {
      const minimized = await minimizeVideoForUpload(videoFile);
      if (minimized.warning) toast.warning(minimized.warning);
      if (minimized.file.size > MAX_UPLOAD_BYTES) throw new Error('video_size_limit_exceeded');

      const { signedUrl, objectPath, token } = await ingestPresign('video', minimized.file.name);
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'content-type': minimized.file.type || 'video/webm',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: minimized.file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`video_upload_failed_${uploadResponse.status}`);
      }

      const submitResult = await ingestSubmit({
        kind: 'video',
        objectPath,
        publicUrl: objectPath,
        title: videoTitle.trim(),
        leagueId: videoLeague,
        publishStatus: uploadPublishNow ? 'published' : 'draft',
        idempotencyKey: createIdempotencyKey(`media-video-${videoTitle.trim()}`),
        meta: {
          type: videoSection,
          caption: videoCaption.trim(),
          mimeType: minimized.file.type || 'video/webm',
          sizeBytes: minimized.file.size,
          minimized: minimized.minimized,
          originalFilename: videoFile.name,
        },
      });

      toast.success(`Video ingest queued. Job ${submitResult.jobId.slice(0, 8)} · ${submitResult.state}`);
      setVideoFile(null);
      setVideoTitle('');
      setVideoCaption('');
      await mediaQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'video_upload_failed';
      toast.error(`Video upload failed: ${message}`);
    } finally {
      setUploadingVideo(false);
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
        {canUploadVideo && (
          <div className="panel p-4 mb-6 border-primary/30">
            <h2 className="font-display font-bold text-lg mb-3">Admin Video Upload</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
                className="text-sm"
              />
              <input
                value={videoTitle}
                onChange={(event) => setVideoTitle(event.target.value)}
                maxLength={90}
                placeholder="Video title"
                className="h-10 rounded-sm border border-border bg-background px-3 text-sm"
              />
              <textarea
                value={videoCaption}
                onChange={(event) => setVideoCaption(event.target.value)}
                maxLength={140}
                placeholder="Caption (max 140 chars)"
                className="min-h-[84px] rounded-sm border border-border bg-background px-3 py-2 text-sm md:col-span-2"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Section</span>
                {(['clip', 'highlight'] as const).map(section => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setVideoSection(section)}
                    className={`px-3 py-1.5 text-xs font-semibold uppercase rounded-sm ${videoSection === section ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                  >
                    {section}
                  </button>
                ))}
              </div>
              <select
                value={videoLeague}
                onChange={(event) => setVideoLeague(event.target.value as LeagueId)}
                className="h-10 rounded-sm border border-border bg-background px-3 text-sm"
              >
                {LEAGUE_REGISTRY.map(league => <option key={league.id} value={league.id}>{league.shortName}</option>)}
              </select>
              <label className="text-xs text-muted-foreground flex items-center gap-2 md:col-span-2">
                <input type="checkbox" checked={uploadPublishNow} onChange={(event) => setUploadPublishNow(event.target.checked)} />
                Publish immediately
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                50MB max. Video is minimized in-browser for faster playback whenever supported.
              </p>
              <button
                type="button"
                onClick={handleVideoUpload}
                disabled={uploadingVideo}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground rounded-sm disabled:opacity-60"
              >
                {uploadingVideo ? 'Uploading…' : 'Upload Video'}
              </button>
            </div>
          </div>
        )}

        {mediaQuery.isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start" aria-live="polite" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`media-loading-${index}`} className="panel overflow-hidden animate-pulse">
                <div className="bg-secondary/80" style={{ aspectRatio: '3/4' }} />
                <div className="px-3 py-3 border-t border-border/50 space-y-2">
                  <div className="h-3 rounded-sm bg-secondary/80 w-1/3" />
                  <div className="h-3 rounded-sm bg-secondary/80 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {mediaQuery.isError && (
          <div className="panel p-6 mb-4 flex items-center gap-3 border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              Media feed unavailable — {(mediaQuery.error as Error)?.message ?? 'unknown error'}
            </p>
          </div>
        )}

        {!mediaQuery.isLoading && !mediaQuery.isError && mediaQuery.isSuccess && filtered.length === 0 ? (
          <div className="panel p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {allMedia.length === 0 ? 'No published media yet.' : 'No media found for this filter.'}
            </p>
          </div>
        ) : (
          // Grid cards use per-asset orientation so each container adapts to its own
          // uploaded ratio without forcing neighbors to inherit that geometry.
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {filtered.map((m, index) => {
              const orientation = assetOrientation[m.id];
              const isLandscape = orientation === 'landscape';
              const isPlayable = m.type === 'highlight' || m.type === 'clip';
              const isLcpCandidate = index === 0;
              return (
                <div key={m.id} className="panel overflow-hidden group flex flex-col">
                  {/* ── Image cell: per-card adaptive ratio (portrait/landscape) ── */}
                  <div className="relative overflow-hidden bg-[#0a0a0a]" style={{ aspectRatio: resolveAspectRatio(m.id, m.type) }}>
                    {m.videoUrl ? (
                      <video
                        src={m.videoUrl}
                        poster={m.thumbnail}
                        controls
                        preload="metadata"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : null}
                    {!m.videoUrl && (
                      <>
                        {/* Ambient blur fill — fills dead space for non-portrait content, adds depth for all */}
                        <img
                          src={m.thumbnail}
                          alt=""
                          aria-hidden
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-30 pointer-events-none select-none"
                        />
                        {/* Sharp primary image — cover+top for portrait, contain for landscape */}
                        <img
                          src={m.thumbnail}
                          alt={m.title}
                          onLoad={(event) => handleAssetLoad(m.id, event)}
                          loading={isLcpCandidate ? 'eager' : 'lazy'}
                          decoding="async"
                          fetchPriority={isLcpCandidate ? 'high' : 'auto'}
                          className={`absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-105 ${
                            isLandscape ? 'object-contain' : 'object-cover object-top'
                          }`}
                        />
                      </>
                    )}
                    {/* Bottom gradient scrim for legibility */}
                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    {/* Top-right status badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-sm bg-black/50 backdrop-blur-sm ${statusColors[m.status]}`}>
                        {m.status === 'published' && <Eye className="w-2.5 h-2.5" />}
                        {m.status === 'ready' && <Clock className="w-2.5 h-2.5" />}
                        {m.status === 'draft' && <Upload className="w-2.5 h-2.5" />}
                        {m.status}
                      </span>
                    </div>
                    {/* Bottom metadata overlay */}
                    <div className="absolute bottom-0 inset-x-0 px-3 pb-3 pt-6">
                      <LeagueBadge leagueId={m.leagueId} size="sm" />
                      <p className="font-display font-bold text-sm text-white mt-1.5 leading-tight line-clamp-2">{m.title}</p>
                      {m.caption && <p className="text-[11px] text-white/75 line-clamp-2 mt-1">{m.caption}</p>}
                      <p className="text-[10px] text-white/50 mt-0.5">{m.type} · {m.date}</p>
                    </div>
                    {/* Play overlay for video content */}
                    {isPlayable && !m.videoUrl && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="p-4 bg-primary/25 rounded-full backdrop-blur-sm border border-primary/30">
                          <Play className="w-7 h-7 text-primary" />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* ── Footer ── */}
                  <div className="px-3 py-2.5 flex items-center justify-between border-t border-border/50">
                    <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{m.type}</span>
                    <button
                      onClick={() => { setShareModal(m.id); setCopied(false); }}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Share"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Share Modal */}
        {shareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <button 
              className="absolute inset-0 bg-background/70 backdrop-blur-sm w-full h-full" 
              onClick={() => setShareModal(null)}
              aria-label="Close modal"
            />
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
