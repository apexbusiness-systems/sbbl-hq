import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
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
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'sort_order', label: 'Manual' },
];

function Chip({
  active, onClick, disabled, children, activeClass,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 min-h-[36px] sm:min-h-[40px] ${
        active
          ? (activeClass ?? 'bg-primary text-primary-foreground')
          : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {children}
    </button>
  );
}

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
  const [expanded, setExpanded] = useState(true);

  const activeFilterCount = [
    statusFilter !== 'all',
    surfaceFilter !== 'all',
    leagueFilter !== 'all',
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0 || search.trim().length > 0;

  return (
    <div className="border border-border rounded-sm p-4 bg-secondary/20 space-y-4">

      {/* Top row: search + sort + toggle */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            disabled={isLoading}
            placeholder="Search by title…"
            className="w-full bg-card border border-border rounded-sm pl-8 pr-8 py-2 text-sm placeholder-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[40px]"
            aria-label="Search media by title"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              disabled={isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort — compact select */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange?.(e.target.value as SortBy)}
          disabled={isLoading}
          className="bg-card border border-border rounded-sm px-2 py-2 text-xs disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[40px] max-w-[100px]"
          aria-label="Sort order"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Mobile filter toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          disabled={isLoading}
          className={`sm:hidden flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-sm border transition-colors min-h-[40px] disabled:opacity-50 ${
            expanded || activeFilterCount > 0
              ? 'bg-primary/10 border-primary/50 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
          aria-label={expanded ? 'Hide filters' : 'Show filters'}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {activeFilterCount > 0 && (
            <span className="min-w-[16px] text-center">{activeFilterCount}</span>
          )}
        </button>

        {/* Reset — only when filters are active */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            className="hidden sm:flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50 whitespace-nowrap"
          >
            <X className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Mobile reset (inside expanded section) */}
      {hasActiveFilters && expanded && (
        <div className="flex sm:hidden justify-end">
          <button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            Reset All
          </button>
        </div>
      )}

      {/* Filter chips — always visible on sm+, toggleable on mobile */}
      <div className={`${expanded ? 'block' : 'hidden'} sm:block space-y-3`}>

        {/* Status */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Status</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={statusFilter === 'all'} onClick={() => onStatusChange('all')} disabled={isLoading}>
              All
            </Chip>
            {STATUSES.map(({ value, label }) => {
              const activeClass =
                value === 'published' ? 'bg-success text-white' :
                value === 'draft' ? 'bg-secondary text-foreground border border-border' :
                value === 'scheduled' ? 'bg-warning text-black' :
                value === 'needs_review' ? 'bg-warning/80 text-black' :
                'bg-destructive text-white';
              return (
                <Chip
                  key={value}
                  active={statusFilter === value}
                  onClick={() => onStatusChange(value as MediaPublicationStatus | 'needs_review')}
                  disabled={isLoading}
                  activeClass={activeClass}
                >
                  {label}
                </Chip>
              );
            })}
          </div>
        </div>

        {/* Surface */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Surface</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={surfaceFilter === 'all'} onClick={() => onSurfaceChange('all')} disabled={isLoading}>
              All
            </Chip>
            {SURFACES.map(({ value, label }) => (
              <Chip
                key={value}
                active={surfaceFilter === value}
                onClick={() => onSurfaceChange(value)}
                disabled={isLoading}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {/* League */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">League</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={leagueFilter === 'all'} onClick={() => onLeagueChange('all')} disabled={isLoading}>
              All Leagues
            </Chip>
            {LEAGUE_REGISTRY.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => onLeagueChange(league.id)}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 min-h-[36px] sm:min-h-[40px] ${
                  leagueFilter === league.id
                    ? 'bg-primary text-primary-foreground border border-primary'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <img
                  src={league.logo}
                  alt={league.shortName}
                  className="w-3.5 h-3.5 opacity-80"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                {league.shortName}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
