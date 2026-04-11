-- Stream admin config validation metadata hardening
alter table if exists public.stream_admin_config
  add column if not exists source_type text,
  add column if not exists source_status text not null default 'untested' check (source_status in ('untested','valid','valid_with_warning','invalid')),
  add column if not exists risk_level text check (risk_level in ('low','medium','high')),
  add column if not exists visibility_class text default 'unknown' check (visibility_class in ('private_or_gated','public','unknown')),
  add column if not exists validation_message text,
  add column if not exists last_validated_at timestamptz;
