import { useState } from 'react';
import type { PlayerOfTheGame } from '@/types';
import { Trophy } from 'lucide-react';

interface PotgCardProps {
  potg: PlayerOfTheGame;
  featured?: boolean; // kept for API compat; no longer affects dimensions
}

// All portrait cards share the same 280px width; landscape cards use 4:3 AR.
const CARD_WIDTH = 'min-w-[280px] max-w-[280px]';
const PORTRAIT_AR = '3/4';   // 560 × 747 uploads
const LANDSCAPE_AR = '4/3';  // 747 × 560 uploads (2v2, event graphics)


export const PotgCard = ({ potg }: PotgCardProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [ar, setAr] = useState<string>(PORTRAIT_AR);

  // Poster-style card — shown when a real graphic image is available and loads ok
  if (potg.image && !imgFailed) {
    return (
      <div
        className={`relative overflow-hidden flex-shrink-0 rounded-sm border border-border group cursor-default transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_32px_-4px_hsl(43_52%_54%/0.25)] ${CARD_WIDTH}`}
        style={{ aspectRatio: ar }}
      >
        <img
          src={potg.image}
          alt={`${potg.playerName} — Player of the Game`}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          loading="lazy"
          onLoad={(e) => {
            const img = e.currentTarget;
            // If image is wider than tall → landscape 4:3 card; otherwise portrait 3:4
            const isLandscape = img.naturalWidth > img.naturalHeight;
            setAr(isLandscape ? LANDSCAPE_AR : PORTRAIT_AR);
          }}
          onError={() => setImgFailed(true)}
        />
        {/* Bottom stat overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-8">
          <div className="flex items-center gap-1 mb-1">
            <Trophy className="w-3 h-3 text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">POTG</span>
          </div>
          <p className="font-display text-white text-sm font-bold leading-tight truncate">{potg.playerName}</p>
          <p className="text-[10px] text-white/60 truncate">{potg.gameResult}</p>
        </div>
      </div>
    );
  }

  // Text-only fallback card (no image or image failed to load)
  return (
    <div
      className={`relative bg-card border border-border rounded-sm overflow-hidden flex-shrink-0 flex flex-col transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_24px_-4px_hsl(43_52%_54%/0.15)] ${CARD_WIDTH}`}
      style={{ aspectRatio: PORTRAIT_AR }}
    >
      {/* Gold accent top bar */}
      <div className="h-[3px] bg-gradient-to-r from-primary via-primary/60 to-transparent" />

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-1.5 mb-4">
          <Trophy className="w-3 h-3 text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
            Player of the Game
          </span>
        </div>

        <h3 className="font-display text-4xl uppercase leading-none text-foreground mb-2">
          {potg.playerName}
        </h3>

        <span className="inline-flex items-center self-start px-2 py-0.5 bg-primary/12 border border-primary/25 text-primary text-[10px] font-bold uppercase tracking-widest rounded-sm mb-5">
          {potg.team}
        </span>

        <div className="grid grid-cols-3 gap-1 mb-5">
          <div className="text-center">
            <p className="stat-numeral text-5xl leading-none text-foreground">{potg.pts}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1.5 font-medium">PTS</p>
          </div>
          <div className="text-center border-x border-border">
            <p className="stat-numeral text-5xl leading-none text-foreground">{potg.rebs}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1.5 font-medium">REB</p>
          </div>
          <div className="text-center">
            <p className="stat-numeral text-5xl leading-none text-foreground">{potg.assts}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1.5 font-medium">AST</p>
          </div>
        </div>

        <div className="mt-auto pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            {potg.gameResult}
          </p>
          <p className="text-[9px] text-muted-foreground/50 mt-0.5">{potg.date}</p>
        </div>
      </div>
    </div>
  );
};
