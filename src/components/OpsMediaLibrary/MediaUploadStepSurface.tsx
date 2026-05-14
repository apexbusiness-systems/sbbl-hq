const SURFACES = [
  { value: 'store', label: 'Store', icon: '🏪' },
  { value: 'potg', label: 'POTG', icon: '🏆' },
  { value: 'event', label: 'Event', icon: '📅' },
  { value: 'media_feed', label: 'Feed', icon: '📰' },
  { value: 'generic', label: 'Generic', icon: '🖼️' },
] as const;

export type MediaUploadStepSurfaceProps = {
  selectedSurface: string | null;
  onSelect: (surface: string) => void;
  disabled?: boolean;
};

const SURFACE_CARD_CLASS =
  'w-20 h-20 flex flex-col items-center justify-center gap-1.5 border rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export function MediaUploadStepSurface({
  selectedSurface,
  onSelect,
  disabled,
}: MediaUploadStepSurfaceProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Select Surface</h3>
      <div className="flex flex-wrap gap-3">
        {SURFACES.map(({ value, label, icon }) => {
          const isSelected = selectedSurface === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              disabled={disabled}
              className={`${SURFACE_CARD_CLASS} ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
              aria-label={`Select ${label}`}
              aria-pressed={isSelected}
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-[10px] font-bold uppercase">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
