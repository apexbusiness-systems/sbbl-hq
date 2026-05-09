import { describe, expect, it, vi } from 'vitest';
import { handlePublicPollResults } from '../worker/routes/engagement';
import { createTestCtx } from './worker-test-utils';

describe('handlePublicPollResults optimization', () => {
  it('correctly uses get_poll_tallies RPC and calculates total', async () => {
    const pollId = '00000000-0000-0000-0000-000000000001';
    const mockPoll = {
      id: pollId,
      question: 'Who will win?',
      options: [{ id: 'opt_1', label: 'Team A' }, { id: 'opt_2', label: 'Team B' }],
      status: 'open'
    };
    const mockTallies = [
      { option_id: 'opt_1', vote_count: 150 },
      { option_id: 'opt_2', vote_count: 50 }
    ];

    const ctx = createTestCtx({
      params: { id: pollId }
    });

    // Mock the admin client methods
    const maybeSingle = vi.fn().mockResolvedValue({ data: mockPoll, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: mockTallies, error: null });

    ctx.admin.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle
    }) as any;

    ctx.admin.rpc = rpc as any;

    const response = await handlePublicPollResults(ctx);
    const body = await response.json() as any;

    expect(body.ok).toBe(true);
    expect(body.poll.id).toBe(pollId);
    expect(body.tallies).toEqual({
      opt_1: 150,
      opt_2: 50
    });
    expect(body.total_votes).toBe(200);

    // Verify RPC was called with correct pollId
    expect(rpc).toHaveBeenCalledWith('get_poll_tallies', { p_poll_id: pollId });
  });

  it('handles empty results from RPC', async () => {
    const pollId = '00000000-0000-0000-0000-000000000001';
    const ctx = createTestCtx({ params: { id: pollId } });

    ctx.admin.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: pollId }, error: null })
    }) as any;

    ctx.admin.rpc = vi.fn().mockResolvedValue({ data: null, error: null }) as any;

    const response = await handlePublicPollResults(ctx);
    const body = await response.json() as any;

    expect(body.ok).toBe(true);
    expect(body.tallies).toEqual({});
    expect(body.total_votes).toBe(0);
  });
});
