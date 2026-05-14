import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleMediaPin } from '@/lib/api/ops';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@/lib/api/idempotency';

/**
 * Toggle pin on a media publication.
 * pinned = true → sets pinnedAt to now, false → sets pinnedAt to null.
 */
export function useMediaPin() {
  const queryClient = useQueryClient();

  const pinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) =>
      toggleMediaPin(id, pinned),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-media-list'] });
      await queryClient.invalidateQueries({ queryKey: ['ops-media-search'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media-posters'] });
    },
  });

  const togglePin = useCallback(
    (id: string, currentlyPinned: boolean) => {
      pinMutation.mutate({ id, pinned: !currentlyPinned });
    },
    [pinMutation],
  );

  return {
    isPinning: pinMutation.isPending,
    pinError: pinMutation.error,
    togglePin,
  };
}
