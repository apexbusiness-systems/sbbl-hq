-- Phase 4: Local-First Synchronization

-- Add required columns for RxDB replication
ALTER TABLE games
ADD COLUMN IF NOT EXISTS _modified bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
ADD COLUMN IF NOT EXISTS _deleted boolean DEFAULT false NOT NULL;

-- Create trigger to automatically update _modified
CREATE OR REPLACE FUNCTION rxdb_update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW._modified = (extract(epoch from now()) * 1000)::bigint;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_games_rxdb_modified ON games;
CREATE TRIGGER trigger_games_rxdb_modified
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION rxdb_update_modified_column();

-- Enable Realtime for games (if not already enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'games'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE games;
    END IF;
END
$$;
