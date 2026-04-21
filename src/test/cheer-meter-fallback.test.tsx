import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { CheerMeter } from '../components/CheerMeter';
import * as reactionApi from '../lib/api/reactions';

// Mock the API dependency
vi.mock('../lib/api/reactions', () => ({
  fetchReactionAggregate: vi.fn(),
}));

// Mock the Supabase client
vi.mock('../lib/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(),
      })),
    })),
    removeChannel: vi.fn(),
  })),
}));

describe('CheerMeter Fallback Error Path', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('resets to ZERO_COUNTS when fetchReactionAggregate throws an error', async () => {
    vi.mocked(reactionApi.fetchReactionAggregate).mockResolvedValueOnce({
      ok: true,
      data: [
        { reaction_type: 'fire', count: 10 },
        { reaction_type: 'heart', count: 20 },
        { reaction_type: 'clap', count: 30 },
      ] as reactionApi.ReactionAggregate[]
    } as unknown as Awaited<ReturnType<typeof reactionApi.fetchReactionAggregate>>);

    render(<CheerMeter gameId="test-game-123" />);

    // Wait for the initial load to complete.
    await waitFor(() => {
      expect(screen.getByText('10', { selector: 'span.tabular-nums' })).toBeInTheDocument();
    });

    vi.mocked(reactionApi.fetchReactionAggregate).mockRejectedValueOnce(
      new Error('Network failure')
    );

    // Advance by 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30000);
      // Wait for the promise in the interval to settle
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // We only wait for the result here
    await waitFor(() => {
      const counts = screen.getAllByText('0', { selector: 'span.tabular-nums' });
      expect(counts).toHaveLength(3);
    });

    expect(reactionApi.fetchReactionAggregate).toHaveBeenCalledTimes(2);
  });

  it('resets to ZERO_COUNTS when fetchReactionAggregate returns ok: false', async () => {
    vi.mocked(reactionApi.fetchReactionAggregate).mockResolvedValueOnce({
      ok: true,
      data: [
        { reaction_type: 'fire', count: 5 },
        { reaction_type: 'heart', count: 5 },
        { reaction_type: 'clap', count: 5 },
      ] as reactionApi.ReactionAggregate[]
    } as unknown as Awaited<ReturnType<typeof reactionApi.fetchReactionAggregate>>);

    render(<CheerMeter gameId="test-game-123" />);

    await waitFor(() => {
      const initialCounts = screen.getAllByText('5', { selector: 'span.tabular-nums' });
      expect(initialCounts).toHaveLength(3);
    });

    vi.mocked(reactionApi.fetchReactionAggregate).mockResolvedValueOnce({
      ok: false,
      error: 'Not found'
    } as unknown as Awaited<ReturnType<typeof reactionApi.fetchReactionAggregate>>);

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      const finalCounts = screen.getAllByText('0', { selector: 'span.tabular-nums' });
      expect(finalCounts).toHaveLength(3);
    });

    expect(reactionApi.fetchReactionAggregate).toHaveBeenCalledTimes(2);
  });
});
