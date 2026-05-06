-- Allow highlight_clips to exist without a game context (broadcast-level clips,
-- sponsor reels, halftime shows, etc.).  ON DELETE SET NULL replaces the former
-- CASCADE so clips are retained as orphans when a game row is deleted rather
-- than being silently removed.
ALTER TABLE public.highlight_clips
  ALTER COLUMN game_id DROP NOT NULL;

ALTER TABLE public.highlight_clips
  DROP CONSTRAINT IF EXISTS highlight_clips_game_id_fkey;

ALTER TABLE public.highlight_clips
  ADD CONSTRAINT highlight_clips_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE SET NULL;
