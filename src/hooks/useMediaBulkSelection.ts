import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkArchiveMedia, type BulkArchiveErrorResponse } from '@/lib/api/ops';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@/lib/api/idempotency';

/**
 * Manages bulk selection mode and bulk archive operations.
 * NO "Pin All" in v1 — removed per owner amendment to avoid scope creep.
 */
export function useMediaBulkSelection() {
  const queryClient = useQueryClient();
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [invalidIds, setInvalidIds] = useState<string[]>([]);

  const toggleBulkMode = useCallback(() => {
    setIsBulkMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
        setBulkError(null);
        setInvalidIds([]);
      }
      return !prev;
    });
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setBulkError(null);
    setInvalidIds([]);
  }, []);

  const bulkArchiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return { ok: true as const, archived: 0, ids: [] };
      if (ids.length > 100) throw new Error('Maximum 100 items per bulk operation');
      return bulkArchiveMedia(ids);
    },
    onSuccess: async (result) => {
      if (result.ok) {
        setSelectedIds(new Set());
        setBulkError(null);
        setInvalidIds([]);
        await queryClient.invalidateQueries({ queryKey: ['ops-media-list'] });
        await queryClient.invalidateQueries({ queryKey: ['ops-media-search'] });
        await queryClient.invalidateQueries({ queryKey: ['public-media'] });
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Bulk archive failed';
      setBulkError(msg);
      // Try to extract invalidIds from the error response
      try {
        const parsed = JSON.parse(msg) as BulkArchiveErrorResponse;
        if (parsed.invalidIds) setInvalidIds(parsed.invalidIds);
      } catch {
        // Not a JSON error response
      }
    },
  });

  const bulkArchive = useCallback(() => {
    const ids = Array.from(selectedIds);
    bulkArchiveMutation.mutate(ids);
  }, [selectedIds, bulkArchiveMutation]);

  return {
    isBulkMode,
    selectedIds,
    selectedCount: selectedIds.size,
    bulkError,
    invalidIds,
    isBulkArchivePending: bulkArchiveMutation.isPending,
    toggleBulkMode,
    toggleSelection,
    selectAll,
    deselectAll,
    bulkArchive,
  };
}
