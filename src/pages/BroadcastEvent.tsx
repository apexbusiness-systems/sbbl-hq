import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Radio, Calendar, Clock, ChevronLeft,
  AlertTriangle, PlayCircle,
} from 'lucide-react';
import { fetchPublicBroadcastEvent } from '@/lib/api/broadcast-events';
import { useBroadcastEventRealtime } from '@/hooks/useBroadcastEventRealtime';
import type { BroadcastEventStatus, LivestreamBroadcastEvent } from '@/types';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<BroadcastEventStatus, { label: string; classes: string }> = {
  live:      { label: 'LIVE',      classes: 'bg-[#E63946] text-white' },
  scheduled: { label: 'UPCOMING',  classes: 'bg-[#C9A84C] text-black' },
  ended:     { label: 'ENDED',     classes: 'bg-[#222] text-[#8A8A8A]' },
  cancelled: { label: 'CANCELLED', classes: 'bg-[#222] text-[#8A8A8A]' },
  draft:     { label: 'DRAFT',     classes: 'bg-[#222] text-[#8A8A8A]' },
  archived:  { label: 'ARCHIVED',  classes: 'bg-[#222] text-[#8A8A8A]' },
};

function StatusBadge({ status }: { status: BroadcastEventStatus }) {
  const { label, classes } = STATUS_META[status] ?? STATUS_META.ended;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-bold tracking-widest uppercase ${classes}`}
    >
      {status === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse flex-shrink-0" />
      )}
      {label}
    </span>
  );
}

// ── Countdown timer ────────────────────────────────────────────────────────────

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();

    function tick() {
      const diff = target - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return remaining;
}

function Countdown({ targetIso }: { targetIso: string }) {
  const remaining = useCountdown(targetIso);
  if (remaining === null) return null;

  if (remaining <= 0) {
    return (
      <p className="text-sm text-primary font-semibold uppercase tracking-wider">
        Starting now…
      </p>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts =
    days > 0
      ? [
          { label: 'd', value: days },
          { label: 'h', value: hours },
          { label: 'm', value: mins },
        ]
      : [
          { label: 'h', value: hours },
          { label: 'm', value: mins },
          { label: 's', value: secs },
        ];

  return (
    <div className="flex items-center gap-3">
      {parts.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center">
          <span className="text-2xl font-bold text-primary tabular-nums leading-none">
            {String(value).padStart(2, '0')}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Stream player ─────────────────────────────────────────────────────────────
// Sandboxed iframe for embed_url, or native player anchor for stream_url.
// Per CLAUDE.md §6.3: only HTTPS embed_url reaches the iframe; sandbox is applied.

function StreamPlayer({
  streamUrl,
  embedUrl,
  title,
}: {
  streamUrl: string | null;
  embedUrl: string | null;
  title: string;
}) {
  if (embedUrl) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-sm overflow-hidden">
        <iframe
          src={embedUrl}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          className="absolute inset-0 w-full h-full border-0"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  if (streamUrl) {
    // HLS/MP4 direct link — show a play button that opens in new tab.
    // Full ReactPlayer integration belongs in LiveStreamPlayer.tsx (existing).
    return (
      <div className="relative w-full aspect-video bg-[#111] rounded-sm flex flex-col items-center justify-center gap-4">
        <PlayCircle className="w-16 h-16 text-primary/80" />
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-semibold uppercase tracking-wider hover:bg-primary/90 transition-colors"
        >
          Watch Stream
        </a>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-[#111] rounded-sm flex items-center justify-center">
      <div className="text-center space-y-2">
        <Radio className="w-10 h-10 text-muted-foreground/40 mx-auto" />
        <p className="text-xs text-muted-foreground">Stream coming soon</p>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="container py-8 max-w-3xl animate-pulse space-y-4">
      <div className="h-3 w-16 bg-[#1a1a1a] rounded-sm" />
      <div className="h-6 w-2/3 bg-[#1a1a1a] rounded-sm" />
      <div className="aspect-video w-full bg-[#1a1a1a] rounded-sm" />
      <div className="h-4 w-full bg-[#1a1a1a] rounded-sm" />
      <div className="h-4 w-3/4 bg-[#1a1a1a] rounded-sm" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BroadcastEvent() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['broadcast-event', slug], [slug]);

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchPublicBroadcastEvent(slug!),
    enabled: !!slug,
    refetchInterval: (q) => {
      // Poll every 15s when event is live so stream_url appears without refresh.
      const event = q.state.data?.data;
      return event?.status === 'live' ? 15_000 : false;
    },
  });

  const event = data?.data;
  const eventIdRef = useRef(event?.id);
  eventIdRef.current = event?.id;

  const handleRealtimeUpdate = useCallback(
    (updated: LivestreamBroadcastEvent) => {
      queryClient.setQueryData(queryKey, (old: typeof data) => {
        if (!old) return old;
        return { ...old, data: { ...old.data, ...updated } };
      });
    },
    [queryClient, queryKey],
  );

  useBroadcastEventRealtime(event?.id ?? null, handleRealtimeUpdate);

  if (isLoading) return <PageSkeleton />;

  if (isError || !event) {
    return (
      <div className="container py-16 max-w-3xl text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">
          {isError ? 'Could not load this broadcast.' : 'Broadcast not found.'}
        </p>
        <Link
          to="/broadcasts"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          All broadcasts
        </Link>
      </div>
    );
  }

  const startAt = event.scheduled_start_at
    ? new Date(event.scheduled_start_at)
    : null;

  const isLive = event.status === 'live';
  const isScheduled = event.status === 'scheduled';
  const isEnded = event.status === 'ended' || event.status === 'cancelled';

  return (
    <div className="container py-8 max-w-3xl space-y-6">
      {/* Back nav */}
      <Link
        to="/broadcasts"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        All broadcasts
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={event.status} />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
          {event.title}
        </h1>
        {startAt && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" aria-hidden />
              {startAt.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" aria-hidden />
              {startAt.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })}
            </span>
          </div>
        )}
      </div>

      {/* Live player */}
      {isLive && (
        <StreamPlayer
          streamUrl={event.stream_url}
          embedUrl={event.embed_url}
          title={event.title}
        />
      )}

      {/* Scheduled countdown */}
      {isScheduled && (
        <div className="panel p-6 space-y-3">
          {event.scheduled_start_at ? (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Starts in
              </p>
              <Countdown targetIso={event.scheduled_start_at} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Date and time to be announced.
            </p>
          )}
        </div>
      )}

      {/* Thumbnail shown when not live */}
      {!isLive && event.thumbnail_url && (
        <div className="w-full aspect-video rounded-sm overflow-hidden bg-[#111]">
          <img
            src={event.thumbnail_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Ended state */}
      {isEnded && (
        <div className="panel p-5 border-border/60 text-sm text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">
            {event.status === 'cancelled' ? 'Event cancelled' : 'Broadcast ended'}
          </p>
          {event.actual_end_at && (
            <p>
              Ended{' '}
              {new Date(event.actual_end_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div className="prose prose-invert prose-sm max-w-none text-muted-foreground">
          <p>{event.description}</p>
        </div>
      )}
    </div>
  );
}
