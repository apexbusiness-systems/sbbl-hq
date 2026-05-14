import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchOpsMediaList,
  patchOpsMediaPublication,
  deleteOpsMediaPublication,
  updateOpsMediaPublicationOrder,
  type MediaPublicationStatus,
  type OpsMediaPublication,
} from '@/lib/api/ops';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@/lib/api/idempotency';
import { useMediaSearch } from './useMediaSearch';
import { useMediaBulkSelection } from './useMediaBulkSelection';
import { useMediaDragOrder } from './useMediaDragOrder';
import { useMediaStaleCleanup } from './useMediaStaleCleanup';
import { useMediaPin } from './useMediaPin';
import { useMediaUploadFlow } from './useMediaUploadFlow';

/**
 * Composed hook for the Ops Console media library tab.
 * Orchestrates all sub-hooks for search, bulk selection, drag order,
 * stale cleanup, pinning, upload flow, and core CRUD.
 */
export function useOpsMediaLibrary(enabled: boolean) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<MediaPublicationStatus | 'all'>('all');
  const [surfaceFilter, setSurfaceFilter] = useState<string>('all');
  const [leagueFilter, setLeagueFilter] = useState<string>('all');
  const [orderBy, setOrderBy] = useState<'newest' | 'sort_order'>('newest');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [staleCleanupOpen, setStaleCleanupOpen] = useState(false);
  const [uploadModeActive, setUploadModeActive] = useState(false);

  // Sub-hooks
  const search = useMediaSearch(enabled);
  const bulk = useMediaBulkSelection();
  const stale = useMediaStaleCleanup();
  const pin = useMediaPin();
  const upload = useMediaUploadFlow();

  // Core media list query (used when NOT searching)
  const mediaListQuery = useQuery({
    queryKey: ['ops-media-list', statusFilter, surfaceFilter, leagueFilter, orderBy],
    queryFn: () =>
      fetchOpsMediaList({
        status: statusFilter === 'all' ? undefined : statusFilter,
        surface: surfaceFilter === 'all' ? undefined : surfaceFilter,
        leagueId: leagueFilter === 'all' ? undefined : leagueFilter,
        orderBy,
      }),
    enabled: enabled && !search.isSearching,
    retry: (_, error) => {
      const message = error instanceof Error ? error.message : '';
      return !(message === 'unauthorized' || message === 'reauth_required');
    },
    staleTime: 15_000,
  });

  const mediaPublications = useMemo<OpsMediaPublication[]>(
    () => search.isSearching ? search.searchResults : (mediaListQuery.data?.data ?? []),
    [search.isSearching, search.searchResults, mediaListQuery.data?.data],
  );

  const publicationIds = useMemo(() => mediaPublications.map((p) => p.id), [mediaPublications]);
  const drag = useMediaDragOrder(publicationIds);

  const orderedMediaPublications = useMemo<OpsMediaPublication[]>(() => {
    const orderIds = drag.localOrderIds;
    if (orderIds.length === 0) return mediaPublications;
    const byId = new Map(mediaPublications.map((pub) => [pub.id, pub]));
    const ordered: OpsMediaPublication[] = [];
    orderIds.forEach((id) => {
      const row = byId.get(id);
      if (row) ordered.push(row);
      byId.delete(id);
    });
    return [...ordered, ...byId.values()];
  }, [drag.localOrderIds, mediaPublications]);

  const patchMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      status,
      leagueId,
    }: {
      id: string;
      title: string;
      status: MediaPublicationStatus;
      leagueId: string | null;
    }) =>
      patchOpsMediaPublication(id, {
        title: title.trim() !== '' ? title.trim() : undefined,
        status,
        leagueId,
      }),
    onSuccess: async () => {
      setEditId(null);
      await queryClient.invalidateQueries({ queryKey: ['ops-media-list'] });
      await queryClient.invalidateQueries({ queryKey: ['ops-media-search'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media-posters'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteOpsMediaPublication(id),
    onSuccess: async () => {
      setArchiveId(null);
      await queryClient.invalidateQueries({ queryKey: ['ops-media-list'] });
      await queryClient.invalidateQueries({ queryKey: ['ops-media-search'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media-posters'] });
    },
  });

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setSurfaceFilter('all');
    setLeagueFilter('all');
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

  return {
    // Filter state
    statusFilter,
    surfaceFilter,
    leagueFilter,
    orderBy,
    previewId,
    editId,
    archiveId,
    staleCleanupOpen,
    uploadModeActive,

    // Setters
    setStatusFilter,
    setSurfaceFilter,
    setLeagueFilter,
    setOrderBy,
    setPreviewId,
    setEditId,
    setArchiveId,
    setStaleCleanupOpen,
    setUploadModeActive,
    resetFilters,

    // Data
    mediaPublications,
    orderedMediaPublications,
    hasPendingOrderChanges: drag.hasPendingChanges,

    // Search sub-hook
    searchQuery: search.query,
    isSearching: search.isSearching,
    onSearchChange: search.onQueryChange,
    clearSearch: search.clearSearch,
    isSearchFetching: search.isSearchFetching,

    // Bulk sub-hook
    isBulkMode: bulk.isBulkMode,
    selectedIds: bulk.selectedIds,
    selectedCount: bulk.selectedCount,
    bulkError: bulk.bulkError,
    invalidIds: bulk.invalidIds,
    isBulkArchivePending: bulk.isBulkArchivePending,
    toggleBulkMode: bulk.toggleBulkMode,
    toggleSelection: bulk.toggleSelection,
    selectAll: bulk.selectAll,
    deselectAll: bulk.deselectAll,
    bulkArchive: bulk.bulkArchive,

    // Drag sub-hook
    dragSensors: drag.sensors,
    handleDragEnd: drag.handleDragEnd,
    dragMoveUp: drag.moveUp,
    dragMoveDown: drag.moveDown,
    isOrderSaving: drag.isSaving,
    orderError: drag.orderError,
    resetOrder: drag.resetOrder,

    // Stale cleanup sub-hook
    staleOlderThanDays: stale.olderThanDays,
    setStaleOlderThanDays: stale.setOlderThanDays,
    stalePreviewResult: stale.previewResult,
    staleExecuteResult: stale.executeResult,
    isStalePreviewLoading: stale.isPreviewLoading,
    isStaleExecuteLoading: stale.isExecuteLoading,
    stalePreviewError: stale.previewError,
    staleExecuteError: stale.executeError,
    fetchStalePreview: stale.fetchPreview,
    executeStaleCleanup: stale.executeCleanup,
    resetStaleCleanup: stale.reset,

    // Pin sub-hook
    isPinning: pin.isPinning,
    pinError: pin.pinError,
    togglePin: pin.togglePin,

    // Upload sub-hook
    uploadFlow: upload.flowState,
    isUploading: upload.isUploading,
    uploadError: upload.uploadError,
    setUploadLeague: upload.setLeague,
    setUploadSurface: upload.setSurface,
    setUploadPublishStatus: upload.setPublishStatus,
    uploadPresign: upload.presignMutation,
    uploadSubmit: upload.submitMutation,
    overrideParserField: upload.overrideParserField,
    resetUpload: upload.reset,
    uploadGoBack: upload.goBack,

    // Core query/mutation states
    isLoading: mediaListQuery.isLoading,
    isError: mediaListQuery.isError,
    isSuccess: mediaListQuery.isSuccess,
    isFetching: mediaListQuery.isFetching || search.isSearchFetching,
    error: mediaListQuery.error,
    isPatchingPending: patchMutation.isPending,
    isDeletingPending: deleteMutation.isPending,
    patchError: patchMutation.error,
    deleteError: deleteMutation.error,

    // Core actions
    saveMetadata,
    archiveMedia,
    saveOrder: drag.saveOrder,
    moveMedia: drag.moveUp, // legacy compat — use dragMoveUp/dragMoveDown
  };
}
