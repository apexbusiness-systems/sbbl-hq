import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOpsMediaPublicationOrder } from '@/lib/api/ops';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@/lib/api/idempotency';

/**
 * Manages drag-and-drop reorder for media publications with
 * optimistic updates and rollback on failure.
 * Provides fallback moveUp/moveDown + resetOrder.
 */
export function useMediaDragOrder(publicationIds: string[]) {
  const queryClient = useQueryClient();
  const [localOrderIds, setLocalOrderIds] = useState<string[]>([]);
  const serverOrderIdsRef = useRef<string[]>([]);

  // Snapshot server order when publications change
  useMemo(() => {
    if (publicationIds.length > 0 && localOrderIds.length === 0) {
      setLocalOrderIds([...publicationIds]);
      serverOrderIdsRef.current = [...publicationIds];
    }
  }, [publicationIds, localOrderIds.length]);

  const hasPendingChanges = useMemo(() => {
    if (localOrderIds.length !== publicationIds.length) return false;
    return localOrderIds.some((id, index) => id !== publicationIds[index]);
  }, [localOrderIds, publicationIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const orderMutation = useMutation({
    mutationFn: async (items: Array<{ id: string; sortOrder: number }>) =>
      updateOpsMediaPublicationOrder(items),
    onSuccess: async () => {
      serverOrderIdsRef.current = [...localOrderIds];
      await queryClient.invalidateQueries({ queryKey: ['ops-media-list'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media'] });
    },
    onError: () => {
      // Rollback to last known server order
      setLocalOrderIds([...serverOrderIdsRef.current]);
    },
  });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setLocalOrderIds((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    },
    [],
  );

  const moveUp = useCallback((id: string) => {
    setLocalOrderIds((prev) => {
      const index = prev.indexOf(id);
      if (index <= 0) return prev;
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setLocalOrderIds((prev) => {
      const index = prev.indexOf(id);
      if (index < 0 || index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const saveOrder = useCallback(() => {
    if (!hasPendingChanges) return;
    orderMutation.mutate(
      localOrderIds.map((id, index) => ({ id, sortOrder: index })),
    );
  }, [hasPendingChanges, localOrderIds, orderMutation]);

  const resetOrder = useCallback(() => {
    setLocalOrderIds([...serverOrderIdsRef.current]);
  }, []);

  return {
    localOrderIds,
    hasPendingChanges,
    isSaving: orderMutation.isPending,
    orderError: orderMutation.error,
    sensors,
    handleDragEnd,
    moveUp,
    moveDown,
    saveOrder,
    resetOrder,
    setLocalOrderIds,
  };
}
