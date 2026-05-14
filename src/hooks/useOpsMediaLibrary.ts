import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchOpsMediaList,
  patchOpsMediaPublication,
  deleteOpsMediaPublication,
  updateOpsMediaPublicationOrder,
  bulkArchiveOpsMedia,
  pinOpsMediaPublication,
  unpinOpsMediaPublication,
  restoreOpsMediaPublication,
  fetchOpsStaleMedia,
  archiveOpsStaleMedia,
  type MediaPublicationStatus,
  type OpsMediaPublication,
} from '@/lib/api/ops';
import { createIdempotencyKey } from '@/lib/api/idempotency';
import type { SortBy } from '@/components/OpsMediaLibrary/MediaFilterBar';

const STALE_DAYS = 30;

// 'needs_review' is a virtual filter; maps to needsReview=true param + no status filter
type StatusFilterValue = MediaPublicationStatus | 'all' | 'needs_review';

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return message === 'unauthorized' || message === 'reauth_required';
}

function retryPolicy(_: number, error: unknown) {
  return !isAuthError(error);
}

function invalidateMedia(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['ops-media-list'] }),
    qc.invalidateQueries({ queryKey: ['public-media'] }),
    qc.invalidateQueries({ queryKey: ['public-media-posters'] }),
  ]);
}

export function useOpsMediaLibrary(enabled: boolean) {
  const queryClient = useQueryClient();

  // ── Filter / sort state ────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [surfaceFilter, setSurfaceFilter] = useState<string>('all');
  const [leagueFilter, setLeagueFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [search, setSearch] = useState<string>('');

  // ── Reorder / drag state ───────────────────────────────────────────────
  const [mediaOrderIds, setMediaOrderIds] = useState<string[]>([]);

  // ── Modal state ────────────────────────────────────────────────────────
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [staleCleanupOpen, setStaleCleanupOpen] = useState(false);
  const [staleSelectedIds, setStaleSelectedIds] = useState<Set<string>>(new Set());

  // ── Bulk select state ──────────────────────────────────────────────────
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());

  // ── Media list query ───────────────────────────────────────────────────
  const mediaListQuery = useQuery({
    queryKey: ['ops-media-list', statusFilter, surfaceFilter, leagueFilter, sortBy, search],
    queryFn: () =>
      fetchOpsMediaList({
        status: statusFilter === 'all' || statusFilter === 'needs_review'
          ? undefined
          : statusFilter,
        surface: surfaceFilter === 'all' ? undefined : surfaceFilter,
        leagueId: leagueFilter === 'all' ? undefined : leagueFilter,
        needsReview: statusFilter === 'needs_review' ? true : undefined,
        search: search.trim() || undefined,
        sortBy,
      }),
    enabled,
    retry: retryPolicy,
    staleTime: 15_000,
  });

  const mediaPublications = useMemo<OpsMediaPublication[]>(
    () => mediaListQuery.data?.data ?? [],
    [mediaListQuery.data?.data],
  );

  // Ordered view (drag reorder overlay)
  const orderedMediaPublications = useMemo<OpsMediaPublication[]>(() => {
    if (mediaOrderIds.length === 0) return mediaPublications;
    const byId = new Map(mediaPublications.map((pub) => [pub.id, pub]));
    const ordered: OpsMediaPublication[] = [];
    mediaOrderIds.forEach((id) => {
      const row = byId.get(id);
      if (row) ordered.push(row);
      byId.delete(id);
    });
    return [...ordered, ...byId.values()];
  }, [mediaOrderIds, mediaPublications]);

  const hasPendingOrderChanges = useMemo(() => {
    if (mediaOrderIds.length !== mediaPublications.length) return false;
    return mediaOrderIds.some((id, index) => id !== mediaPublications[index]?.id);
  }, [mediaOrderIds, mediaPublications]);

  // ── Stale items query (lazy — only when stale modal opens) ─────────────
  const staleQuery = useQuery({
    queryKey: ['ops-media-stale', STALE_DAYS],
    queryFn: () => fetchOpsStaleMedia(STALE_DAYS),
    enabled: enabled && staleCleanupOpen,
    retry: retryPolicy,
    staleTime: 60_000,
  });
  const staleItems = useMemo(() => staleQuery.data?.data ?? [], [staleQuery.data?.data]);

  // ── Mutations ──────────────────────────────────────────────────────────

  const patchMutation = useMutation({
    mutationFn: async ({
      id, title, status, leagueId,
    }: {
      id: string; title: string; status: MediaPublicationStatus; leagueId: string | null;
    }) =>
      patchOpsMediaPublication(id, {
        title: title.trim() !== '' ? title.trim() : undefined,
        status,
        leagueId,
      }),
    onSuccess: async () => {
      setEditId(null);
      await invalidateMedia(queryClient);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteOpsMediaPublication(id),
    onSuccess: async () => {
      setArchiveId(null);
      await invalidateMedia(queryClient);
    },
  });

  const orderMutation = useMutation({
    mutationFn: async (items: Array<{ id: string; sortOrder: number }>) =>
      updateOpsMediaPublicationOrder(items),
    onSuccess: async () => {
      await invalidateMedia(queryClient);
    },
  });

  // Bulk archive — optimistic + rollback
  const bulkArchiveMutation = useMutation({
    mutationFn: async (ids: string[]) => bulkArchiveOpsMedia(ids),
    onSuccess: async () => {
      setBulkSelectedIds(new Set());
      setIsBulkMode(false);
      await invalidateMedia(queryClient);
    },
  });

  // Pin / unpin
  const pinMutation = useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: boolean }) =>
      pin ? pinOpsMediaPublication(id) : unpinOpsMediaPublication(id),
    onMutate: async ({ id, pin }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['ops-media-list'] });
      const prev = queryClient.getQueryData<{ ok: boolean; data: OpsMediaPublication[] }>([
        'ops-media-list', statusFilter, surfaceFilter, leagueFilter, sortBy, search,
      ]);
      if (prev) {
        queryClient.setQueryData(
          ['ops-media-list', statusFilter, surfaceFilter, leagueFilter, sortBy, search],
          {
            ...prev,
            data: prev.data.map((p) =>
              p.id === id ? { ...p, pinnedAt: pin ? new Date().toISOString() : null } : p
            ),
          },
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(
          ['ops-media-list', statusFilter, surfaceFilter, leagueFilter, sortBy, search],
          ctx.prev,
        );
      }
    },
    onSuccess: async () => {
      await invalidateMedia(queryClient);
    },
  });

  // Restore
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => restoreOpsMediaPublication(id),
    onSuccess: async () => {
      setRestoreId(null);
      await invalidateMedia(queryClient);
    },
  });

  // Stale archive
  const staleArchiveMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      archiveOpsStaleMedia(ids, createIdempotencyKey(`ops-stale-archive-${ids.sort().join('-').slice(0, 64)}`)),
    onSuccess: async () => {
      setStaleSelectedIds(new Set());
      setStaleCleanupOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['ops-media-stale'] });
      await invalidateMedia(queryClient);
    },
  });

  // ── Actions ────────────────────────────────────────────────────────────

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setSurfaceFilter('all');
    setLeagueFilter('all');
    setSearch('');
  }, []);

  const saveMetadata = useCallback(
    (id: string, title: string, status: MediaPublicationStatus, leagueId: string | null) => {
      patchMutation.mutate({ id, title, status, leagueId });
    },
    [patchMutation],
  );

  const archiveMedia = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const restoreMedia = useCallback(
    (id: string) => {
      restoreMutation.mutate(id);
    },
    [restoreMutation],
  );

  const saveOrder = useCallback(() => {
    if (!hasPendingOrderChanges) return;
    orderMutation.mutate(mediaOrderIds.map((id, index) => ({ id, sortOrder: index })));
  }, [hasPendingOrderChanges, mediaOrderIds, orderMutation]);

  const moveMedia = useCallback((id: string, direction: 'up' | 'down') => {
    setMediaOrderIds((prev) => {
      const index = prev.indexOf(id);
      if (index < 0) return prev;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }, []);

  const reorderMedia = useCallback((activeId: string, overId: string) => {
    setMediaOrderIds((prev) => {
      const activeIndex = prev.indexOf(activeId);
      const overIndex = prev.indexOf(overId);
      if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return prev;
      const next = [...prev];
      next.splice(activeIndex, 1);
      next.splice(overIndex, 0, activeId);
      return next;
    });
  }, []);

  const togglePin = useCallback(
    (id: string) => {
      const pub = mediaPublications.find((p) => p.id === id);
      if (!pub) return;
      pinMutation.mutate({ id, pin: pub.pinnedAt == null });
    },
    [mediaPublications, pinMutation],
  );

  // Bulk select helpers
  const toggleBulkSelect = useCallback((id: string) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setBulkSelectedIds(new Set(orderedMediaPublications.map((p) => p.id)));
  }, [orderedMediaPublications]);

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
  }, []);

  const exitBulkMode = useCallback(() => {
    setIsBulkMode(false);
    setBulkSelectedIds(new Set());
  }, []);

  const executeBulkArchive = useCallback(() => {
    if (bulkSelectedIds.size === 0) return;
    bulkArchiveMutation.mutate([...bulkSelectedIds]);
  }, [bulkSelectedIds, bulkArchiveMutation]);

  // Stale cleanup helpers
  const openStaleCleanup = useCallback(() => {
    setStaleSelectedIds(new Set());
    setStaleCleanupOpen(true);
  }, []);

  const closeStaleCleanup = useCallback(() => {
    setStaleCleanupOpen(false);
    setStaleSelectedIds(new Set());
  }, []);

  const toggleStaleSelect = useCallback((id: string) => {
    setStaleSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllStale = useCallback(() => {
    setStaleSelectedIds(new Set(staleItems.map((i) => i.id)));
  }, [staleItems]);

  const deselectAllStale = useCallback(() => {
    setStaleSelectedIds(new Set());
  }, []);

  const executeStaleArchive = useCallback(() => {
    if (staleSelectedIds.size === 0) return;
    staleArchiveMutation.mutate([...staleSelectedIds]);
  }, [staleSelectedIds, staleArchiveMutation]);

  return {
    // Filter / sort state
    statusFilter,
    surfaceFilter,
    leagueFilter,
    sortBy,
    search,
    mediaOrderIds,

    // Modal state
    previewId,
    editId,
    archiveId,
    restoreId,
    staleCleanupOpen,
    staleSelectedIds,

    // Bulk state
    isBulkMode,
    bulkSelectedIds,

    // Setters
    setStatusFilter,
    setSurfaceFilter,
    setLeagueFilter,
    setSortBy,
    setSearch,
    setMediaOrderIds,
    setPreviewId,
    setEditId,
    setArchiveId,
    setRestoreId,
    resetFilters,

    // Data
    mediaPublications,
    orderedMediaPublications,
    hasPendingOrderChanges,
    staleItems,

    // Query states
    isLoading: mediaListQuery.isLoading,
    isError: mediaListQuery.isError,
    isSuccess: mediaListQuery.isSuccess,
    isFetching: mediaListQuery.isFetching,
    isStaleLoading: staleQuery.isLoading,
    isStaleError: staleQuery.isError,

    // Mutation states
    isPatchingPending: patchMutation.isPending,
    isDeletingPending: deleteMutation.isPending,
    isOrderingPending: orderMutation.isPending,
    isBulkArchivingPending: bulkArchiveMutation.isPending,
    isPinningPending: pinMutation.isPending,
    isRestoringPending: restoreMutation.isPending,
    isStaleArchivingPending: staleArchiveMutation.isPending,

    // Errors
    error: mediaListQuery.error,
    patchError: patchMutation.error,
    deleteError: deleteMutation.error,
    orderError: orderMutation.error,
    bulkArchiveError: bulkArchiveMutation.error,
    pinError: pinMutation.error,
    restoreError: restoreMutation.error,
    staleArchiveError: staleArchiveMutation.error,

    // Actions
    saveMetadata,
    archiveMedia,
    restoreMedia,
    saveOrder,
    moveMedia,
    reorderMedia,
    togglePin,
    toggleBulkSelect,
    selectAll,
    clearBulkSelection,
    setIsBulkMode,
    exitBulkMode,
    executeBulkArchive,
    openStaleCleanup,
    closeStaleCleanup,
    toggleStaleSelect,
    selectAllStale,
    deselectAllStale,
    executeStaleArchive,
  };
}
