import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { replicateSupabase } from 'rxdb/plugins/replication-supabase';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ezanilxygnpucwkwpsoc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5uIVxDWuaI916HXVN9Mb8A_jhrYLPYz';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

export async function initDB() {
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
    }
  });

  // Example replication setup
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
}
