import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import type { OpsMediaPublication, MediaPublicationStatus } from '@/lib/api/ops';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

export type EditMetadataSheetProps = {
  publication: OpsMediaPublication | null;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: (title: string, status: MediaPublicationStatus, leagueId: string | null) => void;
  onCancel: () => void;
};

export function EditMetadataSheet({
  publication,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: EditMetadataSheetProps) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<MediaPublicationStatus>('draft');
  const [leagueId, setLeagueId] = useState('');

  useEffect(() => {
    if (publication && isOpen) {
      setTitle(publication.title || '');
      setStatus(publication.status as MediaPublicationStatus);
      setLeagueId(publication.leagueId || '');
    }
  }, [publication, isOpen]);

  const hasChanges =
    publication != null && (
      title !== publication.title ||
      status !== publication.status ||
      leagueId !== (publication.leagueId || '')
    );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col gap-0 p-0 overflow-y-auto"
        aria-label="Edit Metadata"
      >
        <SheetHeader className="p-6 pb-4 border-b border-border flex-shrink-0">
          <SheetTitle className="text-base font-semibold normal-case tracking-normal">
            Edit Metadata
          </SheetTitle>
          {publication && (
            <SheetDescription className="text-xs text-muted-foreground truncate">
              {publication.title || '(untitled)'}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 p-6 space-y-5">
          {/* Thumbnail preview */}
          {publication?.thumbnail && (
            <div className="w-full h-36 bg-secondary rounded-sm overflow-hidden border border-border/50">
              <img
                src={publication.thumbnail}
                alt={publication.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm placeholder-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[44px]"
              placeholder="Publication title"
              autoFocus
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MediaPublicationStatus)}
              disabled={isLoading}
              className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[44px]"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* League */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
              League
            </label>
            <select
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              disabled={isLoading}
              className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[44px]"
            >
              <option value="">None</option>
              {LEAGUE_REGISTRY.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 flex gap-2 p-6 pt-4 border-t border-border">
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
            onClick={() => publication && onConfirm(title, status, leagueId || null)}
            disabled={isLoading || !hasChanges}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
