import { performance } from 'perf_hooks';

// Mocking the Supabase-like interface
const mockAdmin = {
  from: (table: string) => ({
    insert: async (data: any) => {
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 5));
      return { error: null };
    },
    upsert: async (data: any, options?: any) => {
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 5));
      return { error: null };
    }
  }),
  rpc: async (name: string, params: any) => {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 2));
    return { error: null };
  }
};

const rows = Array.from({ length: 500 }, (_, i) => ({
  league_id: 'league_1',
  season_id: 'season_1',
  name: `Team ${i}`,
  user_id: `user_${i}`
}));

async function iterativeImport(kind: string, rows: any[]) {
  let insertedRows = 0;
  for (const row of rows) {
    try {
      if (kind === "teams") {
        await mockAdmin.from("teams").insert({
          league_id: row.league_id,
          season_id: row.season_id,
          name: row.name,
          status: "published",
        });
      }
      await mockAdmin.rpc("enqueue_local_domain_event", {});
      insertedRows += 1;
    } catch (error) {
      // ignore
    }
  }
  return insertedRows;
}

async function batchedImport(kind: string, rows: any[]) {
  let insertedRows = 0;
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    if (kind === "teams") {
      const payload = batch.map(row => ({
        league_id: row.league_id,
        season_id: row.season_id,
        name: row.name,
        status: "published",
      }));
      await mockAdmin.from("teams").insert(payload);
    }

    await Promise.all(batch.map(() => mockAdmin.rpc("enqueue_local_domain_event", {})));
    insertedRows += batch.length;
  }
  return insertedRows;
}

async function runBenchmark() {
  console.log("Starting benchmark with 500 rows...");

  let start = performance.now();
  await iterativeImport("teams", rows);
  const iterativeTime = performance.now() - start;
  console.log(`Iterative Import: ${iterativeTime.toFixed(2)} ms`);

  start = performance.now();
  await batchedImport("teams", rows);
  const batchedTime = performance.now() - start;
  console.log(`Batched Import (Batch size 50): ${batchedTime.toFixed(2)} ms`);

  console.log(`Improvement: ${(iterativeTime / batchedTime).toFixed(2)}x faster`);
}

runBenchmark();
