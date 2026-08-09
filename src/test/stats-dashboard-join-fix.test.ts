import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(__dirname, '../../supabase/migrations');

describe('stats join contract — player_game_stats joins on players.id, not user_id', () => {
  it('ensures RPC migrations do not join pgs.player_id on p.user_id', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    
    for (const file of files) {
      const rawSql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      // Strip all SQL comments (full line or inline trailing comments).
      // Split on /\r?\n/, NOT '\n': with core.autocrlf=true every line keeps a
      // trailing '\r', and `/--.*$/` cannot match it — `.` never consumes a line
      // terminator and `$` (no `m` flag) only anchors at end of input. The
      // comment therefore survived stripping, and the guard below false-failed
      // on the *documentation* of the old join in 20260731060000. Green on
      // Linux CI, red on every Windows checkout.
      const codeOnlySql = rawSql
        .split(/\r?\n/)
        .map((line) => line.replace(/--.*$/, ''))
        .join('\n');
      
      // We must not have join conditions matching `p.user_id = pgs.player_id` or `pgs.player_id = p.user_id`
      expect(codeOnlySql, `Migration ${file} contains illegal join p.user_id = pgs.player_id`).not.toMatch(/p\.user_id\s*=\s*pgs\.player_id/i);
      expect(codeOnlySql, `Migration ${file} contains illegal join pgs.player_id = p.user_id`).not.toMatch(/pgs\.player_id\s*=\s*p\.user_id/i);
    }
  });

  it('verifies 20260801000000_fix_player_game_stats_rpc_join_condition.sql uses p.id = pgs.player_id', () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, '20260801000000_fix_player_game_stats_rpc_join_condition.sql'), 'utf8');
    expect(sql).toMatch(/(?:pgs\.player_id\s*=\s*p\.id|p\.id\s*=\s*pgs\.player_id)/i);
  });
});
