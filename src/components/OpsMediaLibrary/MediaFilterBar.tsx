import { X } from 'lucide-react';
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

export function MediaFilterBar({
  statusFilter,
  surfaceFilter,
  leagueFilter,
  onStatusChange,
  onSurfaceChange,
  onLeagueChange,
  onReset,
  isLoading,
}: MediaFilterBarProps) {
  const hasActiveFilters =
    statusFilter !== 'all' || surfaceFilter !== 'all' || leagueFilter !== 'all';

  return (
    <div className="border border-border rounded-sm p-4 bg-secondary/20 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            className="text-xs text-primary hover:underline disabled:opacity-50"
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
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 ${
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
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 ${
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
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 ${
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
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 ${
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
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 flex items-center gap-2 ${
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
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 flex items-center gap-2 ${
                leagueFilter === league.id
                  ? `bg-primary text-primary-foreground border border-primary`
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
