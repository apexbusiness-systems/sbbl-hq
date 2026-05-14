import { Search, X } from 'lucide-react';

export type MediaSearchBarProps = {
  query: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isSearching?: boolean;
};

export function MediaSearchBar({ query, onChange, onClear, isSearching }: MediaSearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search media..."
        className="w-full pl-10 pr-10 py-3 min-h-[44px] text-sm bg-secondary border border-border rounded-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        aria-label="Search media publications"
      />
      {query && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
