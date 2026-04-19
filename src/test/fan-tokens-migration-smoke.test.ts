/**
 * Migration smoke — structural invariants.
 *
 * Asserts the 20260419100000_fan_token_system.sql migration contains
 * every expected table, constraint, RPC, and seed row. This is a
 * string-level check — it does NOT run SQL. Purpose: catch accidental
 * removal or rename in the migration during future edits.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '20260419100000_fan_token_system.sql',
);

const sql = readFileSync(MIGRATION_PATH, 'utf8');

describe('fan_token_system migration structure', () => {
  it('creates all five core tables', () => {
    expect(sql).toMatch(/create table if not exists public\.fan_token_products/);
    expect(sql).toMatch(/create table if not exists public\.fan_token_wallets/);
    expect(sql).toMatch(/create table if not exists public\.fan_token_transactions/);
    expect(sql).toMatch(/create table if not exists public\.player_token_leaderboard/);
    expect(sql).toMatch(/create table if not exists public\.token_award_categories/);
  });

  it('enforces atomic idempotency via UNIQUE constraints', () => {
    expect(sql).toMatch(/idempotency_key\s+text not null unique/);
    expect(sql).toMatch(/unique \(player_id, game_id, season_id\)/);
  });

  it('enforces non-negative balance at the database level', () => {
    expect(sql).toMatch(/balance\s+int not null default 0 check \(balance >= 0\)/);
  });

  it('defines both atomic RPCs', () => {
    expect(sql).toMatch(/create or replace function public\.award_fan_tokens/);
    expect(sql).toMatch(/create or replace function public\.fulfill_fan_token_purchase/);
  });

  it('seeds the canonical five award categories', () => {
    for (const slug of ['fan_favorite', 'most_hype', 'best_trash_talk', 'clutch_factor', 'most_entertaining']) {
      expect(sql).toMatch(new RegExp(`'${slug}'`));
    }
  });

  it('uses has_any_role() for admin RLS (not get_user_role)', () => {
    expect(sql).toMatch(/has_any_role\(array\['league_admin','super_admin'\]/);
    expect(sql).not.toMatch(/get_user_role/);
  });

  it('keeps game_id nullable on transactions + leaderboard (Stream Independence)', () => {
    // season-only awards and non-game spends must remain expressible
    expect(sql).not.toMatch(/game_id\s+uuid not null/);
  });

  it('indexes the hot leaderboard query paths', () => {
    expect(sql).toMatch(/idx_leaderboard_game_tokens[\s\S]+total_tokens desc/);
    expect(sql).toMatch(/idx_leaderboard_season_tokens[\s\S]+total_tokens desc/);
  });
});
