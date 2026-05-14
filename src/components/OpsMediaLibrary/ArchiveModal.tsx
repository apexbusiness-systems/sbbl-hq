import { AlertCircle, X, Loader2, Pin } from 'lucide-react';
import type { OpsMediaPublication } from '@/lib/api/ops';

export type ArchiveModalProps = {
  publication: OpsMediaPublication | null;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ArchiveModal({
  publication,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: ArchiveModalProps) {
  if (!isOpen || !publication) return null;

  const isPinned = publication.pinnedAt !== null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-sm max-w-sm w-full p-6 space-y-4" role="dialog" aria-label="Archive Media">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base">Archive, Not Delete</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This will soft-archive "{publication.title || '(untitled)'}" from public view.
              It is not permanently deleted and can be restored later.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pinned warning */}
        {isPinned && (
          <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-sm p-3">
            <Pin className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive font-medium">
              This item is pinned. Unpin before archiving.
            </p>
          </div>
        )}

        {/* Preview */}
        {publication.thumbnail && (
          <div className="w-full h-32 bg-secondary rounded-sm overflow-hidden border border-border/50">
            <img
              src={publication.thumbnail}
              alt={publication.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Details */}
        <div className="bg-secondary/30 p-3 rounded-sm space-y-2 text-xs">
          <p>
            <span className="text-muted-foreground">Title:</span> {publication.title || '(untitled)'}
          </p>
          <p>
            <span className="text-muted-foreground">Surface:</span> {publication.surface}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span> {publication.status}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-semibold border border-border rounded-sm hover:bg-secondary disabled:opacity-50 transition-colors min-h-[44px]"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || isPinned}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-destructive text-destructive-foreground rounded-sm hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Archiving…
              </>
            ) : (
              'Archive'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
