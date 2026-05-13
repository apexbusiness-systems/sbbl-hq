import { ImageIcon, Save, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { MediaFilterBar } from './MediaFilterBar';
import { MediaCard } from './MediaCard';
import { ArchiveModal } from './ArchiveModal';
import { EditMetadataModal } from './EditMetadataModal';
import { PreviewModal } from './PreviewModal';
import { useOpsMediaLibrary } from '@/hooks/useOpsMediaLibrary';
import type { MediaPublicationStatus } from '@/lib/api/ops';

export type MediaLibraryTabProps = {
  enabled: boolean;
};

export function MediaLibraryTab({ enabled }: MediaLibraryTabProps) {
  const {
    statusFilter,
    surfaceFilter,
    leagueFilter,
    mediaOrderIds,
    previewId,
    editId,
    archiveId,
    setStatusFilter,
    setSurfaceFilter,
    setLeagueFilter,
    setMediaOrderIds,
    setPreviewId,
    setEditId,
    setArchiveId,
    resetFilters,
    mediaPublications,
    orderedMediaPublications,
    hasPendingOrderChanges,
    isLoading,
    isError,
    isSuccess,
    isFetching,
    isPatchingPending,
    isDeletingPending,
    isOrderingPending,
    error,
    patchError,
    deleteError,
    orderError,
    saveMetadata,
    archiveMedia,
    saveOrder,
    moveMedia,
  } = useOpsMediaLibrary(enabled);

  // Sync media order IDs when publications change
  useEffect(() => {
    if (mediaPublications.length > 0 && mediaOrderIds.length === 0) {
      setMediaOrderIds(mediaPublications.map((pub) => pub.id));
    }
  }, [mediaPublications, mediaOrderIds.length, setMediaOrderIds]);

  const previewPublication = orderedMediaPublications.find((p) => p.id === previewId);
  const editPublication = orderedMediaPublications.find((p) => p.id === editId);
  const archivePublication = orderedMediaPublications.find((p) => p.id === archiveId);

  return (
    <div className="panel p-4 max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-primary" />
        <div>
          <h2 className="font-display text-xl">Media Library</h2>
          <p className="text-xs text-muted-foreground">
            Manage all media publications — Store, POTG, Events, and more. Public{' '}
            <code className="text-[10px] bg-secondary px-1 py-0.5 rounded">/media</code> shows
            published only.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <MediaFilterBar
        statusFilter={statusFilter}
        surfaceFilter={surfaceFilter}
        leagueFilter={leagueFilter}
        onStatusChange={setStatusFilter}
        onSurfaceChange={setSurfaceFilter}
        onLeagueChange={setLeagueFilter}
        onReset={resetFilters}
        isLoading={isFetching || isLoading}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-muted-foreground">
          {isFetching ? 'Refreshing…' : `${orderedMediaPublications.length} publications`}
        </div>
        <button
          type="button"
          onClick={saveOrder}
          disabled={!hasPendingOrderChanges || isOrderingPending || isFetching}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isOrderingPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving Order…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Order
            </>
          )}
        </button>
      </div>

      {/* Status Messages */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading media…
        </div>
      )}
      {isError && (
        <p className="text-xs text-destructive">
          Failed to load media: {(error as Error)?.message ?? 'unknown error'}
        </p>
      )}
      {isSuccess && mediaPublications.length === 0 && (
        <p className="text-xs text-muted-foreground">No publications match these filters.</p>
      )}
      {patchError && <p className="text-xs text-destructive">Edit failed: {(patchError as Error).message}</p>}
      {deleteError && (
        <p className="text-xs text-destructive">Archive failed: {(deleteError as Error).message}</p>
      )}
      {orderError && <p className="text-xs text-destructive">Save order failed: {(orderError as Error).message}</p>}

      {/* Media Grid */}
      <div className="space-y-3">
        {orderedMediaPublications.map((publication, index) => (
          <MediaCard
            key={publication.id}
            publication={publication}
            isEditing={editId === publication.id}
            onEdit={() => setEditId(publication.id)}
            onArchive={() => setArchiveId(publication.id)}
            onPreview={() => setPreviewId(publication.id)}
            onMoveUp={() => moveMedia(publication.id, 'up')}
            onMoveDown={() => moveMedia(publication.id, 'down')}
            canMoveUp={index > 0}
            canMoveDown={index < orderedMediaPublications.length - 1}
            isLoading={isOrderingPending || isFetching}
            editsDisabled={isPatchingPending || isDeletingPending}
          />
        ))}
      </div>

      {/* Modals */}
      <PreviewModal publication={previewPublication} isOpen={Boolean(previewId)} onClose={() => setPreviewId(null)} />

      <EditMetadataModal
        publication={editPublication}
        isOpen={Boolean(editId)}
        isLoading={isPatchingPending}
        onConfirm={(title, status, leagueId) => {
          if (editPublication) {
            saveMetadata(editPublication.id, title, status, leagueId);
          }
        }}
        onCancel={() => setEditId(null)}
      />

      <ArchiveModal
        publication={archivePublication}
        isOpen={Boolean(archiveId)}
        isLoading={isDeletingPending}
        onConfirm={() => {
          if (archivePublication) {
            archiveMedia(archivePublication.id);
          }
        }}
        onCancel={() => setArchiveId(null)}
      />
    </div>
  );
}
