import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';

describe('migration smoke', () => {
  it('contains critical tables and RPCs', () => {
    const sql = readFileSync('supabase/migrations/202603270001_core_schema.sql', 'utf8');
    const idempotencySql = readFileSync('supabase/migrations/202603270002_worker_idempotency.sql', 'utf8');
    expect(sql).toContain('create table if not exists public.profiles');
    expect(sql).toContain('create table if not exists public.games');
    expect(sql).toContain('create or replace function public.finalize_game_stats');
    expect(sql).toContain('create or replace function public.create_stream_entitlement');
    expect(idempotencySql).toContain('create table if not exists public.api_idempotency_keys');
  });
});
