/**
 * Static verification that migration 20260417140000_broadcast_integration.sql
 * carries every section the broadcast-integration rollout requires:
 *   1. Realtime publication adds for games / overlay_game_state / stream_chat_messages
 *   2. Lower-third auto-fire trigger (INSERT on player_game_stats, pts >= 25)
 *   3. highlight_clips table + RLS (public read, admin write)
 *   4. Auto-highlight-on-score trigger (UPDATE on overlay_game_state)
 *   5. get_reaction_aggregate RPC + GRANT EXECUTE
 *
 * Also guards against coupling the new code to the stream independence
 * contract (no NOT NULL game_id on streams etc.).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../supabase/migrations/20260417140000_broadcast_integration.sql',
);
const sql = readFileSync(migrationPath, 'utf-8');

describe('broadcast integration migration — structure', () => {
  it('dated 2026-04-17 in the header', () => {
    expect(sql).toMatch(/Date:\s*2026-04-17/);
  });

  it('asserts Broadcast Platform ownership', () => {
    expect(sql).toMatch(/Owner:\s*Broadcast Platform/);
  });
});

describe('1. realtime publication', () => {
  it('adds games, overlay_game_state, stream_chat_messages', () => {
    for (const table of ['games', 'overlay_game_state', 'stream_chat_messages']) {
      expect(sql).toContain(`ADD TABLE public.${table}`);
    }
  });

  it('is idempotent via pg_publication_tables guard', () => {
    expect(sql).toContain('pg_publication_tables');
    expect(sql).toContain('IF NOT EXISTS');
    // Must use DO $$ ... END $$ — ALTER PUBLICATION cannot use IF NOT EXISTS natively.
    const doBlocks = sql.match(/DO \$\$/g) ?? [];
    expect(doBlocks.length).toBeGreaterThanOrEqual(3);
  });
});

describe('2. lower-third auto-fire trigger', () => {
  it('creates function + trigger on player_game_stats INSERT', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.auto_fire_lower_third\(\)/,
    );
    expect(sql).toContain(
      'CREATE TRIGGER trg_auto_fire_lower_third',
    );
    expect(sql).toMatch(/AFTER INSERT ON public\.player_game_stats/);
  });

  it('gates on pts >= 25', () => {
    expect(sql).toMatch(/NEW\.pts\s*<\s*25/);
  });

  it('tolerates both live-status spellings', () => {
    expect(sql).toContain("'live'");
    expect(sql).toContain("'in_progress'");
  });

  it('builds the subtext from PTS/REB/AST', () => {
    expect(sql).toContain("' PTS · '");
    expect(sql).toContain("' REB · '");
    expect(sql).toContain("' AST'");
  });

  it('wraps mutation in exception handler so stat-keeper writes never fail', () => {
    // EXCEPTION … RETURN NEW, tolerating inline comments between the lines.
    expect(sql).toMatch(/EXCEPTION WHEN OTHERS THEN[\s\S]*?RETURN NEW/);
  });
});

describe('3. highlight_clips table', () => {
  it('declares the table with required columns', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.highlight_clips');
    for (const col of [
      'game_id',
      'kind',
      'period',
      'clock_seconds',
      'home_score',
      'away_score',
      'player_id',
      'title',
      'description',
      'media_url',
      'thumbnail_url',
      'occurred_at',
      'created_by',
    ]) {
      expect(sql).toContain(col);
    }
  });

  it('constrains kind to the allowed set', () => {
    expect(sql).toMatch(
      /kind\s+text[\s\S]*CHECK \(kind IN \('manual','auto_score','auto_cheer'\)\)/,
    );
  });

  it('enables RLS with public read + admin write', () => {
    expect(sql).toContain(
      'ALTER TABLE public.highlight_clips ENABLE ROW LEVEL SECURITY',
    );
    expect(sql).toContain('highlight_clips_read_all');
    expect(sql).toContain('highlight_clips_admin_write');
    for (const role of [
      'super_admin',
      'league_admin',
      'media_operator',
      'team_manager',
    ]) {
      expect(sql).toContain(`'${role}'`);
    }
  });

  it('indexes (game_id, occurred_at DESC) and (kind, occurred_at DESC)', () => {
    expect(sql).toContain('idx_highlight_clips_game_occurred');
    expect(sql).toContain('idx_highlight_clips_kind_occurred');
  });
});

describe('4. auto-highlight on score change trigger', () => {
  it('creates function + trigger on overlay_game_state UPDATE', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.auto_highlight_on_score\(\)/,
    );
    expect(sql).toMatch(
      /AFTER UPDATE ON public\.overlay_game_state/,
    );
    expect(sql).toContain(
      'NEW.home_score > OLD.home_score OR NEW.away_score > OLD.away_score',
    );
  });

  it('inserts kind = auto_score', () => {
    expect(sql).toContain("'auto_score'");
  });

  it('wraps INSERT in exception handler', () => {
    const fn = sql.slice(sql.indexOf('auto_highlight_on_score'));
    expect(fn).toMatch(/EXCEPTION WHEN OTHERS THEN[\s\S]*?RETURN NEW/);
  });
});

describe('5. reaction aggregate RPC', () => {
  it('declares get_reaction_aggregate(p_game_id uuid, p_window_seconds int)', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_reaction_aggregate\(\s*p_game_id uuid,\s*p_window_seconds int DEFAULT 30\s*\)/,
    );
  });

  it('returns TABLE(reaction_type text, count bigint)', () => {
    expect(sql).toContain('reaction_type text');
    expect(sql).toContain('count         bigint');
  });

  it('groups over the last N seconds', () => {
    expect(sql).toMatch(/now\(\)\s*-\s*\(COALESCE\(p_window_seconds, 30\)/);
    expect(sql).toContain('GROUP BY sr.reaction_type');
  });

  it('grants execute to anon/authenticated/service_role', () => {
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_reaction_aggregate\(uuid, int\)/,
    );
    expect(sql).toContain('anon, authenticated, service_role');
  });
});

// Stream independence contract — migration must NOT re-couple streams/game
// in violation of CLAUDE.md §4.
describe('stream independence contract compliance', () => {
  it('does not NOT-NULL game_id on streams/stream_entitlements/stream_assignments', () => {
    expect(sql).not.toMatch(
      /ALTER TABLE\s+(public\.)?streams[\s\S]*game_id[\s\S]*NOT NULL/i,
    );
    expect(sql).not.toMatch(
      /ALTER TABLE\s+(public\.)?stream_entitlements[\s\S]*game_id[\s\S]*SET NOT NULL/i,
    );
    expect(sql).not.toMatch(
      /ALTER TABLE\s+(public\.)?stream_assignments[\s\S]*game_id[\s\S]*SET NOT NULL/i,
    );
  });
});
