import { describe, expect, it } from 'vitest';
import { parseFinalizeStatsPayload } from '@/lib/validators/stats';

describe('stats validator', () => {
  it('accepts valid payload', () => {
    const result = parseFinalizeStatsPayload({
      gameId: '9b95b34e-9b80-49f2-8354-cf97302cffd3',
      rows: [{
        playerId: '5e88ebff-61f5-4c61-9b0e-b74a6bbec5c9',
        pts: 10,
        reb: 2,
        ast: 3,
        stl: 1,
        blk: 0,
        fls: 2,
        min: 31,
      }],
    });

    expect(result.rows[0].pts).toBe(10);
  });

  it('rejects negative stats', () => {
    expect(() => parseFinalizeStatsPayload({
      gameId: '9b95b34e-9b80-49f2-8354-cf97302cffd3',
      rows: [{
        playerId: '5e88ebff-61f5-4c61-9b0e-b74a6bbec5c9',
        pts: -1,
        reb: 2,
        ast: 3,
        stl: 1,
        blk: 0,
        fls: 2,
        min: 31,
      }],
    })).toThrow();
  });
});
