import {
  ImageIcon,
  Save,
  Loader2,
  Trash2,
  CheckSquare,
  Archive,
} from 'lucide-react';
import { useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MediaFilterBar } from './MediaFilterBar';
import { MediaCard, type MediaCardProps } from './MediaCard';
import { ArchiveModal } from './ArchiveModal';
import { EditMetadataSheet } from './EditMetadataSheet';
import { PreviewSheet } from './PreviewSheet';
import { RestoreModal } from './RestoreModal';
import { StaleCleanupModal } from './StaleCleanupModal';
import { BulkSelectBar } from './BulkSelectBar';
import { useOpsMediaLibrary } from '@/hooks/useOpsMediaLibrary';
import type { MediaPublicationStatus } from '@/lib/api/ops';

export type MediaLibraryTabProps = {
  enabled: boolean;
};

// SortableItem wrapper — uses @dnd-kit/sortable to inject drag props
function SortableMediaCard({
  id,
  isDragMode,
  ...props
}: { id: string; isDragMode: boolean } & Omit<MediaCardProps, 'isDragMode' | 'dragListeners' | 'dragAttributes' | 'isDragging'>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isDragMode });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <MediaCard
        {...props}
        isDragMode={isDragMode}
        dragListeners={isDragMode ? listeners : undefined}
        dragAttributes={isDragMode ? attributes : undefined}
        isDragging={isDragging}
      />
    </div>
  );
}

export function MediaLibraryTab({ enabled }: MediaLibraryTabProps) {
  const {
    // Filters
    statusFilter,
    surfaceFilter,
    leagueFilter,
    sortBy,
    search,
    mediaOrderIds,

    // Modal / sheet state
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

  const isDragMode = sortBy === 'sort_order';

  // DnD sensors — pointer (mouse + touch) and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderMedia(String(active.id), String(over.id));
    }
  }

  return (
    <div className="panel p-3 sm:p-4 lg:p-6 max-w-6xl space-y-3 sm:space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <h2 className="font-display text-lg sm:text-xl">Media Library</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Manage publications — Store, POTG, Events, and more.{' '}
              <code className="text-[10px] bg-secondary px-1 py-0.5 rounded">/media</code>{' '}
              shows published only.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">

          {/* Bulk select toggle */}
          <button
            type="button"
            onClick={() => (isBulkMode ? exitBulkMode() : setIsBulkMode(true))}
            disabled={anythingPending}
            aria-label={isBulkMode ? 'Exit bulk select mode' : 'Enter bulk select mode'}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-sm border transition-colors disabled:opacity-50 min-h-[40px] ${
              isBulkMode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isBulkMode ? 'Exit Select' : 'Bulk Select'}</span>
          </button>

          {/* Stale cleanup */}
          <button
            type="button"
            onClick={openStaleCleanup}
            disabled={anythingPending}
            aria-label="Stale media cleanup"
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 transition-colors min-h-[40px]"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stale Cleanup</span>
          </button>

          {/* Save Order — only in drag mode with pending changes */}
          {isDragMode && hasPendingOrderChanges && (
            <button
              type="button"
              onClick={saveOrder}
              disabled={isOrderingPending || isFetching}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[40px]"
            >
              {isOrderingPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Saving…</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save Order</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Bar ── */}
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

      {/* ── Bulk select bar (sticky top) ── */}
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

      {/* ── Count + status bar ── */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {isFetching ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Refreshing…
            </span>
          ) : (
            `${orderedMediaPublications.length} publications`
          )}
        </span>
        <div className="flex items-center gap-3">
          {isDragMode && hasPendingOrderChanges && !isFetching && (
            <span className="text-warning font-semibold">Unsaved order changes</span>
          )}
          {isBulkMode && (
            <span className="text-primary font-semibold">{bulkSelectedIds.size} selected</span>
          )}
        </div>
      </div>

      {/* ── Status messages ── */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading media…
        </div>
      )}
      {isError && (
        <p className="text-xs text-destructive">
          Failed to load media: {(error as Error)?.message ?? 'unknown error'}
        </p>
      )}
      {isSuccess && mediaPublications.length === 0 && (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No publications match these filters.
        </div>
      )}
      {patchError && (
        <p className="text-xs text-destructive">Edit failed: {(patchError as Error).message}</p>
      )}
      {deleteError && (
        <p className="text-xs text-destructive">Archive failed: {(deleteError as Error).message}</p>
      )}
      {orderError && (
        <p className="text-xs text-destructive">Save order failed: {(orderError as Error).message}</p>
      )}
      {bulkArchiveError && (
        <p className="text-xs text-destructive">Bulk archive failed: {(bulkArchiveError as Error).message}</p>
      )}
      {restoreError && (
        <p className="text-xs text-destructive">Restore failed: {(restoreError as Error).message}</p>
      )}

      {/* ── Media list with DnD ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedMediaPublications.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5 sm:space-y-2">
            {orderedMediaPublications.map((publication) => (
              <SortableMediaCard
                key={publication.id}
                id={publication.id}
                publication={publication}
                isSelected={bulkSelectedIds.has(publication.id)}
                isBulkMode={isBulkMode}
                isDragMode={isDragMode}
                onEdit={() => setEditId(publication.id)}
                onArchive={() => setArchiveId(publication.id)}
                onPreview={() => setPreviewId(publication.id)}
                onRestore={() => setRestoreId(publication.id)}
                onPin={() => togglePin(publication.id)}
                onToggleSelect={() => toggleBulkSelect(publication.id)}
                isLoading={isOrderingPending || isFetching}
                editsDisabled={anythingPending}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Sheets ── */}
      <PreviewSheet
        publication={previewPublication ?? null}
        isOpen={Boolean(previewId)}
        onClose={() => setPreviewId(null)}
      />

      <EditMetadataSheet
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

      {/* ── Confirmation Modals ── */}
      <ArchiveModal
        publication={archivePublication ?? null}
        isOpen={Boolean(archiveId)}
        isLoading={isDeletingPending}
        onConfirm={() => { if (archivePublication) archiveMedia(archivePublication.id); }}
        onCancel={() => setArchiveId(null)}
      />

      <RestoreModal
        publication={restorePublication ?? null}
        isOpen={Boolean(restoreId)}
        isLoading={isRestoringPending}
        onConfirm={() => { if (restorePublication) restoreMedia(restorePublication.id); }}
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
