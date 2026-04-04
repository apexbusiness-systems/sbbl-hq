import { useEffect, useRef } from 'react';
import { WebRTCPlayer } from '@eyevinn/webrtc-player';

export function WhepPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<WebRTCPlayer | null>(null);

  useEffect(() => {
    if (videoRef.current && url) {
      playerRef.current = new WebRTCPlayer({
        video: videoRef.current,
        type: 'whep',
      });
      playerRef.current.load(new URL(url));
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      autoPlay
      controls
      playsInline
      className="w-full h-full object-cover"
    />
  );
}
