import { RotateCcw, X, Loader2 } from 'lucide-react';
import type { OpsMediaPublication } from '@/lib/api/ops';

export type RestoreModalProps = {
  publication: OpsMediaPublication | null;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RestoreModal({
  publication,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: RestoreModalProps) {
  if (!isOpen || !publication) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div
        className="bg-card border border-border rounded-sm max-w-sm w-full p-6 space-y-4"
        role="dialog"
        aria-label="Restore Media"
      >
        <div className="flex items-start gap-3">
          <RotateCcw className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base">Restore to Draft?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              "{publication.title || '(untitled)'}" will be restored to{' '}
              <span className="font-semibold">Draft</span> status and removed from the archive.
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

        {publication.thumbnail && (
          <div className="w-full h-28 bg-secondary rounded-sm overflow-hidden border border-border/50">
            <img
              src={publication.thumbnail}
              alt={publication.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="bg-secondary/30 p-3 rounded-sm space-y-1.5 text-xs">
          <p>
            <span className="text-muted-foreground">Title:</span> {publication.title || '(untitled)'}
          </p>
          <p>
            <span className="text-muted-foreground">Surface:</span> {publication.surface}
          </p>
          <p>
            <span className="text-muted-foreground">Current status:</span>{' '}
            <span className="text-destructive font-semibold">archived</span>
          </p>
        </div>

        <div className="flex gap-2 pt-1">
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
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Restoring…
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Restore
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
