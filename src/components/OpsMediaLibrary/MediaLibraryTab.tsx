import { ImageIcon, Save, Loader2, Trash2, CheckSquare, Archive } from 'lucide-react';
import { useEffect } from 'react';
import { MediaFilterBar } from './MediaFilterBar';
import { MediaCard } from './MediaCard';
import { ArchiveModal } from './ArchiveModal';
import { EditMetadataModal } from './EditMetadataModal';
import { PreviewModal } from './PreviewModal';
import { RestoreModal } from './RestoreModal';
import { StaleCleanupModal } from './StaleCleanupModal';
import { BulkSelectBar } from './BulkSelectBar';
import { useOpsMediaLibrary } from '@/hooks/useOpsMediaLibrary';
import type { MediaPublicationStatus } from '@/lib/api/ops';

export type MediaLibraryTabProps = {
  enabled: boolean;
};

export function MediaLibraryTab({ enabled }: MediaLibraryTabProps) {
  const {
    // Filters
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
    isLoading,
    isError,
    isSuccess,
    isFetching,
    isStaleLoading,

    // Mutation states
    isPatchingPending,
    isDeletingPending,
    isOrderingPending,
    isBulkArchivingPending,
    isPinningPending,
    isRestoringPending,
    isStaleArchivingPending,

    // Errors
    error,
    patchError,
    deleteError,
    orderError,
    bulkArchiveError,
    restoreError,

    // Actions
    saveMetadata,
    archiveMedia,
    restoreMedia,
    saveOrder,
    moveMedia,
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
  } = useOpsMediaLibrary(enabled);

  // Sync manual order IDs when publications change (only when not yet set)
  useEffect(() => {
    if (mediaPublications.length > 0 && mediaOrderIds.length === 0) {
      setMediaOrderIds(mediaPublications.map((pub) => pub.id));
    }
  }, [mediaPublications, mediaOrderIds.length, setMediaOrderIds]);

  const previewPublication = orderedMediaPublications.find((p) => p.id === previewId);
  const editPublication = orderedMediaPublications.find((p) => p.id === editId);
  const archivePublication = orderedMediaPublications.find((p) => p.id === archiveId);
  const restorePublication = orderedMediaPublications.find((p) => p.id === restoreId);

  const anythingPending =
    isPatchingPending || isDeletingPending || isOrderingPending ||
    isBulkArchivingPending || isPinningPending || isRestoringPending;

  return (
    <div className="panel p-4 max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
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

        {/* Toolbar actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Bulk select toggle */}
          <button
            type="button"
            onClick={() => (isBulkMode ? exitBulkMode() : setIsBulkMode(true))}
            disabled={anythingPending}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-sm border transition-colors disabled:opacity-50 min-h-[44px] ${
              isBulkMode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
            aria-label={isBulkMode ? 'Exit bulk select mode' : 'Enter bulk select mode'}
            title={isBulkMode ? 'Exit bulk select' : 'Bulk select'}
          >
            <CheckSquare className="w-4 h-4" />
            {isBulkMode ? 'Exit Select' : 'Bulk Select'}
          </button>

          {/* Stale cleanup */}
          <button
            type="button"
            onClick={openStaleCleanup}
            disabled={anythingPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 transition-colors min-h-[44px]"
            aria-label="Stale media cleanup"
            title="Archive stale unpinned media"
          >
            <Archive className="w-4 h-4" />
            Stale Cleanup
          </button>

          {/* Save order (visible when sort_order mode and pending changes) */}
          {sortBy === 'sort_order' && hasPendingOrderChanges && (
            <button
              type="button"
              onClick={saveOrder}
              disabled={isOrderingPending || isFetching}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
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
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <MediaFilterBar
        statusFilter={statusFilter}
        surfaceFilter={surfaceFilter}
        leagueFilter={leagueFilter}
        sortBy={sortBy}
        search={search}
        onStatusChange={setStatusFilter}
        onSurfaceChange={setSurfaceFilter}
        onLeagueChange={setLeagueFilter}
        onSortChange={setSortBy}
        onSearchChange={setSearch}
        onReset={resetFilters}
        isLoading={isFetching || isLoading}
      />

      {/* Bulk select bar (sticky) */}
      {isBulkMode && (
        <BulkSelectBar
          selectedCount={bulkSelectedIds.size}
          totalCount={orderedMediaPublications.length}
          isBulkArchiving={isBulkArchivingPending}
          onBulkArchive={executeBulkArchive}
          onSelectAll={selectAll}
          onClearSelection={clearBulkSelection}
        />
      )}

      {/* Count bar */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {isFetching ? 'Refreshing…' : `${orderedMediaPublications.length} publications`}
        </span>
        {isBulkMode && (
          <span className="text-primary font-semibold">{bulkSelectedIds.size} selected</span>
        )}
      </div>

      {/* Status messages */}
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
      {bulkArchiveError && (
        <p className="text-xs text-destructive">Bulk archive failed: {(bulkArchiveError as Error).message}</p>
      )}
      {restoreError && (
        <p className="text-xs text-destructive">Restore failed: {(restoreError as Error).message}</p>
      )}

      {/* Media Grid */}
      <div className="space-y-2">
        {orderedMediaPublications.map((publication, index) => (
          <MediaCard
            key={publication.id}
            publication={publication}
            isEditing={editId === publication.id}
            isSelected={bulkSelectedIds.has(publication.id)}
            isBulkMode={isBulkMode}
            onEdit={() => setEditId(publication.id)}
            onArchive={() => setArchiveId(publication.id)}
            onPreview={() => setPreviewId(publication.id)}
            onRestore={() => setRestoreId(publication.id)}
            onPin={() => togglePin(publication.id)}
            onMoveUp={() => moveMedia(publication.id, 'up')}
            onMoveDown={() => moveMedia(publication.id, 'down')}
            onToggleSelect={() => toggleBulkSelect(publication.id)}
            canMoveUp={index > 0}
            canMoveDown={index < orderedMediaPublications.length - 1}
            isLoading={isOrderingPending || isFetching}
            editsDisabled={anythingPending}
          />
        ))}
      </div>

      {/* Modals */}
      <PreviewModal
        publication={previewPublication ?? null}
        isOpen={Boolean(previewId)}
        onClose={() => setPreviewId(null)}
      />

      <EditMetadataModal
        publication={editPublication ?? null}
        isOpen={Boolean(editId)}
        isLoading={isPatchingPending}
        onConfirm={(title, status, leagueId) => {
          if (editPublication) {
            saveMetadata(editPublication.id, title, status as MediaPublicationStatus, leagueId);
          }
        }}
        onCancel={() => setEditId(null)}
      />

      <ArchiveModal
        publication={archivePublication ?? null}
        isOpen={Boolean(archiveId)}
        isLoading={isDeletingPending}
        onConfirm={() => {
          if (archivePublication) {
            archiveMedia(archivePublication.id);
          }
        }}
        onCancel={() => setArchiveId(null)}
      />

      <RestoreModal
        publication={restorePublication ?? null}
        isOpen={Boolean(restoreId)}
        isLoading={isRestoringPending}
        onConfirm={() => {
          if (restorePublication) {
            restoreMedia(restorePublication.id);
          }
        }}
        onCancel={() => setRestoreId(null)}
      />

      <StaleCleanupModal
        staleItems={staleItems}
        selectedIds={staleSelectedIds}
        isOpen={staleCleanupOpen}
        isLoading={isStaleArchivingPending}
        isFetching={isStaleLoading}
        days={30}
        onToggleSelect={toggleStaleSelect}
        onSelectAll={selectAllStale}
        onDeselectAll={deselectAllStale}
        onConfirm={executeStaleArchive}
        onCancel={closeStaleCleanup}
      />
    </div>
  );
}
