import { X, Trash2, CheckSquare, ArrowUpDown } from 'lucide-react';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import type { MediaPublicationStatus } from '@/lib/api/ops';

export type MediaFilterBarProps = {
  statusFilter: MediaPublicationStatus | 'all';
  surfaceFilter: string;
  leagueFilter: string;
  onStatusChange: (status: MediaPublicationStatus | 'all') => void;
  onSurfaceChange: (surface: string) => void;
  onLeagueChange: (league: string) => void;
  onReset: () => void;
  isLoading?: boolean;
  isBulkMode?: boolean;
  onToggleBulkMode?: () => void;
  onOpenStaleCleanup?: () => void;
  orderBy?: 'newest' | 'sort_order';
  onOrderByChange?: (orderBy: 'newest' | 'sort_order') => void;
};

const SURFACES = [
  { value: 'store', label: 'Store' },
  { value: 'potg', label: 'POTG' },
  { value: 'event', label: 'Event' },
  { value: 'media_feed', label: 'Media Feed' },
  { value: 'score', label: 'Score' },
] as const;

const STATUSES = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' },
] as const;

/** Shared chip class with 44px touch targets */
const chipBase =
  'min-h-[44px] px-4 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 inline-flex items-center justify-center';

export function MediaFilterBar({
  statusFilter,
  surfaceFilter,
  leagueFilter,
  onStatusChange,
  onSurfaceChange,
  onLeagueChange,
  onReset,
  isLoading,
  isBulkMode,
  onToggleBulkMode,
  onOpenStaleCleanup,
  orderBy,
  onOrderByChange,
}: MediaFilterBarProps) {
  const hasActiveFilters =
    statusFilter !== 'all' || surfaceFilter !== 'all' || leagueFilter !== 'all';

  return (
    <div className="border border-border rounded-sm p-4 bg-secondary/20 space-y-4">
      {/* Toolbar row: Bulk Select + Sort + Stale Cleanup */}
      <div className="flex items-center gap-2 flex-wrap">
        {onToggleBulkMode && (
          <button
            type="button"
            onClick={onToggleBulkMode}
            disabled={isLoading}
            className={`${chipBase} ${
              isBulkMode
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            } gap-2`}
          >
            <CheckSquare className="w-4 h-4" />
            {isBulkMode ? 'Exit Bulk' : 'Bulk Select'}
          </button>
        )}
        {onOrderByChange && (
          <button
            type="button"
            onClick={() => onOrderByChange(orderBy === 'newest' ? 'sort_order' : 'newest')}
            disabled={isLoading}
            className={`${chipBase} bg-card border border-border text-muted-foreground hover:text-foreground gap-2`}
          >
            <ArrowUpDown className="w-4 h-4" />
            {orderBy === 'newest' ? 'Newest First' : 'Custom Order'}
          </button>
        )}
        {onOpenStaleCleanup && (
          <button
            type="button"
            onClick={onOpenStaleCleanup}
            disabled={isLoading}
            className={`${chipBase} bg-card border border-border text-muted-foreground hover:text-foreground gap-2`}
          >
            <Trash2 className="w-4 h-4" />
            Stale Cleanup
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            className="text-xs text-primary hover:underline disabled:opacity-50 min-h-[44px] inline-flex items-center"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Status chips */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onStatusChange('all')}
            disabled={isLoading}
            className={`${chipBase} ${
              statusFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {STATUSES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onStatusChange(value as MediaPublicationStatus)}
              disabled={isLoading}
              className={`${chipBase} ${
                statusFilter === value
                  ? value === 'published'
                    ? 'bg-success text-white'
                    : value === 'draft'
                    ? 'bg-secondary text-foreground'
                    : value === 'scheduled'
                    ? 'bg-warning text-black'
                    : 'bg-destructive text-white'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Surface chips */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
          Surface
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSurfaceChange('all')}
            disabled={isLoading}
            className={`${chipBase} ${
              surfaceFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {SURFACES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onSurfaceChange(value)}
              disabled={isLoading}
              className={`${chipBase} ${
                surfaceFilter === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* League chips */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
          League
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onLeagueChange('all')}
            disabled={isLoading}
            className={`${chipBase} ${
              leagueFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            } gap-2`}
          >
            All Leagues
          </button>
          {LEAGUE_REGISTRY.map((league) => (
            <button
              key={league.id}
              type="button"
              onClick={() => onLeagueChange(league.id)}
              disabled={isLoading}
              className={`${chipBase} ${
                leagueFilter === league.id
                  ? 'bg-primary text-primary-foreground border border-primary'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              } gap-2`}
            >
              <img
                src={league.logo}
                alt={league.shortName}
                className="w-3.5 h-3.5 opacity-80"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              {league.shortName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
