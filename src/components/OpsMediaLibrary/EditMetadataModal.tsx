import { X, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import type { OpsMediaPublication, MediaPublicationStatus } from '@/lib/api/ops';

export type EditMetadataModalProps = {
  publication: OpsMediaPublication | null;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: (title: string, status: MediaPublicationStatus, leagueId: string | null) => void;
  onCancel: () => void;
};

export function EditMetadataModal({
  publication,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: EditMetadataModalProps) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<MediaPublicationStatus>('draft');
  const [leagueId, setLeagueId] = useState('');

  useEffect(() => {
    if (publication && isOpen) {
      setTitle(publication.title || '');
      setStatus(publication.status);
      setLeagueId(publication.leagueId || '');
    }
  }, [publication, isOpen]);

  if (!isOpen || !publication) return null;

  const hasChanges =
    title !== publication.title ||
    status !== publication.status ||
    leagueId !== (publication.leagueId || '');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-sm max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Edit Metadata</h2>
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

        {/* Thumbnail */}
        {publication.thumbnail && (
          <div className="w-full h-32 bg-secondary rounded-sm overflow-hidden border border-border/50">
            <img
              src={publication.thumbnail}
              alt={publication.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm placeholder-muted-foreground disabled:opacity-50"
              placeholder="Publication title"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MediaPublicationStatus)}
              disabled={isLoading}
              className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* League */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">
              League
            </label>
            <select
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              disabled={isLoading}
              className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm disabled:opacity-50"
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

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-semibold border border-border rounded-sm hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(title, status, leagueId || null)}
            disabled={isLoading || !hasChanges}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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
      </div>
    </div>
  );
}
