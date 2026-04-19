-- Allow watch parties to exist without a specific game (broadcast-wide viewing
-- sessions, offseason events, league announcements, etc.).  ON DELETE SET NULL
-- retains the party room when the associated game row is removed.
ALTER TABLE public.watch_parties
  ALTER COLUMN game_id DROP NOT NULL;

ALTER TABLE public.watch_parties
  DROP CONSTRAINT IF EXISTS watch_parties_game_id_fkey;

ALTER TABLE public.watch_parties
  ADD CONSTRAINT watch_parties_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE SET NULL;
