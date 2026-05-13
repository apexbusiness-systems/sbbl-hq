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

export function useOpsMediaLibrary(enabled: boolean) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<MediaPublicationStatus | 'all'>('all');
  const [surfaceFilter, setSurfaceFilter] = useState<string>('all');
  const [leagueFilter, setLeagueFilter] = useState<string>('all');
  const [mediaOrderIds, setMediaOrderIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);

  const mediaListQuery = useQuery({
    queryKey: ['ops-media-list', statusFilter, surfaceFilter, leagueFilter],
    queryFn: () =>
      fetchOpsMediaList({
        status: statusFilter === 'all' ? undefined : statusFilter,
        surface: surfaceFilter === 'all' ? undefined : surfaceFilter,
        leagueId: leagueFilter === 'all' ? undefined : leagueFilter,
      }),
    enabled,
    retry: (_, error) => {
      const message = error instanceof Error ? error.message : '';
      return !(message === 'unauthorized' || message === 'reauth_required');
    },
    staleTime: 15_000,
  });

  const mediaPublications = useMemo<OpsMediaPublication[]>(
    () => mediaListQuery.data?.data ?? [],
    [mediaListQuery.data?.data],
  );

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
      await queryClient.invalidateQueries({ queryKey: ['public-media'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media-posters'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteOpsMediaPublication(id),
    onSuccess: async () => {
      setArchiveId(null);
      await queryClient.invalidateQueries({ queryKey: ['ops-media-list'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media-posters'] });
    },
  });

  const orderMutation = useMutation({
    mutationFn: async (items: Array<{ id: string; sortOrder: number }>) =>
      updateOpsMediaPublicationOrder(items),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-media-list'] });
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

  return {
    // State
    statusFilter,
    surfaceFilter,
    leagueFilter,
    mediaOrderIds,
    previewId,
    editId,
    archiveId,

    // Setters
    setStatusFilter,
    setSurfaceFilter,
    setLeagueFilter,
    setMediaOrderIds,
    setPreviewId,
    setEditId,
    setArchiveId,
    resetFilters,

    // Data
    mediaPublications,
    orderedMediaPublications,
    hasPendingOrderChanges,

    // Query/Mutation states
    isLoading: mediaListQuery.isLoading,
    isError: mediaListQuery.isError,
    isSuccess: mediaListQuery.isSuccess,
    isFetching: mediaListQuery.isFetching,
    isPatchingPending: patchMutation.isPending,
    isDeletingPending: deleteMutation.isPending,
    isOrderingPending: orderMutation.isPending,
    error: mediaListQuery.error,
    patchError: patchMutation.error,
    deleteError: deleteMutation.error,
    orderError: orderMutation.error,

    // Actions
    saveMetadata,
    archiveMedia,
    saveOrder,
    moveMedia,
  };
}
