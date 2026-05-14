const STATUSES = [
  { value: 'draft' as const, label: 'Draft', desc: 'Save without publishing' },
  { value: 'published' as const, label: 'Published', desc: 'Visible to public' },
  { value: 'needs_review' as const, label: 'Needs Review', desc: 'Draft flagged for review' },
] as const;

export type MediaUploadStepStatusProps = {
  selectedStatus: 'draft' | 'published' | 'needs_review';
  onSelect: (status: 'draft' | 'published' | 'needs_review') => void;
  disabled?: boolean;
};

export function MediaUploadStepStatus({
  selectedStatus,
  onSelect,
  disabled,
}: MediaUploadStepStatusProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Publication Status</h3>
      <div className="flex flex-col gap-2">
        {STATUSES.map(({ value, label, desc }) => {
          const isSelected = selectedStatus === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              disabled={disabled}
              className={`min-h-[44px] flex items-center gap-3 px-4 py-3 border rounded-sm transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
              role="radio"
              aria-checked={isSelected}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  isSelected ? 'border-primary' : 'border-border'
                }`}
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
