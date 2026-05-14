import {
  GripVertical,
  Image as ImageIcon,
  Eye,
  Edit2,
  Pin,
  PinOff,
  Trash2,
  RotateCcw,
  Square,
  CheckSquare,
} from 'lucide-react';
import type { OpsMediaPublication } from '@/lib/api/ops';
import type { LeagueId } from '@/types';
import { getLeagueConfig } from '@/lib/leagues';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';

export type MediaCardProps = {
  publication: OpsMediaPublication;
  isSelected: boolean;
  isBulkMode: boolean;
  isDragMode: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onPreview: () => void;
  onRestore: () => void;
  onPin: () => void;
  onToggleSelect: () => void;
  isLoading: boolean;
  editsDisabled: boolean;
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: DraggableAttributes;
  isDragging?: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-success/15 text-success border-success/20',
  draft:     'bg-secondary text-muted-foreground border-border',
  scheduled: 'bg-warning/15 text-warning border-warning/20',
  archived:  'bg-destructive/15 text-destructive border-destructive/20',
};

const SURFACE_STYLES: Record<string, string> = {
  store:      'bg-blue-500/15 text-blue-400',
  potg:       'bg-purple-500/15 text-purple-400',
  event:      'bg-amber-500/15 text-amber-400',
  media_feed: 'bg-green-500/15 text-green-400',
  score:      'bg-indigo-500/15 text-indigo-400',
};

const SURFACE_LABELS: Record<string, string> = {
  store: 'Store', potg: 'POTG', event: 'Event', media_feed: 'Generic', score: 'Score',
};

function IconBtn({
  onClick, disabled, label, title, children, className = '',
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={`min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

export function MediaCard({
  publication: pub,
  isSelected,
  isBulkMode,
  isDragMode,
  onEdit,
  onArchive,
  onPreview,
  onRestore,
  onPin,
  onToggleSelect,
  isLoading,
  editsDisabled,
  dragListeners,
  dragAttributes,
  isDragging,
}: MediaCardProps) {
  const leagueConfig = pub.leagueId ? getLeagueConfig(pub.leagueId as LeagueId) : null;
  const isPinned = pub.pinnedAt != null;
  const isArchived = pub.status === 'archived';
  const confidencePct = pub.parserConfidence != null
    ? Math.round(pub.parserConfidence * 100) : null;

  const cardBorder = isSelected
    ? 'border-primary bg-primary/5'
    : isPinned
    ? 'border-primary/40 hover:border-primary/70'
    : 'border-border hover:border-primary/40';

  return (
    <div
      className={`border rounded-sm bg-card transition-all duration-150 overflow-hidden ${cardBorder} ${isDragging ? 'opacity-50 shadow-lg scale-[1.01]' : ''}`}
    >
      <div className="flex items-stretch gap-0">

        {/* Drag handle — only in sort_order mode */}
        {isDragMode && (
          <button
            type="button"
            {...dragListeners}
            {...dragAttributes}
            disabled={editsDisabled}
            aria-label="Drag to reorder"
            className="flex-shrink-0 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 border-r border-border cursor-grab active:cursor-grabbing disabled:opacity-40 touch-none transition-colors"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}

        {/* Bulk-select checkbox */}
        {isBulkMode && (
          <button
            type="button"
            onClick={onToggleSelect}
            disabled={editsDisabled}
            aria-label={`${isSelected ? 'Deselect' : 'Select'} "${pub.title}"`}
            className="flex-shrink-0 w-10 flex items-center justify-center text-muted-foreground hover:text-primary border-r border-border disabled:opacity-40 transition-colors"
          >
            {isSelected
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4" />}
          </button>
        )}

        {/* Thumbnail — tap to preview */}
        <button
          type="button"
          onClick={onPreview}
          disabled={isLoading || editsDisabled}
          aria-label={`Preview "${pub.title}"`}
          className="flex-shrink-0 w-16 sm:w-20 self-stretch overflow-hidden bg-secondary border-r border-border flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {pub.thumbnail ? (
            <img
              src={pub.thumbnail}
              alt={pub.title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            />
          ) : (
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0">

          {/* Text + chips */}
          <div className="flex-1 min-w-0 p-3">
            {/* Title row */}
            <div className="flex items-start gap-1.5 mb-1.5">
              <h3 className="flex-1 font-semibold text-sm leading-tight line-clamp-2">
                {pub.title || <span className="text-muted-foreground italic">(untitled)</span>}
              </h3>
              {isPinned && (
                <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary border border-primary/25">
                  <Pin className="w-2.5 h-2.5" />
                  Pinned
                </span>
              )}
            </div>

            {/* Date */}
            {pub.createdAt && (
              <p className="text-[10px] text-muted-foreground mb-2">
                {new Date(pub.createdAt).toLocaleDateString('en-CA', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </p>
            )}

            {/* Chips */}
            <div className="flex flex-wrap gap-1">
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${SURFACE_STYLES[pub.surface] ?? 'bg-secondary text-muted-foreground'}`}>
                {SURFACE_LABELS[pub.surface] ?? pub.surface}
              </span>
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${STATUS_STYLES[pub.status] ?? 'bg-secondary text-muted-foreground border-border'}`}>
                {pub.status}
              </span>
              {leagueConfig && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-secondary text-foreground">
                  <img
                    src={leagueConfig.logo}
                    alt={leagueConfig.shortName}
                    className="w-3 h-3 opacity-80"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  {leagueConfig.shortName}
                </span>
              )}
              {pub.needsReview && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-warning/20 text-warning animate-pulse border border-warning/20">
                  Needs Review
                </span>
              )}
              {confidencePct != null && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-secondary ${
                  confidencePct >= 80 ? 'text-success' : confidencePct >= 50 ? 'text-warning' : 'text-destructive'
                }`}>
                  {confidencePct}%
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex-shrink-0 flex items-center gap-1 px-2 py-2 sm:px-3 border-t sm:border-t-0 sm:border-l border-border bg-secondary/10">

            {/* Preview */}
            <IconBtn
              onClick={onPreview}
              disabled={isLoading || editsDisabled}
              label={`Preview "${pub.title}"`}
              title="Preview"
              className="border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <Eye className="w-4 h-4" />
            </IconBtn>

            {/* Edit (not for archived) */}
            {!isArchived && (
              <IconBtn
                onClick={onEdit}
                disabled={isLoading || editsDisabled}
                label={`Edit "${pub.title}"`}
                title="Edit"
                className="border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <Edit2 className="w-4 h-4" />
              </IconBtn>
            )}

            {/* Pin / Unpin (not for archived) */}
            {!isArchived && (
              <IconBtn
                onClick={onPin}
                disabled={isLoading || editsDisabled}
                label={isPinned ? `Unpin "${pub.title}"` : `Pin "${pub.title}"`}
                title={isPinned ? 'Unpin' : 'Pin'}
                className={isPinned
                  ? 'border-primary/50 text-primary hover:bg-primary/10'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'}
              >
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </IconBtn>
            )}

            {/* Archive or Restore */}
            {isArchived ? (
              <IconBtn
                onClick={onRestore}
                disabled={isLoading || editsDisabled}
                label={`Restore "${pub.title}"`}
                title="Restore to draft"
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                <RotateCcw className="w-4 h-4" />
              </IconBtn>
            ) : (
              <IconBtn
                onClick={onArchive}
                disabled={isPinned || isLoading || editsDisabled}
                label={isPinned ? `Cannot archive pinned "${pub.title}"` : `Archive "${pub.title}"`}
                title={isPinned ? 'Unpin first to archive' : 'Archive'}
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </IconBtn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
