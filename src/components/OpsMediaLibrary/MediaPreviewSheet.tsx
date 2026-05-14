import { useState } from 'react';
import {
  Image as ImageIcon,
  Edit2,
  Trash2,
  Pin,
  PinOff,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { getLeagueConfig } from '@/lib/leagues';
import type { OpsMediaPublication } from '@/lib/api/ops';
import type { LeagueId } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

export type MediaPreviewSheetProps = {
  publication: OpsMediaPublication | null;
  isOpen: boolean;
  isLoading?: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onTogglePin: () => void;
  onClose: () => void;
};

/** Touch-target-compliant button base styles (44px minimum). */
const btnBase =
  'inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 rounded-sm border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const btnDanger =
  'inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 rounded-sm border border-destructive/30 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const btnAccent =
  'inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 rounded-sm border border-primary/30 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const iconSz = 'w-4 h-4';

const statusColorMap: Record<string, string> = {
  published: 'bg-success/15 text-success',
  draft: 'bg-secondary text-muted-foreground',
  scheduled: 'bg-warning/15 text-warning',
  archived: 'bg-destructive/15 text-destructive',
};

const surfaceColorMap: Record<string, string> = {
  store: 'bg-blue-500/15 text-blue-400',
  potg: 'bg-purple-500/15 text-purple-400',
  event: 'bg-amber-500/15 text-amber-400',
  media_feed: 'bg-green-500/15 text-green-400',
  score: 'bg-indigo-500/15 text-indigo-400',
};

/** Format a date string into a readable short form. */
function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Side-drawer preview sheet for a media publication.
 *
 * Replaces the old PreviewModal with a shadcn Sheet that shows a large
 * preview image, full metadata, parser confidence, and a sticky action bar
 * with Edit / Archive / Pin / Restore buttons (44px touch targets).
 */
export function MediaPreviewSheet({
  publication,
  isOpen,
  isLoading = false,
  onEdit,
  onArchive,
  onRestore,
  onTogglePin,
  onClose,
}: MediaPreviewSheetProps) {
  const [debugOpen, setDebugOpen] = useState(false);

  const pub = publication;

  // Derive display values only when we have a publication
  const leagueConfig = pub?.leagueId
    ? getLeagueConfig(pub.leagueId as LeagueId)
    : null;
  const isPinned = pub?.pinnedAt !== null && pub?.pinnedAt !== undefined;
  const isNeedsReview = pub?.needsReview === true;
  const isArchived = pub?.status === 'archived';
  const showConfidence =
    pub?.confidence != null && pub.confidence < 0.7;
  const confidenceBarColor =
    pub?.confidence != null && pub.confidence < 0.5
      ? 'bg-red-500'
      : 'bg-amber-500';
  const confidenceLabel =
    pub?.confidence != null && pub.confidence < 0.5
      ? 'Low confidence'
      : 'Med confidence';
  const hasUncertainFields =
    pub?.uncertainFields != null &&
    Array.isArray(pub.uncertainFields) &&
    pub.uncertainFields.length > 0;
  const statusColor =
    (pub ? statusColorMap[pub.status] : null) ?? 'bg-secondary text-muted-foreground';
  const surfaceColor =
    (pub ? surfaceColorMap[pub.surface] : null) ?? 'bg-secondary text-muted-foreground';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto flex flex-col p-0"
      >
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle className="text-left">
              {pub ? (
                <>
                  <span className="flex items-center gap-1.5">
                    {isPinned && (
                      <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-label="Pinned" />
                    )}
                    {pub.title || (
                      <span className="text-muted-foreground italic">(untitled)</span>
                    )}
                  </span>
                </>
              ) : (
                'Media Preview'
              )}
            </SheetTitle>
            {pub && (
              <SheetDescription className="text-left">
                {pub.surface} &middot; {pub.status}
              </SheetDescription>
            )}
          </SheetHeader>

          {/* Loading state */}
          {isLoading && (
            <div className="px-6 py-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !pub && (
            <div className="px-6 py-12 text-center text-muted-foreground text-sm">
              No publication selected.
            </div>
          )}

          {/* Content */}
          {!isLoading && pub && (
            <div className="px-6 pb-6 space-y-5">
              {/* 1. Large thumbnail */}
              <div className="w-full bg-secondary rounded-sm overflow-hidden border border-border/50 aspect-video flex items-center justify-center">
                {pub.thumbnail ? (
                  <img
                    src={pub.thumbnail}
                    alt={pub.title}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                ) : (
                  <ImageIcon className="w-12 h-12 text-muted-foreground" />
                )}
              </div>

              {/* 2. Surface + Status chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${surfaceColor}`}
                >
                  {pub.surface}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${statusColor}`}
                >
                  {pub.status}
                </span>
                {/* 7. Pinned indicator */}
                {isPinned && (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary flex items-center gap-1">
                    <Pin className="w-3 h-3" />
                    Pinned
                  </span>
                )}
                {/* 6. Needs review badge */}
                {isNeedsReview && (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Review
                  </span>
                )}
              </div>

              {/* 3. League with logo */}
              {leagueConfig && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    League
                  </p>
                  <div className="flex items-center gap-2">
                    <img
                      src={leagueConfig.logo}
                      alt={leagueConfig.name}
                      className="w-5 h-5 opacity-80"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="font-medium text-sm">{leagueConfig.name}</span>
                    <span className="text-muted-foreground text-xs">
                      ({leagueConfig.shortName})
                    </span>
                  </div>
                </div>
              )}

              {/* Subtitle if present */}
              {pub.subtitle && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Subtitle
                  </p>
                  <p className="text-sm">{pub.subtitle}</p>
                </div>
              )}

              {/* 4. Created / Published dates */}
              <div className="grid grid-cols-2 gap-4">
                {pub.createdAt && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                      Created
                    </p>
                    <p className="font-mono text-xs">
                      {formatDate(pub.createdAt)}
                    </p>
                  </div>
                )}
                {pub.publishedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                      Published
                    </p>
                    <p className="font-mono text-xs">
                      {formatDate(pub.publishedAt)}
                    </p>
                  </div>
                )}
                {pub.scheduledAt && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                      Scheduled
                    </p>
                    <p className="font-mono text-xs">
                      {formatDate(pub.scheduledAt)}
                    </p>
                  </div>
                )}
                {pub.updatedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                      Updated
                    </p>
                    <p className="font-mono text-xs">
                      {formatDate(pub.updatedAt)}
                    </p>
                  </div>
                )}
              </div>

              {/* 5. Parser confidence bar */}
              {showConfidence && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Parser Confidence
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${confidenceBarColor} transition-all`}
                        style={{
                          width: `${Math.round((pub.confidence ?? 0) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {confidenceLabel} ({Math.round((pub.confidence ?? 0) * 100)}%)
                    </span>
                  </div>
                </div>
              )}

              {/* 8. Uncertain fields list */}
              {hasUncertainFields && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Uncertain Fields
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pub.uncertainFields!.map((field: string) => (
                      <span
                        key={field}
                        className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-500"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Type info if present */}
              {pub.type && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Type
                  </p>
                  <p className="text-sm capitalize">{pub.type}</p>
                </div>
              )}

              {/* 9. Collapsible debug section with full IDs */}
              <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    aria-expanded={debugOpen}
                    aria-label="Toggle debug information"
                  >
                    {debugOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Debug IDs
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-1 pb-1">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
                      Publication ID
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground break-all select-all">
                      {pub.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
                      Media Asset ID
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground break-all select-all">
                      {pub.mediaAssetId}
                    </p>
                  </div>
                  {pub.leagueId && (
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
                        League ID
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground break-all select-all">
                        {pub.leagueId}
                      </p>
                    </div>
                  )}
                  {pub.leagueCode && (
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
                        League Code
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground break-all select-all">
                        {pub.leagueCode}
                      </p>
                    </div>
                  )}
                  {pub.sortOrder != null && (
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
                        Sort Order
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground break-all select-all">
                        {pub.sortOrder}
                      </p>
                    </div>
                  )}
                  {pub.pinnedAt && (
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
                        Pinned At
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground break-all select-all">
                        {pub.pinnedAt}
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>

        {/* 10. Sticky footer action bar */}
        {!isLoading && pub && (
          <div className="sticky bottom-0 border-t border-border bg-background px-6 py-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              disabled={isLoading}
              className={btnBase}
              aria-label={`Edit "${pub.title || 'untitled'}"`}
              title="Edit"
            >
              <Edit2 className={iconSz} />
              Edit
            </button>

            {isArchived ? (
              <button
                type="button"
                onClick={onRestore}
                disabled={isLoading}
                className={btnAccent}
                aria-label={`Restore "${pub.title || 'untitled'}"`}
                title="Restore"
              >
                <RotateCcw className={iconSz} />
                Restore
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onArchive}
                  disabled={isLoading}
                  className={btnDanger}
                  aria-label={`Archive "${pub.title || 'untitled'}"`}
                  title="Archive"
                >
                  <Trash2 className={iconSz} />
                  Archive
                </button>
                <button
                  type="button"
                  onClick={onTogglePin}
                  disabled={isLoading}
                  className={btnAccent}
                  aria-label={isPinned ? `Unpin "${pub.title || 'untitled'}"` : `Pin "${pub.title || 'untitled'}"`}
                  title={isPinned ? 'Unpin' : 'Pin'}
                >
                  {isPinned ? <PinOff className={iconSz} /> : <Pin className={iconSz} />}
                  {isPinned ? 'Unpin' : 'Pin'}
                </button>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
