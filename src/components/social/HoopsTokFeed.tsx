import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// PHASE 2: HoopsTok Vertical Social Feed MVP
export const HoopsTokFeed: React.FC = () => {
  const [clips, setClips] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    // RecSys v0: simple fetch of recent auto-clips
    supabase
      .from('media_publications')
      .select('*')
      .eq('surface', 'potg') // Mock condition for clips
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setClips(data);
      });
  }, []);

  return (
    <div className="w-full h-[calc(100vh-64px)] bg-[#0A0A0A] overflow-y-auto snap-y snap-mandatory">
      {clips.map(clip => (
        <div key={String(clip.id)} className="w-full h-full snap-start relative flex items-center justify-center bg-black border-b border-[#333]">
           {/* Auto-play logic goes here. Prefetch would be handled via IntersectionObserver in a real implementation */}
           <div className="absolute inset-0 z-0">
             {/* Fallback mockup video box */}
             <div className="w-full h-full bg-[#111111] flex flex-col items-center justify-center text-[#333]">
               <span className="font-bebas text-4xl text-[#C9A84C]/50">CLIP PLAYER</span>
               <span className="text-sm mt-2">{String(clip.title || 'Untitled')}</span>
             </div>
           </div>

           {/* Engagement Overlay */}
           <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-10">
             <button className="p-3 bg-[#1A1A1A]/80 rounded-full border border-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors">❤️</button>
             <button className="p-3 bg-[#1A1A1A]/80 rounded-full border border-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors">💬</button>
             <button className="p-3 bg-[#1A1A1A]/80 rounded-full border border-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors">↗️</button>
           </div>

           {/* Metadata Overlay */}
           <div className="absolute left-4 bottom-8 z-10 w-3/4">
             <h3 className="font-bebas text-2xl text-white">{String(clip.title || 'Untitled')}</h3>
             <p className="text-sm text-gray-300 line-clamp-2 mt-1">{String(clip.subtitle || '')}</p>
           </div>
        </div>
      ))}
      {clips.length === 0 && (
         <div className="h-full flex items-center justify-center text-gray-500 font-bebas text-2xl">
           LOADING FEED...
         </div>
      )}
    </div>
  );
};
