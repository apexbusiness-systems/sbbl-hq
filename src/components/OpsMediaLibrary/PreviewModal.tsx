import { X, Image as ImageIcon } from 'lucide-react';
import { getLeagueConfig } from '@/lib/leagues';
import type { OpsMediaPublication } from '@/lib/api/ops';
import type { LeagueId } from '@/types';

export type PreviewModalProps = {
  publication: OpsMediaPublication | null;
  isOpen: boolean;
  onClose: () => void;
};

export function PreviewModal({ publication, isOpen, onClose }: PreviewModalProps) {
  if (!isOpen || !publication) return null;

  const leagueConfig = publication.leagueId
    ? getLeagueConfig(publication.leagueId as LeagueId)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-sm max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-base">Preview</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Large thumbnail */}
          {publication.thumbnail ? (
            <div className="w-full bg-secondary rounded-sm overflow-hidden border border-border/50 aspect-video flex items-center justify-center">
              <img
                src={publication.thumbnail}
                alt={publication.title}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-full bg-secondary rounded-sm border border-border/50 aspect-video flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground" />
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                Title
              </p>
              <p className="font-semibold text-base">
                {publication.title || <span className="text-muted-foreground italic">(untitled)</span>}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                  Surface
                </p>
                <p className="font-medium capitalize">{publication.surface}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                  Status
                </p>
                <p className="font-medium capitalize">{publication.status}</p>
              </div>
            </div>

            {leagueConfig && (
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                  League
                </p>
                <div className="flex items-center gap-2">
                  <img
                    src={leagueConfig.logo}
                    alt={leagueConfig.name}
                    className="w-4 h-4 opacity-80"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <p className="font-medium">{leagueConfig.name}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {publication.createdAt && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Created
                  </p>
                  <p className="font-mono text-xs">
                    {new Date(publication.createdAt).toLocaleDateString('en-CA', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {publication.publishedAt && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Published
                  </p>
                  <p className="font-mono text-xs">
                    {new Date(publication.publishedAt).toLocaleDateString('en-CA', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                ID
              </p>
              <p className="font-mono text-xs text-muted-foreground break-all">
                {publication.id}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
