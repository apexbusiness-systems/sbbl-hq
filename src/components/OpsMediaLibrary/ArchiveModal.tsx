import { AlertCircle, X, Loader2 } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-sm max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base">Archive Media?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This will remove "{publication.title || '(untitled)'}" from public view.
              It can be restored later.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
            className="flex-1 px-4 py-2 text-sm font-semibold border border-border rounded-sm hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-destructive text-destructive-foreground rounded-sm hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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
