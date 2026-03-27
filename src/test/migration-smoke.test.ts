import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('migration smoke', () => {
  it('contains critical tables and RPCs', () => {
    const sql = readFileSync('supabase/migrations/202603270001_core_schema.sql', 'utf8');
    expect(sql).toContain('create table if not exists public.profiles');
    expect(sql).toContain('create table if not exists public.games');
    expect(sql).toContain('create or replace function public.finalize_game_stats');
    expect(sql).toContain('create or replace function public.create_stream_entitlement');
  });
});
