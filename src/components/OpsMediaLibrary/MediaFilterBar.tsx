import { Search, X } from 'lucide-react';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import type { MediaPublicationStatus } from '@/lib/api/ops';

export type SortBy = 'newest' | 'oldest' | 'sort_order';

export type MediaFilterBarProps = {
  statusFilter: MediaPublicationStatus | 'all' | 'needs_review';
  surfaceFilter: string;
  leagueFilter: string;
  sortBy?: SortBy;
  search?: string;
  onStatusChange: (status: MediaPublicationStatus | 'all' | 'needs_review') => void;
  onSurfaceChange: (surface: string) => void;
  onLeagueChange: (league: string) => void;
  onSortChange?: (sort: SortBy) => void;
  onSearchChange?: (search: string) => void;
  onReset: () => void;
  isLoading?: boolean;
};

const SURFACES = [
  { value: 'store', label: 'Store' },
  { value: 'potg', label: 'POTG' },
  { value: 'event', label: 'Event' },
  { value: 'media_feed', label: 'Generic' },
  { value: 'score', label: 'Score' },
] as const;

const STATUSES = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' },
  { value: 'needs_review', label: 'Needs Review' },
] as const;

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'sort_order', label: 'Manual Order' },
];

export function MediaFilterBar({
  statusFilter,
  surfaceFilter,
  leagueFilter,
  sortBy = 'newest',
  search = '',
  onStatusChange,
  onSurfaceChange,
  onLeagueChange,
  onSortChange,
  onSearchChange,
  onReset,
  isLoading,
}: MediaFilterBarProps) {
  const hasActiveFilters =
    statusFilter !== 'all' || surfaceFilter !== 'all' || leagueFilter !== 'all' || search.trim().length > 0;

  return (
    <div className="border border-border rounded-sm p-4 bg-secondary/20 space-y-4">
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={isLoading}
            placeholder="Search by title…"
            className="w-full bg-card border border-border rounded-sm pl-9 pr-3 py-2 text-sm placeholder-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[44px]"
            aria-label="Search media by title"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              disabled={isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50 p-1"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            Sort:
          </label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortBy)}
            disabled={isLoading}
            className="bg-card border border-border rounded-sm px-2 py-2 text-xs disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[44px]"
            aria-label="Sort order"
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            className="text-xs text-primary hover:underline disabled:opacity-50 whitespace-nowrap"
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
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 min-h-[44px] ${
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
              onClick={() => onStatusChange(value as MediaPublicationStatus | 'needs_review')}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 min-h-[44px] ${
                statusFilter === value
                  ? value === 'published'
                    ? 'bg-success text-white'
                    : value === 'draft'
                    ? 'bg-secondary text-foreground border border-border'
                    : value === 'scheduled'
                    ? 'bg-warning text-black'
                    : value === 'needs_review'
                    ? 'bg-warning/80 text-black'
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
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 min-h-[44px] ${
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
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 min-h-[44px] ${
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
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 flex items-center gap-2 min-h-[44px] ${
              leagueFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All Leagues
          </button>
          {LEAGUE_REGISTRY.map((league) => (
            <button
              key={league.id}
              type="button"
              onClick={() => onLeagueChange(league.id)}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 flex items-center gap-2 min-h-[44px] ${
                leagueFilter === league.id
                  ? 'bg-primary text-primary-foreground border border-primary'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
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
