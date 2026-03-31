import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('migration smoke', () => {
  it('contains critical tables and RPCs', () => {
    const sql = readFileSync('supabase/migrations/202603270001_core_schema.sql', 'utf8');
    const idempotencySql = readFileSync('supabase/migrations/202603270002_worker_idempotency.sql', 'utf8');
    const authFixSql = readFileSync('supabase/migrations/202603310001_auth_storage_import_fixes.sql', 'utf8');
    expect(sql).toContain('create table if not exists public.profiles');
    expect(sql).toContain('create table if not exists public.games');
    expect(sql).toContain('create or replace function public.finalize_game_stats');
    expect(sql).toContain('create or replace function public.create_stream_entitlement');
    expect(idempotencySql).toContain('create table if not exists public.api_idempotency_keys');
    expect(authFixSql).toContain("policyname = 'profiles_self_insert'");
    expect(authFixSql).toContain('create policy profiles_self_insert on public.profiles');
    expect(authFixSql).toContain("policyname = 'user_role_assignments_self_read'");
    expect(authFixSql).toContain('create policy user_role_assignments_self_read on public.user_role_assignments');
    expect(authFixSql).toContain("values ('media', 'media', true)");
    expect(authFixSql).toContain('create policy media_avatar_insert on storage.objects');
    expect(authFixSql).toContain('create policy media_avatar_select on storage.objects');
    expect(authFixSql).toContain('create policy store_products_ops_insert on storage.objects');
    expect(authFixSql).toContain('create policy store_products_ops_select on storage.objects');
  });
});
