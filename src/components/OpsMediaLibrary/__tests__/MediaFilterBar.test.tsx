import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaFilterBar } from '../MediaFilterBar';

describe('MediaFilterBar', () => {
  it('renders all status filter buttons', () => {
    render(
      <MediaFilterBar
        statusFilter="all"
        surfaceFilter="all"
        leagueFilter="all"
        onStatusChange={vi.fn()}
        onSurfaceChange={vi.fn()}
        onLeagueChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('renders all surface filter buttons', () => {
    render(
      <MediaFilterBar
        statusFilter="all"
        surfaceFilter="all"
        leagueFilter="all"
        onStatusChange={vi.fn()}
        onSurfaceChange={vi.fn()}
        onLeagueChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText('Store')).toBeInTheDocument();
    expect(screen.getByText('POTG')).toBeInTheDocument();
    expect(screen.getByText('Event')).toBeInTheDocument();
  });

  it('renders league options including "All Leagues"', () => {
    render(
      <MediaFilterBar
        statusFilter="all"
        surfaceFilter="all"
        leagueFilter="all"
        onStatusChange={vi.fn()}
        onSurfaceChange={vi.fn()}
        onLeagueChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText('All Leagues')).toBeInTheDocument();
    expect(screen.getByText('WBL')).toBeInTheDocument();
    expect(screen.getByText('SBBL')).toBeInTheDocument();
    expect(screen.getByText('TGIF')).toBeInTheDocument();
  });

  it('calls onStatusChange when status filter is clicked', () => {
    const onStatusChange = vi.fn();

    render(
      <MediaFilterBar
        statusFilter="all"
        surfaceFilter="all"
        leagueFilter="all"
        onStatusChange={onStatusChange}
        onSurfaceChange={vi.fn()}
        onLeagueChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    const publishedButton = screen.getByText('Published');
    publishedButton.click();

    expect(onStatusChange).toHaveBeenCalledWith('published');
  });

  it('calls onSurfaceChange when surface filter is clicked', () => {
    const onSurfaceChange = vi.fn();

    render(
      <MediaFilterBar
        statusFilter="all"
        surfaceFilter="all"
        leagueFilter="all"
        onStatusChange={vi.fn()}
        onSurfaceChange={onSurfaceChange}
        onLeagueChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    const storeButton = screen.getByText('Store');
    storeButton.click();

    expect(onSurfaceChange).toHaveBeenCalledWith('store');
  });

  it('calls onReset when Reset All button is clicked', () => {
    const onReset = vi.fn();

    render(
      <MediaFilterBar
        statusFilter="published"
        surfaceFilter="store"
        leagueFilter="all"
        onStatusChange={vi.fn()}
        onSurfaceChange={vi.fn()}
        onLeagueChange={vi.fn()}
        onReset={onReset}
      />
    );

    const resetButton = screen.getByText('Reset All');
    resetButton.click();

    expect(onReset).toHaveBeenCalled();
  });

  it('hides Reset All button when no filters are active', () => {
    const { queryByText } = render(
      <MediaFilterBar
        statusFilter="all"
        surfaceFilter="all"
        leagueFilter="all"
        onStatusChange={vi.fn()}
        onSurfaceChange={vi.fn()}
        onLeagueChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(queryByText('Reset All')).not.toBeInTheDocument();
  });

  it('shows Reset All button when filters are active', () => {
    render(
      <MediaFilterBar
        statusFilter="published"
        surfaceFilter="all"
        leagueFilter="all"
        onStatusChange={vi.fn()}
        onSurfaceChange={vi.fn()}
        onLeagueChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText('Reset All')).toBeInTheDocument();
  });

  it('highlights selected status filter button', () => {
    render(
      <MediaFilterBar
        statusFilter="published"
        surfaceFilter="all"
        leagueFilter="all"
        onStatusChange={vi.fn()}
        onSurfaceChange={vi.fn()}
        onLeagueChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    const publishedButton = screen.getByText('Published');
    expect(publishedButton).toHaveClass('bg-success');
  });

  it('disables all buttons when loading', () => {
    render(
      <MediaFilterBar
        statusFilter="all"
        surfaceFilter="all"
        leagueFilter="all"
        onStatusChange={vi.fn()}
        onSurfaceChange={vi.fn()}
        onLeagueChange={vi.fn()}
        onReset={vi.fn()}
        isLoading={true}
      />
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
