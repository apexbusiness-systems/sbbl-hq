import React from 'react';
import { useParams } from 'react-router-dom';
import { BroadcastOverlay } from '@/components/broadcast/BroadcastOverlay';

export default function BroadcastOverlayPage() {
  const { gameId } = useParams();

  if (!gameId) return <div className="text-white p-4">Missing Game ID</div>;

  return (
    <div className="w-screen h-screen bg-transparent overflow-hidden">
      <BroadcastOverlay gameId={gameId} />
    </div>
  );
}
