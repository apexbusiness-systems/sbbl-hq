import { LEAGUE_REGISTRY } from '@/lib/leagues';

export type MediaUploadStepLeagueProps = {
  selectedLeagueId: string | null;
  onSelect: (leagueId: string) => void;
  disabled?: boolean;
};

const LEAGUE_CARD_CLASS =
  'w-20 h-20 flex flex-col items-center justify-center gap-1.5 border rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export function MediaUploadStepLeague({
  selectedLeagueId,
  onSelect,
  disabled,
}: MediaUploadStepLeagueProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Select League</h3>
      <div className="flex flex-wrap gap-3">
        {LEAGUE_REGISTRY.map((league) => {
          const isSelected = selectedLeagueId === league.id;
          return (
            <button
              key={league.id}
              type="button"
              onClick={() => onSelect(league.id)}
              disabled={disabled}
              className={`${LEAGUE_CARD_CLASS} ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
              aria-label={`Select ${league.name}`}
              aria-pressed={isSelected}
            >
              <img
                src={league.logo}
                alt={league.shortName}
                className="w-10 h-10 opacity-80"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="text-[10px] font-bold uppercase">{league.shortName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
