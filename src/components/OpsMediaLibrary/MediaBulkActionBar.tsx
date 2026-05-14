import { Archive, X, Loader2 } from 'lucide-react';

export type MediaBulkActionBarProps = {
  selectedCount: number;
  isArchivePending: boolean;
  error?: string | null;
  onArchive: () => void;
  onCancel: () => void;
  onDeselectAll: () => void;
};

export function MediaBulkActionBar({
  selectedCount,
  isArchivePending,
  error,
  onArchive,
  onCancel,
  onDeselectAll,
}: MediaBulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-sm">
      <span className="text-sm font-semibold min-w-[44px] min-h-[44px] flex items-center px-2">
        {selectedCount} selected
      </span>
      <button
        type="button"
        onClick={onArchive}
        disabled={isArchivePending || selectedCount === 0}
        className="flex items-center gap-2 min-h-[44px] px-4 py-2 text-sm font-semibold bg-destructive text-destructive-foreground rounded-sm hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isArchivePending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Archiving…
          </>
        ) : (
          <>
            <Archive className="w-4 h-4" />
            Archive
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onDeselectAll}
        disabled={isArchivePending}
        className="flex items-center gap-2 min-h-[44px] px-4 py-2 text-sm font-semibold border border-border rounded-sm hover:bg-secondary disabled:opacity-50 transition-colors"
      >
        Deselect All
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="ml-auto min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Exit bulk mode"
      >
        <X className="w-5 h-5" />
      </button>
      {error && (
        <p className="text-xs text-destructive ml-2">{error}</p>
      )}
    </div>
  );
}
