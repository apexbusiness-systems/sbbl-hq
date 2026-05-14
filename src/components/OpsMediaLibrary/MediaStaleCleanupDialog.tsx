import { useState } from 'react';
import { Loader2, AlertTriangle, Clock, Archive } from 'lucide-react';
import type { StaleCleanupPreviewResponse, StaleCleanupExecuteResponse } from '@/lib/api/ops';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export type MediaStaleCleanupDialogProps = {
  isOpen: boolean;
  olderThanDays: number;
  onOlderThanDaysChange: (days: number) => void;
  previewResult: StaleCleanupPreviewResponse | null;
  executeResult: StaleCleanupExecuteResponse | null;
  isPreviewLoading: boolean;
  isExecuteLoading: boolean;
  previewError: Error | null;
  executeError: Error | null;
  onFetchPreview: () => void;
  onExecute: () => void;
  onClose: () => void;
};

type Phase = 'preview' | 'confirm' | 'result';

const CONFIRM_TEXT = 'ARCHIVE';

/**
 * Two-phase shadcn Dialog for stale media cleanup.
 *
 * Phase 1 (Preview): Days slider + affected count + exclusion counts +
 *   "results may change" warning. User clicks Preview, then Proceed.
 * Phase 2 (Confirm): Must type "ARCHIVE" to enable the Execute button.
 *   Shows count again + irreversibility warning. Execute is destructive.
 * Phase 3 (Result): After execution, shows archived count + IDs. Close.
 */
export function MediaStaleCleanupDialog({
  isOpen,
  olderThanDays,
  onOlderThanDaysChange,
  previewResult,
  executeResult,
  isPreviewLoading,
  isExecuteLoading,
  previewError,
  executeError,
  onFetchPreview,
  onExecute,
  onClose,
}: MediaStaleCleanupDialogProps) {
  const [phase, setPhase] = useState<Phase>('preview');
  const [confirmInput, setConfirmInput] = useState<string>('');

  /** Reset local state when dialog closes. */
  const handleClose = (): void => {
    setPhase('preview');
    setConfirmInput('');
    onClose();
  };

  const canExecute = confirmInput === CONFIRM_TEXT;

  // ─── Phase 1: Preview ──────────────────────────────────────────────
  const renderPreview = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Stale Media Cleanup
        </DialogTitle>
        <DialogDescription>
          Preview and archive media publications older than a specified number
          of days. Pinned items and recently edited items are always excluded.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 py-4">
        {/* Days slider */}
        <div className="space-y-2">
          <label
            htmlFor="stale-days-slider"
            className="text-sm font-medium leading-none"
          >
            Older than{' '}
            <span className="text-primary font-bold">{olderThanDays}</span>{' '}
            day{olderThanDays !== 1 ? 's' : ''}
          </label>
          <input
            id="stale-days-slider"
            type="range"
            min={1}
            max={90}
            step={1}
            value={olderThanDays}
            onChange={(e) => onOlderThanDaysChange(Number(e.target.value))}
            className="w-full min-h-[44px] cursor-pointer accent-primary"
            aria-valuemin={1}
            aria-valuemax={90}
            aria-valuenow={olderThanDays}
            aria-label="Days threshold for stale media"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 day</span>
            <span>90 days</span>
          </div>
        </div>

        {/* Preview button */}
        <button
          type="button"
          onClick={onFetchPreview}
          disabled={isPreviewLoading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          style={{ minHeight: 44 }}
        >
          {isPreviewLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Preview Affected
        </button>

        {/* Preview error */}
        {previewError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{previewError.message}</span>
          </div>
        )}

        {/* Preview results */}
        {previewResult && (
          <div className="space-y-4 rounded-md border p-4">
            {/* Total affected */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Publications affected</span>
              <span className="text-lg font-bold text-destructive">
                {previewResult.totalAffected}
              </span>
            </div>

            {/* Thumbnails of first 10 */}
            {previewResult.publications.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  Showing first {Math.min(10, previewResult.publications.length)}{' '}
                  of {previewResult.totalAffected}
                </span>
                <div className="flex flex-wrap gap-2">
                  {previewResult.publications.slice(0, 10).map((pub) => (
                    <div
                      key={pub.id}
                      className="group relative h-14 w-14 overflow-hidden rounded border bg-muted"
                      title={`${pub.title ?? 'Untitled'} — ${pub.daysSincePublish}d old`}
                    >
                      {pub.thumbnail ? (
                        <img
                          src={pub.thumbnail}
                          alt={pub.title ?? 'Media thumbnail'}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          <Archive className="h-4 w-4" />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="truncate text-[9px] leading-tight text-white">
                          {pub.daysSincePublish}d
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exclusion counts */}
            <div className="grid gap-1 text-sm text-muted-foreground">
              {previewResult.excludedPinned > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                  <span>
                    {previewResult.excludedPinned} pinned publication
                    {previewResult.excludedPinned !== 1 ? 's' : ''} excluded
                  </span>
                </div>
              )}
              {previewResult.excludedRecentlyEdited > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  <span>
                    {previewResult.excludedRecentlyEdited} recently edited
                    {previewResult.excludedRecentlyEdited !== 1 ? 's' : ''}{' '}
                    excluded
                  </span>
                </div>
              )}
            </div>

            {/* "Results may change" warning */}
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Results may change at execution time — the server re-validates
                criteria before archiving.
              </span>
            </div>

            {/* Proceed button */}
            <button
              type="button"
              disabled={previewResult.totalAffected === 0}
              onClick={() => setPhase('confirm')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              style={{ minHeight: 44 }}
            >
              Proceed to Confirm
            </button>
          </div>
        )}
      </div>

      <DialogFooter>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ minHeight: 44 }}
        >
          Cancel
        </button>
      </DialogFooter>
    </>
  );

  // ─── Phase 2: Confirm ─────────────────────────────────────────────
  const renderConfirm = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Confirm Archive
        </DialogTitle>
        <DialogDescription>
          This action is irreversible. Archived publications will be removed from
          the active media library.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 py-4">
        {/* Count reminder */}
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm">
            You are about to archive{' '}
            <span className="font-bold text-destructive">
              {previewResult?.totalAffected ?? 0}
            </span>{' '}
            publication{(previewResult?.totalAffected ?? 0) !== 1 ? 's' : ''}.
          </p>
        </div>

        {/* Irreversibility warning */}
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This operation cannot be undone. The server will re-validate criteria
            at execution time, so the actual count may differ from the preview.
          </span>
        </div>

        {/* Type-to-confirm input */}
        <div className="space-y-2">
          <label
            htmlFor="stale-confirm-input"
            className="text-sm font-medium leading-none"
          >
            Type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{CONFIRM_TEXT}</code> to confirm
          </label>
          <input
            id="stale-confirm-input"
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={CONFIRM_TEXT}
            autoComplete="off"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: 44 }}
          />
        </div>

        {/* Execute error */}
        {executeError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{executeError.message}</span>
          </div>
        )}

        {/* Execute button */}
        <button
          type="button"
          disabled={!canExecute || isExecuteLoading}
          onClick={onExecute}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          style={{ minHeight: 44 }}
        >
          {isExecuteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          <Archive className="h-4 w-4" />
          Execute Archive
        </button>
      </div>

      <DialogFooter>
        <button
          type="button"
          onClick={() => {
            setPhase('preview');
            setConfirmInput('');
          }}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ minHeight: 44 }}
        >
          Back to Preview
        </button>
      </DialogFooter>
    </>
  );

  // ─── Phase 3: Result ──────────────────────────────────────────────
  const renderResult = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-primary" />
          Archive Complete
        </DialogTitle>
        <DialogDescription>
          The stale media cleanup has been executed.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {/* Archived count */}
        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Publications archived</span>
            <span className="text-lg font-bold text-primary">
              {executeResult?.archived ?? 0}
            </span>
          </div>
        </div>

        {/* Archived IDs */}
        {executeResult && executeResult.ids.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Archived IDs
            </span>
            <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-2">
              <div className="flex flex-wrap gap-1.5">
                {executeResult.ids.map((id) => (
                  <code
                    key={id}
                    className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                  >
                    {id.slice(0, 8)}&hellip;
                  </code>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Execute error */}
        {executeError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{executeError.message}</span>
          </div>
        )}
      </div>

      <DialogFooter>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ minHeight: 44 }}
        >
          Close
        </button>
      </DialogFooter>
    </>
  );

  // ─── Phase transition: auto-advance to result on successful execute ───
  // Parent controls when executeResult is set. We detect it here.
  const activePhase: Phase = executeResult && phase === 'confirm' ? 'result' : phase;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        {activePhase === 'preview' && renderPreview()}
        {activePhase === 'confirm' && renderConfirm()}
        {activePhase === 'result' && renderResult()}
      </DialogContent>
    </Dialog>
  );
}

export default MediaStaleCleanupDialog;
