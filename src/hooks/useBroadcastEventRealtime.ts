/**
 * useBroadcastEventRealtime
 *
 * Subscribes to Supabase Postgres changes on livestream_broadcast_events
 * for a given event id and calls onUpdate whenever the row changes.
 * Cleans up channel on id change or unmount.
 */
import { useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { LivestreamBroadcastEvent } from '@/types';

type UpdatePayload = {
  new: LivestreamBroadcastEvent;
  old: Partial<LivestreamBroadcastEvent>;
};

export function useBroadcastEventRealtime(
  eventId: string | null | undefined,
  onUpdate: (updated: LivestreamBroadcastEvent) => void,
) {
  useEffect(() => {
    if (!eventId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`broadcast-event:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'livestream_broadcast_events',
          filter: `id=eq.${eventId}`,
        },
        (payload: { new: unknown }) => {
          if (payload.new && typeof payload.new === 'object') {
            onUpdate(payload.new as LivestreamBroadcastEvent);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, onUpdate]);
}

/**
 * useBroadcastEventsListRealtime
 *
 * Subscribes to any INSERT or UPDATE on the public events table and
 * calls onRefresh so the caller can re-fetch the list.
 */
export function useBroadcastEventsListRealtime(onRefresh: () => void) {
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('broadcast-events-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'livestream_broadcast_events',
        },
        (_payload: UpdatePayload) => {
          onRefresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefresh]);
}
