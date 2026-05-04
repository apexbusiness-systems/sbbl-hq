-- Migration: add_ppv_invite_code_column_and_generator
-- Fixes: B2 — ppv_invites had no human-readable 'code' column; admins could
-- only share a raw UUID. Adds a SBBL-XXXX-XXXX formatted code column with
-- a generator function and a BEFORE INSERT trigger for auto-population.

-- Step 1: Add 'code' column (nullable first — backfill before constraining)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'ppv_invites'
      AND n.nspname = 'public'
      AND a.attname = 'code'
      AND NOT a.attisdropped
  ) THEN
    ALTER TABLE public.ppv_invites ADD COLUMN code text;
  END IF;
END $$;

-- Step 2: Code generator — SBBL-XXXX-XXXX (no ambiguous chars: 0/O, 1/I/L)
CREATE OR REPLACE FUNCTION public.generate_ppv_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_seg1  text := '';
  v_seg2  text := '';
  i       int;
BEGIN
  FOR i IN 1..4 LOOP
    v_seg1 := v_seg1 || substr(v_chars, (floor(random() * length(v_chars)))::int + 1, 1);
    v_seg2 := v_seg2 || substr(v_chars, (floor(random() * length(v_chars)))::int + 1, 1);
  END LOOP;
  RETURN 'SBBL-' || v_seg1 || '-' || v_seg2;
END;
$$;

-- Step 3: Backfill existing rows that have NULL code
UPDATE public.ppv_invites
SET code = public.generate_ppv_code()
WHERE code IS NULL;

-- Step 4: Apply NOT NULL and UNIQUE constraints (safe after backfill)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.ppv_invites ALTER COLUMN code SET NOT NULL;
  EXCEPTION WHEN others THEN NULL; END;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ppv_invites_code_key'
      AND conrelid = 'public.ppv_invites'::regclass
  ) THEN
    ALTER TABLE public.ppv_invites
      ADD CONSTRAINT ppv_invites_code_key UNIQUE (code);
  END IF;
END $$;

-- Step 5: Index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_ppv_invites_code
  ON public.ppv_invites (code);

-- Step 6: Trigger function — auto-generate code if not supplied on INSERT
CREATE OR REPLACE FUNCTION public.trg_ppv_invite_set_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.generate_ppv_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_ppv_invites_set_code ON public.ppv_invites;
CREATE TRIGGER tg_ppv_invites_set_code
BEFORE INSERT ON public.ppv_invites
FOR EACH ROW EXECUTE FUNCTION public.trg_ppv_invite_set_code();
