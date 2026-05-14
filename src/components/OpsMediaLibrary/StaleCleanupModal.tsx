import { Archive, X, Loader2, Image as ImageIcon, CheckSquare, Square } from 'lucide-react';
import type { OpsStaleMedia } from '@/lib/api/ops';

export type StaleCleanupModalProps = {
  staleItems: OpsStaleMedia[];
  selectedIds: Set<string>;
  isOpen: boolean;
  isLoading: boolean;
  isFetching: boolean;
  days: number;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function StaleCleanupModal({
  staleItems,
  selectedIds,
  isOpen,
  isLoading,
  isFetching,
  days,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onConfirm,
  onCancel,
}: StaleCleanupModalProps) {
  if (!isOpen) return null;

  const allSelected = staleItems.length > 0 && selectedIds.size === staleItems.length;
  const noneSelected = selectedIds.size === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div
        className="bg-card border border-border rounded-sm w-full max-w-lg max-h-[90vh] flex flex-col"
        role="dialog"
        aria-label="Stale Media Cleanup"
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-6 pb-4 border-b border-border">
          <Archive className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base">Stale Media Cleanup</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {isFetching
                ? 'Loading stale items…'
                : `${staleItems.length} unpinned item${staleItems.length !== 1 ? 's' : ''} older than ${days} days (pinned and recently-edited items excluded).`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Select all bar */}
        {staleItems.length > 0 && (
          <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-secondary/20">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} of {staleItems.length} selected
            </span>
            <div className="flex gap-3">
              {!allSelected && (
                <button
                  type="button"
                  onClick={onSelectAll}
                  disabled={isLoading}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  Select All
                </button>
              )}
              {!noneSelected && (
                <button
                  type="button"
                  onClick={onDeselectAll}
                  disabled={isLoading}
                  className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
                >
                  Deselect All
                </button>
              )}
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isFetching && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading stale items…
            </div>
          )}
          {!isFetching && staleItems.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              No stale media found. All items are either pinned, recently edited, or newer than {days} days.
            </p>
          )}
          {!isFetching && staleItems.map((item) => {
            const selected = selectedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleSelect(item.id)}
                disabled={isLoading}
                className={`w-full flex items-center gap-3 p-3 rounded-sm border transition-colors text-left disabled:opacity-60 min-h-[44px] ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:bg-secondary/30'
                }`}
                aria-label={`${selected ? 'Deselect' : 'Select'} ${item.title || '(untitled)'}`}
              >
                {selected ? (
                  <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="w-10 h-10 flex-shrink-0 rounded-sm overflow-hidden bg-secondary border border-border/50 flex items-center justify-center">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.title || <span className="italic text-muted-foreground">(untitled)</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase">{item.surface}</span>
                    {item.createdAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-semibold border border-border rounded-sm hover:bg-secondary disabled:opacity-50 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || noneSelected}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-warning text-black rounded-sm hover:bg-warning/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Archiving…
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                Archive {selectedIds.size > 0 ? `${selectedIds.size} Item${selectedIds.size !== 1 ? 's' : ''}` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
