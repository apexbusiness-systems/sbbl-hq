import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  previewStaleCleanup,
  executeStaleCleanup,
  type StaleCleanupPreviewResponse,
  type StaleCleanupExecuteResponse,
} from '@/lib/api/ops';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@/lib/api/idempotency';

/**
 * Two-phase stale media cleanup: preview → confirm → execute.
 * Preview shows which publications would be affected.
 * Execute re-validates server-side (never trusts client IDs).
 */
export function useMediaStaleCleanup() {
  const queryClient = useQueryClient();
  const [olderThanDays, setOlderThanDays] = useState(30);
  const [previewResult, setPreviewResult] = useState<StaleCleanupPreviewResponse | null>(null);
  const [executeResult, setExecuteResult] = useState<StaleCleanupExecuteResponse | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (days?: number) =>
      previewStaleCleanup({ olderThanDays: days ?? olderThanDays }),
    onSuccess: (data) => {
      setPreviewResult(data);
      setExecuteResult(null);
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (days?: number) =>
      executeStaleCleanup({ olderThanDays: days ?? olderThanDays }),
    onSuccess: async (data) => {
      setExecuteResult(data);
      await queryClient.invalidateQueries({ queryKey: ['ops-media-list'] });
      await queryClient.invalidateQueries({ queryKey: ['ops-media-search'] });
      await queryClient.invalidateQueries({ queryKey: ['public-media'] });
    },
  });

  const fetchPreview = useCallback(() => {
    previewMutation.mutate(olderThanDays);
  }, [olderThanDays, previewMutation]);

  const executeCleanup = useCallback(() => {
    executeMutation.mutate(olderThanDays);
  }, [olderThanDays, executeMutation]);

  const reset = useCallback(() => {
    setPreviewResult(null);
    setExecuteResult(null);
    setOlderThanDays(30);
  }, []);

  return {
    olderThanDays,
    setOlderThanDays,
    previewResult,
    executeResult,
    isPreviewLoading: previewMutation.isPending,
    isExecuteLoading: executeMutation.isPending,
    previewError: previewMutation.error,
    executeError: executeMutation.error,
    fetchPreview,
    executeCleanup,
    reset,
  };
}
