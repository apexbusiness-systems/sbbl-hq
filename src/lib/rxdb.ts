import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';

// 2026-07-20 hotfix: Supabase replication of leagues/teams/games removed.
// Production tables have no _modified/_deleted replication columns, so every
// pull cycle 400'd (PostgREST 42703) in an endless retry flood the moment the
// VITE_SUPABASE_* build env appeared. The offline CSV queue (the only consumer
// of this module) is purely local (Dexie) and needs no Supabase client — this
// module is now env-independent and can never crash on missing config again.

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




  return db;
  })();
  return dbPromise;
}
