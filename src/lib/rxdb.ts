import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { replicateSupabase } from 'rxdb/plugins/replication-supabase';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { createClient } from '@supabase/supabase-js';

// SECURITY: Never fall back to hardcoded credentials.
// All config MUST come from environment variables at build time.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[rxdb] Missing required env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY). ' +
    'Check your .env file and CI secrets.'
  );
}

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

let dbPromise: Promise<RxDatabase> | null = null;

export async function initDB() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const db = await createRxDatabase({
      name: 'sbblhqdb',
      storage: getRxStorageDexie()
    });

  await db.addCollections({
    leagues: {
      schema: {
        title: 'leagues schema',
        version: 0,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          name: { type: 'string' },
          _deleted: { type: 'boolean' },
          _modified: { type: 'string' }
        },
        required: ['id']
      }
    },
    teams: {
      schema: {
        title: 'teams schema',
        version: 0,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          name: { type: 'string' },
          league_id: { type: 'string' },
          _deleted: { type: 'boolean' },
          _modified: { type: 'string' }
        },
        required: ['id']
      }
    },
    games: {
      schema: {
        title: 'games schema',
        version: 0,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          home_team_id: { type: 'string' },
          away_team_id: { type: 'string' },
          status: { type: 'string' },
          _deleted: { type: 'boolean' },
          _modified: { type: 'string' }
        },
        required: ['id']
      }
    },
    ops_queue: {
      schema: {
        title: 'ops queue schema',
        version: 0,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          type: { type: 'string' },
          payload: { type: 'object' },
          status: { type: 'string' },
          attempts: { type: 'number' },
          created_at: { type: 'string' },
          error_message: { type: 'string' }
        },
        required: ['id', 'type', 'payload', 'status', 'attempts']
      }
    }
  });

  replicateSupabase({
    replicationIdentifier: 'supabase_leagues_rep',
    client: supabaseClient,
    collection: db.leagues,
    tableName: 'leagues',
    pull: {},
    push: {},
  });

  replicateSupabase({
    replicationIdentifier: 'supabase_teams_rep',
    client: supabaseClient,
    collection: db.teams,
    tableName: 'teams',
    pull: {},
    push: {},
  });

  replicateSupabase({
    replicationIdentifier: 'supabase_games_rep',
    client: supabaseClient,
    collection: db.games,
    tableName: 'games',
    pull: {},
    push: {},
  });

  return db;
  })();
  return dbPromise;
}
