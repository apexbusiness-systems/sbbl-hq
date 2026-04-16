import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { requireSupabaseClient } from '@/lib/supabase/client';
import type { GameEventType } from '@/types/game-event';

// PHASE 1: Operator Tagging UI
export const OperatorTaggingUI: React.FC<{ gameId: string }> = ({ gameId }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoAlignmentMs, setVideoAlignmentMs] = useState(0);

  const tagEvent = async (type: GameEventType, team: 'home' | 'away', points?: number) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = { team };
      if (points) payload.points = points;

      const supabase = requireSupabaseClient();
      const { error } = await supabase.from('game_events').insert({
        game_id: gameId,
        event_ts: new Date().toISOString(),
        video_alignment_ms: videoAlignmentMs, // Latency alignment
        event_type: type,
        source: 'operator',
        payload
      });

      if (error) throw error;

      toast({ title: 'Event Tagged', description: `${type.toUpperCase()} for ${team.toUpperCase()}` });
    } catch (err) {
      const e = err as Error;
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111111] p-6 rounded-lg border border-[#333] flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="font-bebas text-2xl text-[#C9A84C]">OPERATOR TAGGING</h2>
        <div className="flex items-center gap-2">
           <span className="text-xs text-gray-400">OFFSET (MS)</span>
           <Input
             type="number"
             className="w-24 bg-[#0A0A0A] border-[#333]"
             value={videoAlignmentMs}
             onChange={e => setVideoAlignmentMs(parseInt(e.target.value) || 0)}
           />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Home Controls */}
        <div className="space-y-4 border-r border-[#333] pr-8">
          <h3 className="font-bebas text-xl text-center">HOME</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={isSubmitting} onClick={() => tagEvent('score', 'home', 2)} className="bg-green-900 hover:bg-green-800 text-white">+2 PTS</Button>
            <Button disabled={isSubmitting} onClick={() => tagEvent('score', 'home', 3)} className="bg-green-900 hover:bg-green-800 text-white">+3 PTS</Button>
            <Button disabled={isSubmitting} onClick={() => tagEvent('rebound', 'home')} variant="outline">REB</Button>
            <Button disabled={isSubmitting} onClick={() => tagEvent('foul', 'home')} variant="destructive">FOUL</Button>
            <Button disabled={isSubmitting} onClick={() => tagEvent('moment_marker', 'home')} className="col-span-2 bg-[#C9A84C] text-black hover:bg-[#A88B3A]">MARK MOMENT</Button>
          </div>
        </div>

        {/* Away Controls */}
        <div className="space-y-4">
          <h3 className="font-bebas text-xl text-center">AWAY</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={isSubmitting} onClick={() => tagEvent('score', 'away', 2)} className="bg-blue-900 hover:bg-blue-800 text-white">+2 PTS</Button>
            <Button disabled={isSubmitting} onClick={() => tagEvent('score', 'away', 3)} className="bg-blue-900 hover:bg-blue-800 text-white">+3 PTS</Button>
            <Button disabled={isSubmitting} onClick={() => tagEvent('rebound', 'away')} variant="outline">REB</Button>
            <Button disabled={isSubmitting} onClick={() => tagEvent('foul', 'away')} variant="destructive">FOUL</Button>
            <Button disabled={isSubmitting} onClick={() => tagEvent('moment_marker', 'away')} className="col-span-2 bg-[#C9A84C] text-black hover:bg-[#A88B3A]">MARK MOMENT</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
