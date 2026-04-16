import React from 'react';
import { HoopsTokFeed } from '@/components/social/HoopsTokFeed';
import { BottomNav } from '@/components/layout/BottomNav'; // Assuming there's a bottom nav, if not we will just render the feed

export default function HoopsTokPage() {
  return (
    <div className="w-full h-full bg-[#0A0A0A] flex flex-col">
       <div className="flex-1 overflow-hidden">
         <HoopsTokFeed />
       </div>
    </div>
  );
}
