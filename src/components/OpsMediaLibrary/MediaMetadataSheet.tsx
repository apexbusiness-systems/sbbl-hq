import { useEffect, useState } from 'react';
import { Loader2, Pin, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import type { OpsMediaPublication, MediaPublicationStatus } from '@/lib/api/ops';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

/** Status chip visual configuration. */
const STATUS_CHIPS: Array<{
  value: MediaPublicationStatus;
  label: string;
  activeClass: string;
}> = [
  { value: 'draft', label: 'Draft', activeClass: 'bg-secondary text-foreground border-border' },
  { value: 'scheduled', label: 'Scheduled', activeClass: 'bg-blue-600/20 text-blue-400 border-blue-500/30' },
  { value: 'published', label: 'Published', activeClass: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' },
  { value: 'archived', label: 'Archived', activeClass: 'bg-zinc-600/20 text-zinc-400 border-zinc-500/30' },
];

const CHIP_BASE =
  'inline-flex items-center justify-center rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer select-none min-h-[44px]';

export type MediaMetadataSheetProps = {
  publication: OpsMediaPublication | null;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: (title: string, status: MediaPublicationStatus, leagueId: string | null) => void;
  onCancel: () => void;
};

/**
 * Side-drawer replacement for EditMetadataModal.
 *
 * Provides chips/selects/toggles instead of raw UUID fields, a sticky footer,
 * collapsed debug drawer for internal IDs, and 44px touch targets on all
 * interactive elements.
 */
export function MediaMetadataSheet({
  publication,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: MediaMetadataSheetProps) {
  const [title, setTitle] = useState<string>('');
  const [status, setStatus] = useState<MediaPublicationStatus>('draft');
  const [leagueId, setLeagueId] = useState<string>('');
  const [debugOpen, setDebugOpen] = useState<boolean>(false);

  // Sync local state when the publication or open state changes.
  useEffect(() => {
    if (publication && isOpen) {
      setTitle(publication.title || '');
      setStatus(publication.status);
      setLeagueId(publication.leagueId || '');
      setDebugOpen(false);
    }
  }, [publication, isOpen]);

  const hasChanges: boolean = publication
    ? title !== publication.title ||
      status !== publication.status ||
      leagueId !== (publication.leagueId || '')
    : false;

  const isPinned: boolean = publication?.pinnedAt != null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <SheetContent
        side="right"
        className="sm:max-w-md flex flex-col overflow-y-auto p-0"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base font-semibold">Edit Metadata</SheetTitle>
            {isPinned && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-yellow-500/15 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-500 uppercase tracking-wider">
                <Pin className="w-3 h-3" />
                Pinned
              </span>
            )}
            {publication?.needsReview && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[10px] font-semibold text-orange-500 uppercase tracking-wider">
                <AlertTriangle className="w-3 h-3" />
                Needs Review
              </span>
            )}
          </div>
          <SheetDescription className="text-muted-foreground text-xs">
            Update title, status, and league assignment for this publication.
          </SheetDescription>
        </SheetHeader>

        {/* ── Scrollable body ────────────────────────────────────── */}
        {publication && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Thumbnail */}
            {publication.thumbnail && (
              <div className="w-full h-40 bg-secondary rounded-sm overflow-hidden border border-border/50">
                <img
                  src={publication.thumbnail}
                  alt={publication.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Title */}
            <div>
              <label
                htmlFor="media-meta-title"
                className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2"
              >
                Title
              </label>
              <input
                id="media-meta-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
                className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm placeholder-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 min-h-[44px]"
                placeholder="Publication title"
              />
            </div>

            {/* Status chips */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">
                Status
              </span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Publication status">
                {STATUS_CHIPS.map((chip) => {
                  const isActive = status === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      disabled={isLoading}
                      onClick={() => setStatus(chip.value)}
                      className={`${CHIP_BASE} ${
                        isActive
                          ? chip.activeClass
                          : 'bg-transparent text-muted-foreground border-border/50 hover:bg-secondary'
                      } disabled:opacity-50`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* League chips */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">
                League
              </span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="League assignment">
                {/* "None" chip */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={leagueId === ''}
                  disabled={isLoading}
                  onClick={() => setLeagueId('')}
                  className={`${CHIP_BASE} ${
                    leagueId === ''
                      ? 'bg-secondary text-foreground border-border'
                      : 'bg-transparent text-muted-foreground border-border/50 hover:bg-secondary'
                  } disabled:opacity-50`}
                >
                  None
                </button>

                {/* League chips with logos */}
                {LEAGUE_REGISTRY.map((league) => {
                  const isSelected = leagueId === league.id;
                  return (
                    <button
                      key={league.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isLoading}
                      onClick={() => setLeagueId(league.id)}
                      className={`${CHIP_BASE} gap-1.5 ${
                        isSelected
                          ? 'bg-secondary text-foreground border-border'
                          : 'bg-transparent text-muted-foreground border-border/50 hover:bg-secondary'
                      } disabled:opacity-50`}
                    >
                      <img
                        src={league.logo}
                        alt={league.logoAlt}
                        className="w-4 h-4 object-contain"
                        loading="lazy"
                      />
                      <span>{league.shortName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pin status info */}
            <div className="rounded-sm border border-border/50 bg-secondary/50 px-4 py-3 flex items-center gap-3">
              <Pin className={`w-4 h-4 shrink-0 ${isPinned ? 'text-yellow-500' : 'text-muted-foreground'}`} />
              <div className="text-xs text-muted-foreground">
                {isPinned ? (
                  <>
                    <span className="text-foreground font-medium">Pinned</span>
                    {' — '}
                    {new Date(publication.pinnedAt!).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </>
                ) : (
                  'Not pinned — use the pin toggle in the media list to pin this publication.'
                )}
              </div>
            </div>

            {/* Needs review badge (informational only) */}
            {publication.needsReview && (
              <div className="rounded-sm border border-orange-500/30 bg-orange-500/10 px-4 py-3 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-orange-500" />
                <div className="text-xs">
                  <span className="text-foreground font-medium">Flagged for review</span>
                  {publication.uncertainFields && publication.uncertainFields.length > 0 && (
                    <span className="text-muted-foreground">
                      {' — uncertain fields: '}
                      {publication.uncertainFields.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Debug drawer (collapsed by default) ──────────────── */}
            <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                  aria-label={debugOpen ? 'Hide debug IDs' : 'Show debug IDs'}
                >
                  {debugOpen ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  Debug IDs
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5 text-[11px] font-mono text-muted-foreground bg-secondary/50 rounded-sm border border-border/50 p-3">
                  <div className="flex gap-2">
                    <span className="shrink-0 w-24 text-muted-foreground/70">Publication</span>
                    <span className="break-all select-all">{publication.id}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-24 text-muted-foreground/70">Media Asset</span>
                    <span className="break-all select-all">{publication.mediaAssetId}</span>
                  </div>
                  {publication.leagueCode && (
                    <div className="flex gap-2">
                      <span className="shrink-0 w-24 text-muted-foreground/70">League Code</span>
                      <span>{publication.leagueCode}</span>
                    </div>
                  )}
                  {publication.surface && (
                    <div className="flex gap-2">
                      <span className="shrink-0 w-24 text-muted-foreground/70">Surface</span>
                      <span>{publication.surface}</span>
                    </div>
                  )}
                  {publication.confidence != null && (
                    <div className="flex gap-2">
                      <span className="shrink-0 w-24 text-muted-foreground/70">Confidence</span>
                      <span>{(publication.confidence * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* ── Sticky footer ───────────────────────────────────────── */}
        <SheetFooter className="sticky bottom-0 border-t border-border bg-background px-6 py-4 shrink-0 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 text-sm font-semibold border border-border rounded-sm hover:bg-secondary disabled:opacity-50 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(title, status, leagueId || null)}
            disabled={isLoading || !hasChanges}
            className="flex-1 px-4 text-sm font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
