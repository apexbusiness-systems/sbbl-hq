import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(__dirname, '../../supabase/migrations/20260508000100_shadow_event_core.sql');
const sql = readFileSync(migrationPath, 'utf-8');

describe('shadow event core migration', () => {
  it('adds required feature flags defaulted off', () => {
    for (const flag of [
      'shadow_event_ledger',
      'shadow_game_projection',
      'broadcast_overlay_v2',
      'sponsor_analytics_v2',
      'entitlement_tokens_v2',
    ]) {
      expect(sql).toContain(`'${flag}', false`);
    }
  });

  it('creates all required shadow tables without replacing canonical tables', () => {
    for (const table of [
      'game_event_ledger',
      'game_projection_current',
      'standings_projection',
      'career_stat_projection',
      'broadcast_markers',
      'sponsor_exposures',
      'webhook_inbox',
      'shadow_projection_reconciliation',
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
    expect(sql).not.toMatch(/drop table\s+public\.(games|player_game_stats|team_game_stats|stream_entitlements|streams)/i);
  });

  it('captures ledger idempotency, ordering, supersede, and void metadata', () => {
    expect(sql).toContain('sequence bigint not null');
    expect(sql).toContain('revision bigint not null');
    expect(sql).toContain('idempotency_key text not null');
    expect(sql).toContain('supersedes_event_id uuid references public.game_event_ledger(id)');
    expect(sql).toContain('voided_at timestamptz');
    expect(sql).toContain('unique (game_id, idempotency_key)');
  });

  it('enables RLS on every new data table and blocks client writes for projections/inbox', () => {
    for (const table of [
      'game_event_ledger',
      'game_projection_current',
      'standings_projection',
      'career_stat_projection',
      'broadcast_markers',
      'sponsor_exposures',
      'webhook_inbox',
      'shadow_projection_reconciliation',
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain('game_projection_current_no_client_write');
    expect(sql).toContain('webhook_inbox_no_client_write');
  });

  it('adds first-party sponsor report view and webhook dedupe keys', () => {
    expect(sql).toContain('create or replace view public.sponsor_exposure_report_v2');
    expect(sql).toContain('unique (provider, event_id)');
    expect(sql).toContain('unique (provider, object_id, event_type, idempotency_key)');
  });
});
