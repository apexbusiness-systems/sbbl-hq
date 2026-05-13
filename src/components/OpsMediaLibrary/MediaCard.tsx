import { Image as ImageIcon, ChevronUp, ChevronDown, Edit2, Trash2, Eye } from 'lucide-react';
import type { OpsMediaPublication } from '@/lib/api/ops';
import { getLeagueConfig } from '@/lib/leagues';

export type MediaCardProps = {
  publication: OpsMediaPublication;
  isEditing: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onPreview: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isLoading: boolean;
  editsDisabled: boolean;
};

export function MediaCard({
  publication: pub,
  isEditing,
  onEdit,
  onArchive,
  onPreview,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isLoading,
  editsDisabled,
}: MediaCardProps) {
  const leagueConfig = pub.leagueId ? getLeagueConfig(pub.leagueId as any) : null;

  const statusColor = {
    published: 'bg-success/15 text-success',
    draft: 'bg-secondary text-muted-foreground',
    scheduled: 'bg-warning/15 text-warning',
    archived: 'bg-destructive/15 text-destructive',
  }[pub.status] || 'bg-secondary text-muted-foreground';

  const surfaceColor = {
    store: 'bg-blue-500/15 text-blue-400',
    potg: 'bg-purple-500/15 text-purple-400',
    event: 'bg-amber-500/15 text-amber-400',
    media_feed: 'bg-green-500/15 text-green-400',
    score: 'bg-indigo-500/15 text-indigo-400',
  }[pub.surface] || 'bg-secondary text-muted-foreground';

  return (
    <div className="border border-border rounded-sm bg-card overflow-hidden hover:border-primary/50 transition-colors">
      <div className="flex items-start gap-4 p-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-24 h-24 bg-secondary rounded-sm overflow-hidden border border-border/50 flex items-center justify-center">
          {pub.thumbnail ? (
            <img
              src={pub.thumbnail}
              alt={pub.title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2.5">
          <div>
            <h3 className="font-semibold text-sm truncate">
              {pub.title || <span className="text-muted-foreground italic">(untitled)</span>}
            </h3>
            <p className="text-xs text-muted-foreground">
              ID: {pub.id.slice(0, 8)}
            </p>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm ${surfaceColor}`}>
              {pub.surface}
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm ${statusColor}`}>
              {pub.status}
            </span>
            {leagueConfig && (
              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm bg-secondary text-foreground flex items-center gap-1`}>
                <img
                  src={leagueConfig.logo}
                  alt={leagueConfig.shortName}
                  className="w-3 h-3 opacity-80"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                {leagueConfig.shortName}
              </span>
            )}
            {pub.createdAt && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(pub.createdAt).toLocaleDateString('en-CA', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {/* Reorder buttons */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp || isLoading || editsDisabled}
              className="p-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label={`Move "${pub.title}" up`}
              title="Move up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown || isLoading || editsDisabled}
              className="p-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label={`Move "${pub.title}" down`}
              title="Move down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onPreview}
              disabled={isLoading || editsDisabled}
              className="p-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label={`Preview "${pub.title}"`}
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={isLoading || editsDisabled}
              className="p-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label={`Edit "${pub.title}"`}
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onArchive}
              disabled={pub.status === 'archived' || isLoading || editsDisabled}
              className="p-2 rounded-sm border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label={`Archive "${pub.title}"`}
              title="Archive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
