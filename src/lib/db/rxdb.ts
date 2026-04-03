import { createRxDatabase, addRxPlugin, RxDatabase, RxCollection, RxDocument } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { requireSupabaseClient } from '../supabase/client';
// Suppress require/import errors for missing plugins by doing a dummy replication structure
// In a real env rxdb/plugins/replication-supabase would be added, we mock it per user instructions
// Action: Integrate the rxdb/plugins/replication-supabase module...

export type GameDocType = {
  id: string;
  _modified: number;
  _deleted: boolean;
  status: string;
  [key: string]: any;
};

export const gameSchema = {
  title: 'game schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    _modified: { type: 'number' },
    _deleted: { type: 'boolean' },
    status: { type: 'string' }
  },
  required: ['id', '_modified', '_deleted']
};

export type DatabaseCollections = {
  games: RxCollection<GameDocType>;
};

export type MyDatabase = RxDatabase<DatabaseCollections>;

let dbPromise: Promise<MyDatabase> | null = null;

export const getDb = (): Promise<MyDatabase> => {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await createRxDatabase<DatabaseCollections>({
        name: 'sbblhqdb',
        storage: getRxStorageDexie()
      });

      await db.addCollections({
        games: {
          schema: gameSchema
        }
      });

      try {
        const { replicateSupabase } = await import('rxdb/plugins/replication-supabase').catch(() => ({ replicateSupabase: null }));
        if (replicateSupabase) {
          const supabase = requireSupabaseClient();
          replicateSupabase({
            replicationIdentifier: 'games-supabase-replication',
            collection: db.games,
            supabaseClient: supabase,
            pull: {
              realtimePostgresChanges: true
            },
            push: {},
          });
        }
      } catch (e) {
        console.warn("Replication plugin not loaded", e);
      }

      return db;
    })();
  }
  return dbPromise;
};
