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
};

describe('MediaCard', () => {
  it('renders media title', () => {
    render(
      <MediaCard
        publication={mockPublication}
        isEditing={false}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onPreview={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp={true}
        canMoveDown={true}
        isLoading={false}
        editsDisabled={false}
      />
    );

    expect(screen.getByText('Test Media')).toBeInTheDocument();
  });

  it('renders league badge for league-associated media', () => {
    render(
      <MediaCard
        publication={mockPublication}
        isEditing={false}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onPreview={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp={true}
        canMoveDown={true}
        isLoading={false}
        editsDisabled={false}
      />
    );

    expect(screen.getByText('WBL')).toBeInTheDocument();
  });

  it('renders status badge with correct styling', () => {
    render(
      <MediaCard
        publication={mockPublication}
        isEditing={false}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onPreview={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp={true}
        canMoveDown={true}
        isLoading={false}
        editsDisabled={false}
      />
    );

    expect(screen.getByText('published')).toBeInTheDocument();
  });

  it('disables archive button when status is archived', () => {
    const archivedMedia: OpsMediaPublication = {
      ...mockPublication,
      status: 'archived',
    };

    render(
      <MediaCard
        publication={archivedMedia}
        isEditing={false}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onPreview={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp={true}
        canMoveDown={true}
        isLoading={false}
        editsDisabled={false}
      />
    );

    const buttons = screen.getAllByRole('button');
    const archiveButton = buttons.find((btn) => btn.getAttribute('aria-label')?.includes('Archive'));
    expect(archiveButton).toBeDisabled();
  });

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn();

    render(
      <MediaCard
        publication={mockPublication}
        isEditing={false}
        onEdit={onEdit}
        onArchive={vi.fn()}
        onPreview={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp={true}
        canMoveDown={true}
        isLoading={false}
        editsDisabled={false}
      />
    );

    const buttons = screen.getAllByRole('button');
    const editButton = buttons.find((btn) => btn.getAttribute('aria-label')?.includes('Edit'));
    editButton?.click();

    expect(onEdit).toHaveBeenCalled();
  });

  it('renders untitled when title is empty', () => {
    const untitledMedia: OpsMediaPublication = {
      ...mockPublication,
      title: '',
    };

    render(
      <MediaCard
        publication={untitledMedia}
        isEditing={false}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onPreview={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp={true}
        canMoveDown={true}
        isLoading={false}
        editsDisabled={false}
      />
    );

    expect(screen.getByText('(untitled)')).toBeInTheDocument();
  });

  it('disables move up button when canMoveUp is false', () => {
    render(
      <MediaCard
        publication={mockPublication}
        isEditing={false}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onPreview={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp={false}
        canMoveDown={true}
        isLoading={false}
        editsDisabled={false}
      />
    );

    const buttons = screen.getAllByRole('button');
    const moveUpButton = buttons.find((btn) => btn.getAttribute('aria-label')?.includes('Move') && btn.getAttribute('aria-label')?.includes('up'));
    expect(moveUpButton).toBeDisabled();
  });

  it('disables all buttons when editsDisabled is true', () => {
    render(
      <MediaCard
        publication={mockPublication}
        isEditing={false}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onPreview={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp={true}
        canMoveDown={true}
        isLoading={false}
        editsDisabled={true}
      />
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      if (btn.getAttribute('aria-label') !== 'Close') {
        expect(btn).toBeDisabled();
      }
    });
  });
});
