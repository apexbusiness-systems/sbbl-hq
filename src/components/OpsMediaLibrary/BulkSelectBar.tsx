import { Archive, X, CheckSquare, Loader2 } from 'lucide-react';

export type BulkSelectBarProps = {
  selectedCount: number;
  totalCount: number;
  isBulkArchiving: boolean;
  onBulkArchive: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
};

export function BulkSelectBar({
  selectedCount,
  totalCount,
  isBulkArchiving,
  onBulkArchive,
  onSelectAll,
  onClearSelection,
}: BulkSelectBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-card border border-primary/60 rounded-sm px-4 py-3 flex items-center gap-3 shadow-lg">
      <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
      <span className="text-sm font-semibold text-foreground flex-1">
        {selectedCount} of {totalCount} selected
      </span>
      {selectedCount < totalCount && (
        <button
          type="button"
          onClick={onSelectAll}
          disabled={isBulkArchiving}
          className="text-xs text-primary hover:underline disabled:opacity-50 min-h-[44px] px-2"
        >
          Select All
        </button>
      )}
      <button
        type="button"
        onClick={onBulkArchive}
        disabled={isBulkArchiving || selectedCount === 0}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-destructive text-destructive-foreground rounded-sm hover:bg-destructive/90 disabled:opacity-50 transition-colors min-h-[44px]"
        aria-label={`Archive ${selectedCount} selected item${selectedCount !== 1 ? 's' : ''}`}
      >
        {isBulkArchiving ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Archiving…
          </>
        ) : (
          <>
            <Archive className="w-3.5 h-3.5" />
            Archive {selectedCount}
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onClearSelection}
        disabled={isBulkArchiving}
        className="text-muted-foreground hover:text-foreground disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Clear selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
