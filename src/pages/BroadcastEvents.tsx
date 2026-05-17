import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Radio, Calendar, Clock, ChevronRight } from 'lucide-react';
import { fetchPublicBroadcastEvents } from '@/lib/api/broadcast-events';
import { useBroadcastEventsListRealtime } from '@/hooks/useBroadcastEventRealtime';
import type { BroadcastEventStatus, LivestreamBroadcastEvent } from '@/types';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<
  BroadcastEventStatus,
  { label: string; classes: string }
> = {
  live:      { label: 'LIVE',      classes: 'bg-[#E63946] text-white animate-pulse' },
  scheduled: { label: 'UPCOMING',  classes: 'bg-[#C9A84C] text-black' },
  ended:     { label: 'ENDED',     classes: 'bg-[#333] text-[#8A8A8A]' },
  cancelled: { label: 'CANCELLED', classes: 'bg-[#333] text-[#8A8A8A]' },
  draft:     { label: 'DRAFT',     classes: 'bg-[#222] text-[#8A8A8A]' },
  archived:  { label: 'ARCHIVED',  classes: 'bg-[#222] text-[#8A8A8A]' },
};

function StatusBadge({ status }: { status: BroadcastEventStatus }) {
  const { label, classes } = STATUS_META[status] ?? STATUS_META.ended;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-widest uppercase ${classes}`}>
      {status === 'live' && (
        <Radio className="w-2.5 h-2.5 mr-1 flex-shrink-0" aria-hidden />
      )}
      {label}
    </span>
  );
}

// ── Broadcast card ────────────────────────────────────────────────────────────

function BroadcastCard({ event }: { event: LivestreamBroadcastEvent }) {
  const startAt = event.scheduled_start_at
    ? new Date(event.scheduled_start_at)
    : null;

  return (
    <Link
      to={`/broadcasts/${event.slug}`}
      className="group panel flex flex-col sm:flex-row gap-4 p-4 hover:border-primary/50 transition-colors"
    >
      {event.thumbnail_url ? (
        <div className="flex-shrink-0 w-full sm:w-40 h-24 sm:h-24 rounded-sm overflow-hidden bg-[#111]">
          <img
            src={event.thumbnail_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-full sm:w-40 h-24 sm:h-24 rounded-sm bg-[#111] flex items-center justify-center">
          <Radio className="w-8 h-8 text-primary/40" />
        </div>
      )}

      <div className="flex flex-col justify-between min-w-0 flex-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={event.status} />
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {event.title}
          </h2>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          {startAt ? (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" aria-hidden />
                {startAt.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" aria-hidden />
                {startAt.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Time TBD</span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="panel flex gap-4 p-4 animate-pulse">
      <div className="flex-shrink-0 w-40 h-24 rounded-sm bg-[#1a1a1a]" />
      <div className="flex-1 space-y-3">
        <div className="h-3 w-16 bg-[#1a1a1a] rounded-sm" />
        <div className="h-4 w-3/4 bg-[#1a1a1a] rounded-sm" />
        <div className="h-3 w-full bg-[#1a1a1a] rounded-sm" />
        <div className="h-3 w-32 bg-[#1a1a1a] rounded-sm" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BroadcastEvents() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['broadcast-events', 'public'],
    queryFn: () => fetchPublicBroadcastEvents({ limit: 30 }),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['broadcast-events', 'public'] });
  }, [queryClient]);

  useBroadcastEventsListRealtime(refresh);

  const events = data?.data ?? [];
  const live = events.filter((e) => e.status === 'live');
  const upcoming = events.filter((e) => e.status === 'scheduled');
  const past = events.filter((e) =>
    e.status === 'ended' || e.status === 'cancelled',
  );

  return (
    <div className="container py-8 space-y-8 max-w-3xl">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <Radio className="w-5 h-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold uppercase tracking-wider text-foreground">
            Broadcasts
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Sunday's Best Basketball League — live events &amp; replays
        </p>
      </header>

      {isError && (
        <div className="panel p-4 border-destructive/40 text-sm text-destructive">
          Could not load broadcasts. Please try again.
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {live.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#E63946] mb-3 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E63946] animate-pulse" />
                Live Now
              </h2>
              <div className="space-y-3">
                {live.map((e) => (
                  <BroadcastCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcoming.map((e) => (
                  <BroadcastCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Past
              </h2>
              <div className="space-y-3">
                {past.map((e) => (
                  <BroadcastCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          )}

          {events.length === 0 && (
            <div className="panel p-10 text-center space-y-2">
              <Radio className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No broadcasts scheduled yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
