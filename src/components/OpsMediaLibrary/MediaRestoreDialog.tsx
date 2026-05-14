import { Loader2, RotateCcw } from 'lucide-react';
import type { OpsMediaPublication } from '@/lib/api/ops';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export type MediaRestoreDialogProps = {
  publication: OpsMediaPublication | null;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function MediaRestoreDialog({
  publication,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: MediaRestoreDialogProps) {
  if (!publication) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary" />
            Restore to Draft?
          </DialogTitle>
          <DialogDescription>
            This will restore &ldquo;{publication.title || '(untitled)'}&rdquo; to draft status.
            It will not be publicly visible until published again.
          </DialogDescription>
        </DialogHeader>

        {publication.thumbnail && (
          <div className="w-full h-32 bg-secondary rounded-sm overflow-hidden border border-border/50">
            <img
              src={publication.thumbnail}
              alt={publication.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="bg-secondary/30 p-3 rounded-sm space-y-1 text-xs">
          <p><span className="text-muted-foreground">Surface:</span> {publication.surface}</p>
          <p><span className="text-muted-foreground">Current status:</span> {publication.status}</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="min-h-[44px] px-4 py-2 text-sm font-semibold border border-border rounded-sm hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="min-h-[44px] px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
