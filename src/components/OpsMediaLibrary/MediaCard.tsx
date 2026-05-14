import { Image as ImageIcon, ChevronUp, ChevronDown, Edit2, Trash2, Eye, Pin, PinOff, RotateCcw, Square, CheckSquare } from 'lucide-react';
import type { OpsMediaPublication } from '@/lib/api/ops';
import type { LeagueId } from '@/types';
import { getLeagueConfig } from '@/lib/leagues';

export type MediaCardProps = {
  publication: OpsMediaPublication;
  isEditing: boolean;
  isSelected: boolean;
  isBulkMode: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onPreview: () => void;
  onRestore: () => void;
  onPin: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleSelect: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isLoading: boolean;
  editsDisabled: boolean;
};

export function MediaCard({
  publication: pub,
  isEditing,
  isSelected,
  isBulkMode,
  onEdit,
  onArchive,
  onPreview,
  onRestore,
  onPin,
  onMoveUp,
  onMoveDown,
  onToggleSelect,
  canMoveUp,
  canMoveDown,
  isLoading,
  editsDisabled,
}: MediaCardProps) {
  const leagueConfig = pub.leagueId ? getLeagueConfig(pub.leagueId as LeagueId) : null;
  const isPinned = pub.pinnedAt != null;
  const isArchived = pub.status === 'archived';

  const statusColor = {
    published: 'bg-success/15 text-success',
    draft: 'bg-secondary text-muted-foreground',
    scheduled: 'bg-warning/15 text-warning',
    archived: 'bg-destructive/15 text-destructive',
  }[pub.status] || 'bg-secondary text-muted-foreground';

  const surfaceLabel: Record<string, string> = {
    store: 'Store',
    potg: 'POTG',
    event: 'Event',
    media_feed: 'Generic',
    score: 'Score',
  };

  const surfaceColor = {
    store: 'bg-blue-500/15 text-blue-400',
    potg: 'bg-purple-500/15 text-purple-400',
    event: 'bg-amber-500/15 text-amber-400',
    media_feed: 'bg-green-500/15 text-green-400',
    score: 'bg-indigo-500/15 text-indigo-400',
  }[pub.surface] || 'bg-secondary text-muted-foreground';

  const confidencePct = pub.parserConfidence != null ? Math.round(pub.parserConfidence * 100) : null;
  const confidenceColor =
    confidencePct == null
      ? ''
      : confidencePct >= 80
      ? 'text-success'
      : confidencePct >= 50
      ? 'text-warning'
      : 'text-destructive';

  return (
    <div
      className={`border rounded-sm bg-card overflow-hidden transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      } ${isPinned ? 'ring-1 ring-primary/30' : ''}`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Bulk select checkbox */}
        {isBulkMode && (
          <button
            type="button"
            onClick={onToggleSelect}
            disabled={editsDisabled}
            className="flex-shrink-0 mt-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-50 transition-colors"
            aria-label={`${isSelected ? 'Deselect' : 'Select'} "${pub.title}"`}
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-primary" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
        )}

        {/* Thumbnail */}
        <button
          type="button"
          onClick={onPreview}
          disabled={isLoading || editsDisabled}
          className="flex-shrink-0 w-20 h-20 bg-secondary rounded-sm overflow-hidden border border-border/50 flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 min-w-[44px] min-h-[44px]"
          aria-label={`Preview "${pub.title}"`}
        >
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
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">
                {pub.title || <span className="text-muted-foreground italic">(untitled)</span>}
              </h3>
              {pub.createdAt && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(pub.createdAt).toLocaleDateString('en-CA', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
            {isPinned && (
              <span className="flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary flex items-center gap-1">
                <Pin className="w-2.5 h-2.5" />
                Pinned
              </span>
            )}
          </div>

          {/* Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm ${surfaceColor}`}>
              {surfaceLabel[pub.surface] ?? pub.surface}
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm ${statusColor}`}>
              {pub.status}
            </span>
            {leagueConfig && (
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm bg-secondary text-foreground flex items-center gap-1">
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
            {pub.needsReview && (
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm bg-warning/20 text-warning animate-pulse">
                Needs Review
              </span>
            )}
            {confidencePct != null && (
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-sm bg-secondary ${confidenceColor}`}>
                {confidencePct}% confidence
              </span>
            )}
          </div>
        </div>

        {/* Actions column */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {/* Reorder buttons — hidden in bulk mode */}
          {!isBulkMode && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp || isLoading || editsDisabled}
                className="p-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={`Move "${pub.title}" up`}
                title="Move up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown || isLoading || editsDisabled}
                className="p-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={`Move "${pub.title}" down`}
                title="Move down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-1 flex-wrap justify-end">
            <button
              type="button"
              onClick={onPreview}
              disabled={isLoading || editsDisabled}
              className="p-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={`Preview "${pub.title}"`}
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>

            {!isArchived && (
              <button
                type="button"
                onClick={onEdit}
                disabled={isLoading || editsDisabled}
                className="p-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={`Edit "${pub.title}"`}
                title="Edit metadata"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}

            {/* Pin / Unpin */}
            {!isArchived && (
              <button
                type="button"
                onClick={onPin}
                disabled={isLoading || editsDisabled}
                className={`p-2 rounded-sm border transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed ${
                  isPinned
                    ? 'border-primary/50 text-primary hover:bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
                aria-label={isPinned ? `Unpin "${pub.title}"` : `Pin "${pub.title}"`}
                title={isPinned ? 'Unpin' : 'Pin'}
              >
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
            )}

            {/* Archive or Restore */}
            {isArchived ? (
              <button
                type="button"
                onClick={onRestore}
                disabled={isLoading || editsDisabled}
                className="p-2 rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={`Restore "${pub.title}"`}
                title="Restore to draft"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onArchive}
                disabled={isPinned || isLoading || editsDisabled}
                className="p-2 rounded-sm border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={isPinned ? `Cannot archive pinned "${pub.title}"` : `Archive "${pub.title}"`}
                title={isPinned ? 'Unpin first to archive' : 'Archive'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
