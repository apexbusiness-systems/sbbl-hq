import {
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  Edit2,
  Trash2,
  Eye,
  Pin,
  PinOff,
  RotateCcw,
  GripVertical,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { OpsMediaPublication } from '@/lib/api/ops';
import type { LeagueId } from '@/types';
import { getLeagueConfig } from '@/lib/leagues';
import { Checkbox } from '@/components/ui/checkbox';

export type MediaCardProps = {
  publication: OpsMediaPublication;
  isEditing: boolean;
  isBulkMode: boolean;
  isSelected: boolean;
  isLoading: boolean;
  editsDisabled: boolean;
  dragHandleProps?: Record<string, unknown>;
  onEdit: () => void;
  onArchive: () => void;
  onPreview: () => void;
  onRestore: () => void;
  onTogglePin: () => void;
  onToggleSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

/** Touch-target–compliant button classes. All icon buttons share this base. */
const btnBase =
  'inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

const btnDanger =
  'inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-sm border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

const btnAccent =
  'inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

const iconSz = 'w-4 h-4';

export function MediaCard({
  publication: pub,
  isEditing,
  isBulkMode,
  isSelected,
  isLoading,
  editsDisabled,
  dragHandleProps,
  onEdit,
  onArchive,
  onPreview,
  onRestore,
  onTogglePin,
  onToggleSelect,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: MediaCardProps) {
  const leagueConfig = pub.leagueId ? getLeagueConfig(pub.leagueId as LeagueId) : null;

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

  const isPinned = pub.pinnedAt !== null;
  const isNeedsReview = pub.needsReview === true;
  const showConfidence = pub.confidence != null && pub.confidence < 0.7;
  const confidenceBarColor =
    pub.confidence != null && pub.confidence < 0.5
      ? 'bg-red-500'
      : 'bg-amber-500';
  const confidenceLabel =
    pub.confidence != null && pub.confidence < 0.5
      ? 'Low confidence'
      : 'Med confidence';

  return (
    <div className="border border-border rounded-sm bg-card overflow-hidden hover:border-primary/50 transition-colors">
      <div className="flex items-start gap-3 p-3">
        {/* Drag handle (dnd-kit) */}
        {dragHandleProps && (
          <div
            className="flex items-center self-center cursor-grab text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] justify-center"
            {...dragHandleProps}
          >
            <GripVertical className={iconSz} />
          </div>
        )}

        {/* Bulk checkbox */}
        {isBulkMode && (
          <div className="flex items-center self-center min-w-[44px] min-h-[44px] justify-center">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              aria-label={`Select "${pub.title}"`}
            />
          </div>
        )}

        {/* Thumbnail — 64 × 64 */}
        <div className="flex-shrink-0 w-16 h-16 bg-secondary rounded-sm overflow-hidden border border-border/50 flex items-center justify-center">
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
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Title row */}
          <div className="flex items-center gap-1.5">
            {isPinned && (
              <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-label="Pinned" />
            )}
            <h3 className="font-semibold text-sm truncate">
              {pub.title || <span className="text-muted-foreground italic">(untitled)</span>}
            </h3>
            {/* Debug tooltip: ID on hover */}
            <span title={pub.id} className="flex-shrink-0 cursor-help">
              <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground" />
            </span>
          </div>

          {/* Chips row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${surfaceColor}`}>
              {pub.surface}
            </span>
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${statusColor}`}>
              {pub.status}
            </span>
            {leagueConfig && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-secondary text-foreground flex items-center gap-1">
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
            {isNeedsReview && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Review
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

          {/* Confidence bar */}
          {showConfidence && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${confidenceBarColor} transition-all`}
                  style={{ width: `${Math.round((pub.confidence ?? 0) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {confidenceLabel} ({Math.round((pub.confidence ?? 0) * 100)}%)
              </span>
            </div>
          )}
        </div>

        {/* Actions column */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {/* Reorder buttons */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp || isLoading || editsDisabled}
              className={btnBase}
              aria-label={`Move "${pub.title}" up`}
              title="Move up"
            >
              <ChevronUp className={iconSz} />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown || isLoading || editsDisabled}
              className={btnBase}
              aria-label={`Move "${pub.title}" down`}
              title="Move down"
            >
              <ChevronDown className={iconSz} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-1 justify-end">
            <button
              type="button"
              onClick={onPreview}
              disabled={isLoading || editsDisabled}
              className={btnBase}
              aria-label={`Preview "${pub.title}"`}
              title="Preview"
            >
              <Eye className={iconSz} />
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={isLoading || editsDisabled}
              className={btnBase}
              aria-label={`Edit "${pub.title}"`}
              title="Edit"
            >
              <Edit2 className={iconSz} />
            </button>
            {/* Pin toggle */}
            <button
              type="button"
              onClick={onTogglePin}
              disabled={isLoading || editsDisabled}
              className={btnAccent}
              aria-label={isPinned ? `Unpin "${pub.title}"` : `Pin "${pub.title}"`}
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              {isPinned ? <PinOff className={iconSz} /> : <Pin className={iconSz} />}
            </button>
            {/* Restore — only when archived */}
            {pub.status === 'archived' && (
              <button
                type="button"
                onClick={onRestore}
                disabled={isLoading || editsDisabled}
                className={btnAccent}
                aria-label={`Restore "${pub.title}"`}
                title="Restore"
              >
                <RotateCcw className={iconSz} />
              </button>
            )}
            {/* Archive */}
            <button
              type="button"
              onClick={onArchive}
              disabled={pub.status === 'archived' || isLoading || editsDisabled}
              className={btnDanger}
              aria-label={`Archive "${pub.title}"`}
              title="Archive"
            >
              <Trash2 className={iconSz} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
