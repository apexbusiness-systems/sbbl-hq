import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ingestPresign,
  ingestSubmit,
  type IngestKind,
} from '@/lib/api/ops';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@/lib/api/idempotency';

/**
 * Visual wrapper around the existing ingest pipeline.
 * Steps: league → surface → status → drop → review.
 * Preserves existing ingest plumbing (presign → upload → submit → approve).
 */

export type UploadStep = 'league' | 'surface' | 'status' | 'drop' | 'review' | 'complete';

export type UploadFlowState = {
  step: UploadStep;
  leagueId: string | null;
  surface: string | null;
  publishStatus: 'draft' | 'published' | 'needs_review';
  imageUrl: string | null;
  objectPath: string | null;
  jobId: string | null;
  parserResult: Record<string, unknown> | null;
  /** Operator overrides for parser-guessed fields */
  fieldOverrides: Record<string, unknown>;
};

const INITIAL_STATE: UploadFlowState = {
  step: 'league',
  leagueId: null,
  surface: null,
  publishStatus: 'draft',
  imageUrl: null,
  objectPath: null,
  jobId: null,
  parserResult: null,
  fieldOverrides: {},
};

export function useMediaUploadFlow() {
  const queryClient = useQueryClient();
  const [flowState, setFlowState] = useState<UploadFlowState>(INITIAL_STATE);

  const setStep = useCallback((step: UploadStep) => {
    setFlowState((prev) => ({ ...prev, step }));
  }, []);

  const setLeague = useCallback((leagueId: string) => {
    setFlowState((prev) => ({ ...prev, leagueId, step: 'surface' }));
  }, []);

  const setSurface = useCallback((surface: string) => {
    setFlowState((prev) => ({ ...prev, surface, step: 'status' }));
  }, []);

  const setPublishStatus = useCallback((status: 'draft' | 'published' | 'needs_review') => {
    setFlowState((prev) => ({ ...prev, publishStatus: status, step: 'drop' }));
  }, []);

  const presignMutation = useMutation({
    mutationFn: async (filename: string) => {
      if (!flowState.surface) throw new Error('Surface not selected');
      return ingestPresign(flowState.surface as IngestKind, filename);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (params: {
      publicUrl: string;
      title: string;
    }) => {
      if (!flowState.surface || !flowState.objectPath) {
        throw new Error('Missing surface or object path');
      }
      const result = await ingestSubmit({
        kind: flowState.surface as IngestKind,
        objectPath: flowState.objectPath,
        publicUrl: params.publicUrl,
        title: params.title,
        leagueId: flowState.leagueId,
        publishStatus: flowState.publishStatus === 'needs_review' ? 'draft' : flowState.publishStatus,
        idempotencyKey: createIdempotencyKey(`upload-${flowState.objectPath}`),
      });
      return result;
    },
    onSuccess: async (result) => {
      setFlowState((prev) => ({
        ...prev,
        jobId: result.jobId ?? null,
        step: 'review',
      }));
      await queryClient.invalidateQueries({ queryKey: ['ops-media-list'] });
    },
  });

  const overrideParserField = useCallback((field: string, value: unknown) => {
    setFlowState((prev) => ({
      ...prev,
      fieldOverrides: { ...prev.fieldOverrides, [field]: value },
    }));
  }, []);

  const reset = useCallback(() => {
    setFlowState(INITIAL_STATE);
  }, []);

  const goBack = useCallback(() => {
    setFlowState((prev) => {
      const stepOrder: UploadStep[] = ['league', 'surface', 'status', 'drop', 'review', 'complete'];
      const currentIndex = stepOrder.indexOf(prev.step);
      const prevStep = currentIndex > 0 ? stepOrder[currentIndex - 1] : prev.step;
      return { ...prev, step: prevStep };
    });
  }, []);

  return {
    flowState,
    setStep,
    setLeague,
    setSurface,
    setPublishStatus,
    presignMutation,
    submitMutation,
    overrideParserField,
    reset,
    goBack,
    isUploading: presignMutation.isPending || submitMutation.isPending,
    uploadError: presignMutation.error ?? submitMutation.error,
  };
}
