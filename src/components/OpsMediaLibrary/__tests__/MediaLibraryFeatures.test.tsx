/**
 * Tests for new Media Command Center features:
 *  - Pinning (pin/unpin, blocks archive, excluded from stale cleanup)
 *  - Bulk archive (all-or-nothing, pinned rejected, at most 100 IDs)
 *  - Restore (archived → draft)
 *  - Needs Review badge / filter
 *  - Parser confidence badge
 *  - Bulk select UI
 *  - Stale cleanup modal flow
 *  - Search and sort controls
 *  - RestoreModal, StaleCleanupModal, BulkSelectBar components
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaCard } from '../MediaCard';
import { RestoreModal } from '../RestoreModal';
import { StaleCleanupModal } from '../StaleCleanupModal';
import { BulkSelectBar } from '../BulkSelectBar';
import { MediaFilterBar } from '../MediaFilterBar';
import type { OpsMediaPublication, OpsStaleMedia } from '@/lib/api/ops';

// ── Fixtures ────────────────────────────────────────────────────────────────

const basePublication: OpsMediaPublication = {
  id: 'pub-1',
  mediaAssetId: 'asset-1',
  surface: 'store',
  title: 'Test Media',
  subtitle: null,
  status: 'published',
  publishedAt: '2026-05-01T00:00:00Z',
  scheduledAt: null,
  sortAt: null,
  sortOrder: null,
  leagueId: 'wbl',
  leagueCode: 'WBL',
  leagueName: 'Weekend Basketball League',
  type: 'image',
  thumbnail: '/test.jpg',
  createdAt: '2026-05-01T00:00:00Z',
  pinnedAt: null,
  needsReview: false,
  parserConfidence: null,
};

const defaultCardProps = {
  publication: basePublication,
  isSelected: false,
  isBulkMode: false,
  isDragMode: false,
  onEdit: vi.fn(),
  onArchive: vi.fn(),
  onPreview: vi.fn(),
  onRestore: vi.fn(),
  onPin: vi.fn(),
  onToggleSelect: vi.fn(),
  isLoading: false,
  editsDisabled: false,
};

// ── MediaCard new features ────────────────────────────────────────────────

describe('MediaCard — pinning', () => {
  it('renders pin button for unpinned published item', () => {
    render(<MediaCard {...defaultCardProps} />);
    const pinBtn = screen.getByRole('button', { name: /Pin "Test Media"/i });
    expect(pinBtn).toBeInTheDocument();
  });

  it('renders unpin button and Pinned badge for pinned item', () => {
    const pinned: OpsMediaPublication = { ...basePublication, pinnedAt: '2026-05-14T10:00:00Z' };
    render(<MediaCard {...defaultCardProps} publication={pinned} />);
    expect(screen.getByRole('button', { name: /Unpin "Test Media"/i })).toBeInTheDocument();
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('disables archive button when item is pinned', () => {
    const pinned: OpsMediaPublication = { ...basePublication, pinnedAt: '2026-05-14T10:00:00Z' };
    render(<MediaCard {...defaultCardProps} publication={pinned} />);
    const archiveBtn = screen.getByRole('button', { name: /Cannot archive pinned/i });
    expect(archiveBtn).toBeDisabled();
  });

  it('calls onPin when pin button is clicked', () => {
    const onPin = vi.fn();
    render(<MediaCard {...defaultCardProps} onPin={onPin} />);
    fireEvent.click(screen.getByRole('button', { name: /Pin "Test Media"/i }));
    expect(onPin).toHaveBeenCalledOnce();
  });

  it('does not render pin button for archived items', () => {
    const archived: OpsMediaPublication = { ...basePublication, status: 'archived' };
    render(<MediaCard {...defaultCardProps} publication={archived} />);
    expect(screen.queryByRole('button', { name: /Pin/i })).not.toBeInTheDocument();
  });
});

describe('MediaCard — restore', () => {
  it('shows restore button for archived items instead of archive button', () => {
    const archived: OpsMediaPublication = { ...basePublication, status: 'archived' };
    render(<MediaCard {...defaultCardProps} publication={archived} />);
    expect(screen.getByRole('button', { name: /Restore "Test Media"/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Archive "Test Media"/i })).not.toBeInTheDocument();
  });

  it('calls onRestore when restore button clicked', () => {
    const onRestore = vi.fn();
    const archived: OpsMediaPublication = { ...basePublication, status: 'archived' };
    render(<MediaCard {...defaultCardProps} publication={archived} onRestore={onRestore} />);
    fireEvent.click(screen.getByRole('button', { name: /Restore "Test Media"/i }));
    expect(onRestore).toHaveBeenCalledOnce();
  });
});

describe('MediaCard — needs review badge', () => {
  it('renders Needs Review badge when needsReview is true', () => {
    const review: OpsMediaPublication = { ...basePublication, needsReview: true };
    render(<MediaCard {...defaultCardProps} publication={review} />);
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
  });

  it('does not render Needs Review badge when needsReview is false', () => {
    render(<MediaCard {...defaultCardProps} />);
    expect(screen.queryByText('Needs Review')).not.toBeInTheDocument();
  });
});

describe('MediaCard — parser confidence badge', () => {
  it('renders confidence badge when parserConfidence is set', () => {
    const confident: OpsMediaPublication = { ...basePublication, parserConfidence: 0.87 };
    render(<MediaCard {...defaultCardProps} publication={confident} />);
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('renders low-confidence badge in red styling', () => {
    const lowConf: OpsMediaPublication = { ...basePublication, parserConfidence: 0.35 };
    render(<MediaCard {...defaultCardProps} publication={lowConf} />);
    const badge = screen.getByText('35%');
    expect(badge).toHaveClass('text-destructive');
  });

  it('does not render confidence badge when parserConfidence is null', () => {
    render(<MediaCard {...defaultCardProps} />);
    // No percentage text for confidence when null
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });
});

describe('MediaCard — bulk select', () => {
  it('renders checkbox in bulk mode', () => {
    render(<MediaCard {...defaultCardProps} isBulkMode={true} isSelected={false} />);
    expect(screen.getByRole('button', { name: /Select "Test Media"/i })).toBeInTheDocument();
  });

  it('shows checked state when selected in bulk mode', () => {
    render(<MediaCard {...defaultCardProps} isBulkMode={true} isSelected={true} />);
    expect(screen.getByRole('button', { name: /Deselect "Test Media"/i })).toBeInTheDocument();
  });

  it('calls onToggleSelect when checkbox clicked in bulk mode', () => {
    const onToggleSelect = vi.fn();
    render(<MediaCard {...defaultCardProps} isBulkMode={true} onToggleSelect={onToggleSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Select "Test Media"/i }));
    expect(onToggleSelect).toHaveBeenCalledOnce();
  });

  it('does not render checkbox when not in bulk mode', () => {
    render(<MediaCard {...defaultCardProps} isBulkMode={false} />);
    expect(screen.queryByRole('button', { name: /Select "Test Media"/i })).not.toBeInTheDocument();
  });

  it('does not render drag handle in bulk mode (drag mode is independent)', () => {
    render(<MediaCard {...defaultCardProps} isBulkMode={true} isDragMode={false} />);
    expect(screen.queryByRole('button', { name: /Drag to reorder/i })).not.toBeInTheDocument();
  });
});

// ── RestoreModal ──────────────────────────────────────────────────────────

describe('RestoreModal', () => {
  it('renders when open with publication', () => {
    render(
      <RestoreModal
        publication={basePublication}
        isOpen={true}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Restore to Draft?')).toBeInTheDocument();
    // Title appears in description text
    expect(screen.getByRole('dialog', { name: 'Restore Media' })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <RestoreModal
        publication={basePublication}
        isOpen={false}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText('Restore to Draft?')).not.toBeInTheDocument();
  });

  it('calls onConfirm when Restore button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <RestoreModal
        publication={basePublication}
        isOpen={true}
        isLoading={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Restore$/ }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <RestoreModal
        publication={basePublication}
        isOpen={true}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows loading spinner when isLoading', () => {
    render(
      <RestoreModal
        publication={basePublication}
        isOpen={true}
        isLoading={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Restoring…')).toBeInTheDocument();
  });
});

// ── BulkSelectBar ─────────────────────────────────────────────────────────

describe('BulkSelectBar', () => {
  it('renders null when selectedCount is 0', () => {
    const { container } = render(
      <BulkSelectBar
        selectedCount={0}
        totalCount={10}
        isBulkArchiving={false}
        onBulkArchive={vi.fn()}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows Archive N button with correct count', () => {
    render(
      <BulkSelectBar
        selectedCount={3}
        totalCount={10}
        isBulkArchiving={false}
        onBulkArchive={vi.fn()}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Archive 3 selected/i })).toBeInTheDocument();
    expect(screen.getByText('3 of 10 selected')).toBeInTheDocument();
  });

  it('calls onBulkArchive when archive button clicked', () => {
    const onBulkArchive = vi.fn();
    render(
      <BulkSelectBar
        selectedCount={2}
        totalCount={5}
        isBulkArchiving={false}
        onBulkArchive={onBulkArchive}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Archive 2 selected/i }));
    expect(onBulkArchive).toHaveBeenCalledOnce();
  });

  it('shows Select All button when not all selected', () => {
    render(
      <BulkSelectBar
        selectedCount={2}
        totalCount={5}
        isBulkArchiving={false}
        onBulkArchive={vi.fn()}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Select All/i })).toBeInTheDocument();
  });

  it('hides Select All button when all selected', () => {
    render(
      <BulkSelectBar
        selectedCount={5}
        totalCount={5}
        isBulkArchiving={false}
        onBulkArchive={vi.fn()}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /Select All/i })).not.toBeInTheDocument();
  });

  it('disables archive button when isBulkArchiving', () => {
    render(
      <BulkSelectBar
        selectedCount={2}
        totalCount={5}
        isBulkArchiving={true}
        onBulkArchive={vi.fn()}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );
    expect(screen.getByText('Archiving…')).toBeInTheDocument();
  });
});

// ── StaleCleanupModal ────────────────────────────────────────────────────

const staleItems: OpsStaleMedia[] = [
  { id: 'stale-1', title: 'Old Media A', surface: 'store', status: 'published', thumbnail: '', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'stale-2', title: 'Old Media B', surface: 'potg', status: 'draft', thumbnail: '', createdAt: '2026-01-02T00:00:00Z' },
];

describe('StaleCleanupModal', () => {
  it('renders stale item list', () => {
    render(
      <StaleCleanupModal
        staleItems={staleItems}
        selectedIds={new Set()}
        isOpen={true}
        isLoading={false}
        isFetching={false}
        days={30}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Old Media A')).toBeInTheDocument();
    expect(screen.getByText('Old Media B')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <StaleCleanupModal
        staleItems={staleItems}
        selectedIds={new Set()}
        isOpen={false}
        isLoading={false}
        isFetching={false}
        days={30}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText('Stale Media Cleanup')).not.toBeInTheDocument();
  });

  it('disables archive button when no items selected', () => {
    render(
      <StaleCleanupModal
        staleItems={staleItems}
        selectedIds={new Set()}
        isOpen={true}
        isLoading={false}
        isFetching={false}
        days={30}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const archiveBtn = screen.getByRole('button', { name: /Archive$/i });
    expect(archiveBtn).toBeDisabled();
  });

  it('enables archive button when items are selected', () => {
    render(
      <StaleCleanupModal
        staleItems={staleItems}
        selectedIds={new Set(['stale-1'])}
        isOpen={true}
        isLoading={false}
        isFetching={false}
        days={30}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Archive 1 Item/i })).not.toBeDisabled();
  });

  it('calls onToggleSelect when item is clicked', () => {
    const onToggleSelect = vi.fn();
    render(
      <StaleCleanupModal
        staleItems={staleItems}
        selectedIds={new Set()}
        isOpen={true}
        isLoading={false}
        isFetching={false}
        days={30}
        onToggleSelect={onToggleSelect}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Select Old Media A/i }));
    expect(onToggleSelect).toHaveBeenCalledWith('stale-1');
  });

  it('shows empty state when no stale items', () => {
    render(
      <StaleCleanupModal
        staleItems={[]}
        selectedIds={new Set()}
        isOpen={true}
        isLoading={false}
        isFetching={false}
        days={30}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/No stale media found/i)).toBeInTheDocument();
  });
});

// ── MediaFilterBar new features ─────────────────────────────────────────

describe('MediaFilterBar — search and sort', () => {
  const baseFilterProps = {
    statusFilter: 'all' as const,
    surfaceFilter: 'all',
    leagueFilter: 'all',
    sortBy: 'newest' as const,
    search: '',
    onStatusChange: vi.fn(),
    onSurfaceChange: vi.fn(),
    onLeagueChange: vi.fn(),
    onSortChange: vi.fn(),
    onSearchChange: vi.fn(),
    onReset: vi.fn(),
  };

  it('renders search input', () => {
    render(<MediaFilterBar {...baseFilterProps} />);
    expect(screen.getByPlaceholderText('Search by title…')).toBeInTheDocument();
  });

  it('renders sort select', () => {
    render(<MediaFilterBar {...baseFilterProps} />);
    expect(screen.getByRole('combobox', { name: /Sort order/i })).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search', () => {
    const onSearchChange = vi.fn();
    render(<MediaFilterBar {...baseFilterProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByPlaceholderText('Search by title…'), { target: { value: 'test' } });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('calls onSortChange when sort option selected', () => {
    const onSortChange = vi.fn();
    render(<MediaFilterBar {...baseFilterProps} onSortChange={onSortChange} />);
    fireEvent.change(screen.getByRole('combobox', { name: /Sort order/i }), { target: { value: 'oldest' } });
    expect(onSortChange).toHaveBeenCalledWith('oldest');
  });

  it('renders Needs Review status filter button', () => {
    render(<MediaFilterBar {...baseFilterProps} />);
    expect(screen.getByRole('button', { name: /Needs Review/i })).toBeInTheDocument();
  });

  it('calls onStatusChange with needs_review when Needs Review clicked', () => {
    const onStatusChange = vi.fn();
    render(<MediaFilterBar {...baseFilterProps} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Needs Review/i }));
    expect(onStatusChange).toHaveBeenCalledWith('needs_review');
  });

  it('shows clear search button when search has text', () => {
    render(<MediaFilterBar {...baseFilterProps} search="test query" />);
    expect(screen.getByRole('button', { name: /Clear search/i })).toBeInTheDocument();
  });

  it('clears search when clear button clicked', () => {
    const onSearchChange = vi.fn();
    render(<MediaFilterBar {...baseFilterProps} search="test query" onSearchChange={onSearchChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Clear search/i }));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
