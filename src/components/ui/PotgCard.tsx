import type { PlayerOfTheGame } from '@/types';
import { Trophy } from 'lucide-react';

interface PotgCardProps {
  potg: PlayerOfTheGame;
  featured?: boolean;
}

export const PotgCard = ({ potg, featured = false }: PotgCardProps) => {
  return (
    <div
      className={`relative bg-card border border-border rounded-sm overflow-hidden flex-shrink-0 flex flex-col transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_24px_-4px_hsl(43_52%_54%/0.15)] ${
        featured ? 'min-w-[320px]' : 'min-w-[260px]'
      }`}
    >
      {/* Gold accent top bar */}
      <div className="h-[3px] bg-gradient-to-r from-primary via-primary/60 to-transparent" />

      <div className={`p-5 flex flex-col flex-1 ${featured ? 'p-6' : 'p-5'}`}>
        {/* Label */}
        <div className="flex items-center gap-1.5 mb-4">
          <Trophy className="w-3 h-3 text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
            Player of the Game
          </span>
        </div>

        {/* Player name */}
        <h3
          className={`font-display uppercase leading-none text-foreground mb-2 ${
            featured ? 'text-4xl' : 'text-3xl'
          }`}
        >
          {potg.playerName}
        </h3>

        {/* Team badge */}
        <span className="inline-flex items-center self-start px-2 py-0.5 bg-primary/12 border border-primary/25 text-primary text-[10px] font-bold uppercase tracking-widest rounded-sm mb-5">
          {potg.team}
        </span>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1 mb-5">
          <div className="text-center">
            <p className={`stat-numeral leading-none text-foreground ${featured ? 'text-5xl' : 'text-4xl'}`}>
              {potg.pts}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1.5 font-medium">PTS</p>
          </div>
          <div className="text-center border-x border-border">
            <p className={`stat-numeral leading-none text-foreground ${featured ? 'text-5xl' : 'text-4xl'}`}>
              {potg.rebs}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1.5 font-medium">REB</p>
          </div>
          <div className="text-center">
            <p className={`stat-numeral leading-none text-foreground ${featured ? 'text-5xl' : 'text-4xl'}`}>
              {potg.assts}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1.5 font-medium">AST</p>
          </div>
        </div>

        {/* Game result */}
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
