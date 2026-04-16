import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { GameEvent } from '@/types/game-event';

// PHASE 1: OBS Browser Source Overlay MVP
export const BroadcastOverlay: React.FC<{ gameId: string }> = ({ gameId }) => {
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [clock, setClock] = useState('12:00');
  const [events, setEvents] = useState<GameEvent[]>([]);

  useEffect(() => {
    // Subscribe to realtime game events for this broadcast
    const channel = supabase
      .channel(`broadcast-${gameId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${gameId}` },
        (payload) => {
          const event = payload.new as GameEvent;
          setEvents(prev => [...prev, event]);

          if (event.event_type === 'score') {
             // Basic score logic (mocked schema structure)
             if (event.payload?.team === 'home') setScore(s => ({ ...s, home: s.home + (event.payload?.points || 2) }));
             if (event.payload?.team === 'away') setScore(s => ({ ...s, away: s.away + (event.payload?.points || 2) }));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  return (
    <div className="w-[1920px] h-[1080px] bg-transparent text-[#F5F5F0] font-bebas relative overflow-hidden pointer-events-none">
      {/* Score Bug */}
      <div className="absolute top-8 left-8 flex bg-[#0A0A0A] border border-[#C9A84C] rounded shadow-lg overflow-hidden">
        <div className="p-4 bg-[#111111] text-3xl font-bold min-w-[100px] text-center border-r border-[#333]">HOME {score.home}</div>
        <div className="p-4 bg-[#111111] text-3xl font-bold min-w-[100px] text-center border-r border-[#333]">AWAY {score.away}</div>
        <div className="p-4 bg-[#0A0A0A] text-[#C9A84C] text-3xl font-bold min-w-[100px] text-center">{clock}</div>
      </div>

      {/* Moment Markers (Ticker) */}
      <div className="absolute bottom-8 left-8 right-8 bg-[#111111]/90 border-t border-[#C9A84C] p-2 flex gap-4 overflow-hidden">
         {events.slice(-5).map((e, i) => (
           <div key={i} className="text-sm uppercase whitespace-nowrap text-[#C9A84C] opacity-80">
              {e.event_type} - {e.source}
           </div>
         ))}
      </div>
    </div>
  );
};
