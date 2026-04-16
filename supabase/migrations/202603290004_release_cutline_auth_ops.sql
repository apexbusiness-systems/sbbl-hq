alter table public.profiles
  add column if not exists preferred_league text,
  add column if not exists primary_role_intent text;

create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_user_role_assignments_user_id on public.user_role_assignments(user_id);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  submitted_by uuid not null,
  payload_summary jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  total_rows int not null default 0,
  inserted_rows int not null default 0,
  failed_rows int not null default 0,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Removed league_events table creation per instruction
