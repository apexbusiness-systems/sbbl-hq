import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaCard } from '../MediaCard';
import type { OpsMediaPublication } from '@/lib/api/ops';

const mockPublication: OpsMediaPublication = {
  id: 'test-id',
  mediaAssetId: 'asset-id',
  surface: 'store',
  title: 'Test Media',
  subtitle: null,
  status: 'published',
  publishedAt: '2024-05-01T00:00:00Z',
  scheduledAt: null,
  sortAt: null,
  sortOrder: null,
  leagueId: 'wbl',
  leagueCode: 'WBL',
  leagueName: 'Weekend Basketball League',
  type: 'image',
  thumbnail: '/test.jpg',
  createdAt: '2024-05-01T00:00:00Z',
  pinnedAt: null,
  needsReview: false,
  parserConfidence: null,
};

const defaultProps = {
  publication: mockPublication,
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

describe('MediaCard', () => {
  it('renders media title', () => {
    render(<MediaCard {...defaultProps} />);
    expect(screen.getByText('Test Media')).toBeInTheDocument();
  });

  it('renders league badge for league-associated media', () => {
    render(<MediaCard {...defaultProps} />);
    expect(screen.getByText('WBL')).toBeInTheDocument();
  });

  it('renders status badge with correct styling', () => {
    render(<MediaCard {...defaultProps} />);
    expect(screen.getByText('published')).toBeInTheDocument();
  });

  it('shows restore button for archived item (not a disabled archive button)', () => {
    const archivedMedia: OpsMediaPublication = { ...mockPublication, status: 'archived' };
    render(<MediaCard {...defaultProps} publication={archivedMedia} />);
    // Archived items show Restore, not a disabled Archive button
    const restoreButton = screen.getByRole('button', { name: /Restore "Test Media"/i });
    expect(restoreButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Archive "Test Media"/i })).not.toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn();
    render(<MediaCard {...defaultProps} onEdit={onEdit} />);
    const buttons = screen.getAllByRole('button');
    const editButton = buttons.find((btn) => btn.getAttribute('aria-label')?.includes('Edit'));
    editButton?.click();
    expect(onEdit).toHaveBeenCalled();
  });

  it('renders untitled when title is empty', () => {
    const untitledMedia: OpsMediaPublication = { ...mockPublication, title: '' };
    render(<MediaCard {...defaultProps} publication={untitledMedia} />);
    expect(screen.getByText('(untitled)')).toBeInTheDocument();
  });

  it('shows drag handle in drag mode', () => {
    render(<MediaCard {...defaultProps} isDragMode={true} />);
    expect(screen.getByRole('button', { name: /Drag to reorder/i })).toBeInTheDocument();
  });

  it('hides drag handle when not in drag mode', () => {
    render(<MediaCard {...defaultProps} isDragMode={false} />);
    expect(screen.queryByRole('button', { name: /Drag to reorder/i })).not.toBeInTheDocument();
  });

  it('disables all buttons when editsDisabled is true', () => {
    render(<MediaCard {...defaultProps} editsDisabled={true} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      if (btn.getAttribute('aria-label') !== 'Close') {
        expect(btn).toBeDisabled();
      }
    });
  });
});
