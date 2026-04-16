import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2, Video } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// PHASE 1: Viewer App PiP + Stats Drawer
export const PipStatsDrawer: React.FC<{ gameId: string }> = ({ gameId }) => {
  const [isPip, setIsPip] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'clips'>('stats');

  const handleClipRequest = async () => {
    // Hold-to-clip (event_id anchored) via idempotent endpoint
    await supabase.rpc('enqueue_local_domain_event', {
      payload: {
        type: 'clip_request',
        game_id: gameId,
        requested_at: new Date().toISOString()
      }
    });
  };

  return (
    <div className={`relative flex flex-col transition-all duration-300 ${isPip ? 'h-64 w-96 fixed bottom-4 right-4 z-50 rounded-xl shadow-2xl overflow-hidden border border-[#C9A84C]' : 'h-full w-full'}`}>

      {/* Video Placeholder */}
      <div className="relative bg-black w-full flex-shrink-0 aspect-video group">
        <div className="absolute inset-0 flex items-center justify-center text-[#333]">
           <Video className="w-12 h-12" />
        </div>

        {/* Controls Overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-start justify-end p-2 gap-2">
           <Button variant="ghost" size="icon" onClick={() => setIsPip(!isPip)} className="text-white hover:text-[#C9A84C]">
             {isPip ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
           </Button>
        </div>

        {/* Hold-to-clip button */}
        {!isPip && (
          <div className="absolute bottom-4 right-4">
            <Button
              onPointerDown={() => console.log('hold start')}
              onPointerUp={handleClipRequest}
              className="bg-[#C9A84C] hover:bg-[#A88B3A] text-black font-bebas tracking-wide"
            >
              HOLD TO CLIP
            </Button>
          </div>
        )}
      </div>

      {/* Stats Drawer (Hidden in PiP) */}
      {!isPip && (
        <div className="flex-1 bg-[#0A0A0A] flex flex-col overflow-hidden">
          <div className="flex border-b border-[#333]">
            <button
              className={`flex-1 py-3 font-bebas text-lg ${activeTab === 'stats' ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-gray-500'}`}
              onClick={() => setActiveTab('stats')}
            >
              STATS
            </button>
            <button
              className={`flex-1 py-3 font-bebas text-lg ${activeTab === 'clips' ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-gray-500'}`}
              onClick={() => setActiveTab('clips')}
            >
              CLIPS
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 text-[#F5F5F0]">
            {activeTab === 'stats' ? (
              <div className="grid gap-4">
                <div className="bg-[#111111] p-4 rounded border border-[#333]">
                   {/* Tap player cards */}
                   <h3 className="font-bebas text-xl text-[#C9A84C] mb-2">HOME ROSTER</h3>
                   <div className="grid grid-cols-2 gap-2">
                     {[1,2,3].map(i => (
                       <div key={i} className="bg-[#1A1A1A] p-2 rounded cursor-pointer hover:border-[#C9A84C] border border-transparent transition-colors">
                         Player {i}
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 mt-10">No clips yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
