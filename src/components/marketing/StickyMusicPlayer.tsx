import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import trackUrl from '@/assets/SBBL-HQ.mp3';

export const StickyMusicPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.loop = true;
    audio.volume = 0.35;
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
    setIsPlaying(false);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextMuted = !audio.muted;
    audio.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <audio ref={audioRef} src={trackUrl} preload="auto" />
      <div className="panel-glass border border-border/70 backdrop-blur-md rounded-full shadow-xl px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">SBBL Radio</span>
          <button
            type="button"
            onClick={() => void togglePlayback()}
            className="w-7 h-7 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center hover:opacity-90 transition-opacity"
            aria-label={isPlaying ? 'Pause music' : 'Play music'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground inline-flex items-center justify-center hover:bg-secondary/80 transition-colors"
            aria-label={isMuted ? 'Unmute music' : 'Mute music'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
