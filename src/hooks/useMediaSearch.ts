import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOpsMediaList, type OpsMediaListFilters } from '@/lib/api/ops';

/**
 * Debounced search hook for media publications.
 * Returns null when query is empty (use main list instead).
 * Non-empty queries are debounced at 300ms before fetching.
 */
export function useMediaSearch(enabled: boolean) {
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const isSearching = debouncedQuery.trim().length > 0;

  const searchQuery = useQuery({
    queryKey: ['ops-media-search', debouncedQuery],
    queryFn: () =>
      fetchOpsMediaList({ q: debouncedQuery } as OpsMediaListFilters),
    enabled: enabled && isSearching,
    staleTime: 15_000,
  });

  return {
    query,
    debouncedQuery,
    isSearching,
    onQueryChange: handleQueryChange,
    clearSearch,
    searchResults: searchQuery.data?.data ?? [],
    isSearchLoading: searchQuery.isLoading,
    isSearchFetching: searchQuery.isFetching,
  };
}
