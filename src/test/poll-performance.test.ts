import { describe, it } from 'vitest';

describe('Poll Results Aggregation Benchmark', () => {
  it('baseline: in-memory aggregation of 100k votes', () => {
    const numVotes = 100000;
    const votes = Array.from({ length: numVotes }, (_, i) => ({
      option_id: `opt_${(i % 4) + 1}`
    }));

    const start = performance.now();
    // Simulate JSON stringifying and parsing which happens in worker-supabase boundary
    const raw = JSON.stringify(votes);
    const parsed = JSON.parse(raw) as Array<{ option_id: string }>;

    const tallies: Record<string, number> = {};
    for (const v of parsed) {
      const id = String(v.option_id);
      tallies[id] = (tallies[id] ?? 0) + 1;
    }
    const total = parsed.length;
    const end = performance.now();

    console.log(`BASELINE: In-memory aggregation of ${numVotes} votes took ${(end - start).toFixed(2)}ms`);
    console.log(`Estimated memory for votes array: ~${(raw.length / 1024 / 1024).toFixed(2)} MB`);
  });

  it('optimized: worker-side processing of 4 RPC rows', () => {
    const talliesData = [
      { option_id: 'opt_1', vote_count: 25000 },
      { option_id: 'opt_2', vote_count: 25000 },
      { option_id: 'opt_3', vote_count: 25000 },
      { option_id: 'opt_4', vote_count: 25000 },
    ];

    const start = performance.now();
    const raw = JSON.stringify(talliesData);
    const parsed = JSON.parse(raw) as Array<{ option_id: string; vote_count: number }>;

    const tallies: Record<string, number> = {};
    let total = 0;
    for (const row of parsed) {
      const id = String(row.option_id);
      const count = Number(row.vote_count);
      tallies[id] = count;
      total += count;
    }
    const end = performance.now();

    console.log(`OPTIMIZED: Processing ${talliesData.length} RPC rows took ${(end - start).toFixed(2)}ms`);
    console.log(`Estimated memory for RPC response: ~${(raw.length / 1024).toFixed(2)} KB`);
  });
});
