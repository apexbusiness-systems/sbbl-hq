import { describe, expect, it } from 'vitest';

function mockRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    league_id: 'league-1',
    season_id: 'season-1',
    name: `Team ${i}`,
  }));
}

describe('Ops Import Fallback Benchmark', () => {
  it('measures iterative vs batched fallback performance', async () => {
    const rows = mockRows(500); // simulate 500 row import

    // Simulation of existing iterative fallback
    const startIterative = performance.now();
    let insertedRowsIter = 0;
    let failedRowsIter = 0;
    for (const row of rows) {
      try {
        // simulate a db call
        await new Promise((resolve) => setTimeout(resolve, 1));
        insertedRowsIter++;
      } catch (e) {
        failedRowsIter++;
      }
    }
    const endIterative = performance.now();
    const iterativeTime = endIterative - startIterative;


    // Proposed batched fallback using Promise.allSettled
    const startBatched = performance.now();
    let insertedRowsBatched = 0;
    let failedRowsBatched = 0;

    // Batch size of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (row) => {
           // simulate a db call
           await new Promise((resolve) => setTimeout(resolve, 1));
           return true;
        })
      );

      for (const result of results) {
         if (result.status === 'fulfilled') {
            insertedRowsBatched++;
         } else {
            failedRowsBatched++;
         }
      }
    }
    const endBatched = performance.now();
    const batchedTime = endBatched - startBatched;

    console.log(`Iterative Time: ${iterativeTime}ms`);
    console.log(`Batched Time: ${batchedTime}ms`);
    expect(batchedTime).toBeLessThan(iterativeTime);
  });
});
