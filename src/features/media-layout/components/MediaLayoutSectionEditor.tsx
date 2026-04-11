import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaAsset } from '@/types';
import { createIdempotencyKey } from '@/lib/api/idempotency';
import { toast } from 'sonner';
import { getMediaLayout } from '../api/getMediaLayout';
import { saveMediaLayoutOrder } from '../api/saveMediaLayoutOrder';
import { resetMediaLayout } from '../api/resetMediaLayout';
import { buildLayoutPayloadHash, normalizeOrderedIds } from '../lib/hash';
import { useMediaLayoutEditor } from '../hooks/useMediaLayoutEditor';
import { MediaLayoutGrid } from './MediaLayoutGrid';
import { MediaLayoutSaveBar } from './MediaLayoutSaveBar';
import { MEDIA_LAYOUT_SECTION_SLUG } from '../constants';

type Props = { assets: MediaAsset[] };

export function MediaLayoutSectionEditor({ assets }: Props) {
  const queryClient = useQueryClient();
  const layoutQuery = useQuery({
    queryKey: ['media-layout', MEDIA_LAYOUT_SECTION_SLUG],
    queryFn: () => getMediaLayout(MEDIA_LAYOUT_SECTION_SLUG),
    staleTime: 30_000,
  });

  const editor = useMediaLayoutEditor(layoutQuery.data, assets.slice(0, 9));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!layoutQuery.data) throw new Error('layout unavailable');
      const normalized = normalizeOrderedIds(editor.orderedIds);
      await buildLayoutPayloadHash(MEDIA_LAYOUT_SECTION_SLUG, normalized);
      return saveMediaLayoutOrder({
        sectionSlug: MEDIA_LAYOUT_SECTION_SLUG,
        orderedMediaAssetIds: normalized,
        idempotencyKey: createIdempotencyKey('media-layout-save'),
        expectedSectionUpdatedAt: layoutQuery.data.section.updatedAt,
      });
    },
    onMutate: () => editor.setState('saving'),
    onSuccess: async () => {
      editor.setState('saved');
      editor.cancel();
      await queryClient.invalidateQueries({ queryKey: ['media-layout', MEDIA_LAYOUT_SECTION_SLUG] });
    },
    onError: (error) => {
      editor.setState('failed');
      toast.error(error instanceof Error ? error.message : 'Save failed');
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!layoutQuery.data) throw new Error('layout unavailable');
      return resetMediaLayout({
        sectionSlug: MEDIA_LAYOUT_SECTION_SLUG,
        idempotencyKey: createIdempotencyKey('media-layout-reset'),
        expectedSectionUpdatedAt: layoutQuery.data.section.updatedAt,
      });
    },
    onSuccess: async () => {
      editor.cancel();
      editor.setState('saved');
      await queryClient.invalidateQueries({ queryKey: ['media-layout', MEDIA_LAYOUT_SECTION_SLUG] });
    },
    onError: (error) => {
      editor.setState('failed');
      toast.error(error instanceof Error ? error.message : 'Reset failed');
    },
  });

  if (layoutQuery.isLoading) return <div className="panel mb-4 p-3 text-xs text-muted-foreground">Loading media layout…</div>;
  if (layoutQuery.isError) return <div className="panel mb-4 p-3 text-xs text-destructive">Failed to load media layout.</div>;

  return (
    <div className="mb-6">
      <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-[#C9A84C]">Media Layout Manager</h2>
      <MediaLayoutSaveBar
        state={saveMutation.isPending || resetMutation.isPending ? 'saving' : editor.state}
        onSave={() => saveMutation.mutate()}
        onCancel={editor.cancel}
        onReset={() => {
          if (window.confirm('Reset this section to default order?')) resetMutation.mutate();
        }}
      />
      <MediaLayoutGrid
        items={editor.orderedAssets.map((asset) => ({ id: asset.id, title: asset.title, thumbnail: asset.thumbnail }))}
        onChange={editor.setOrder}
      />
    </div>
  );
}
