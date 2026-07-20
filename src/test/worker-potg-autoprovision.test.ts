// Regression shield (2026-07-20, owner directive): the POTG pipeline is
// parser-first again — unknown players are auto-registered (profile + player,
// team linked by name when it resolves), never 409'd. Every provisioning is
// auditable; the pre-ingest ordering that prevented the 2026-04-18
// half-written-rows incident is preserved.
import { describe, expect, it } from 'vitest';
import { resolvePotgPlayer } from '@/worker/index';
import { createAdmin, type Row } from './broadcast-test-utils';

const LEAGUE = 'aaaaaaaa-1111-4111-8111-111111111111';
const ADMIN = 'bbbbbbbb-2222-4222-8222-222222222222';

describe('resolvePotgPlayer — auto-provisioning', () => {
  it('auto-creates profile + player for an unknown name and links the team', async () => {
    const state: Record<string, Row[]> = {
      profiles: [], players: [],
      teams: [{ id: 'team-1', league_id: LEAGUE, name: 'Mantiku' }],
    };
    const res = await resolvePotgPlayer(createAdmin(state), 'Jaime Phillips', LEAGUE, { teamName: 'MANTIKU', actorId: ADMIN });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.provisioned).toBe(true);
      expect(res.warnings).toEqual([]);
    }
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0].display_name).toBe('Jaime Phillips');
    expect(state.players).toHaveLength(1);
    expect(state.players[0].team_id).toBe('team-1');
    expect(state.players[0].league_id).toBe(LEAGUE);
    expect(state.players[0].created_by).toBe(ADMIN);
  });

  it('reuses an existing profile and only creates the player row', async () => {
    const state: Record<string, Row[]> = {
      profiles: [{ id: 'p1', user_id: 'user-9', display_name: 'jaime phillips' }],
      players: [], teams: [],
    };
    const res = await resolvePotgPlayer(createAdmin(state), 'Jaime Phillips', LEAGUE, { actorId: ADMIN });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.userId).toBe('user-9');
    expect(state.profiles).toHaveLength(1);
    expect(state.players).toHaveLength(1);
  });

  it('proceeds with a warning instead of blocking on league mismatch', async () => {
    const state: Record<string, Row[]> = {
      profiles: [{ id: 'p1', user_id: 'user-9', display_name: 'Jaime Phillips' }],
      players: [{ id: 'pl-1', user_id: 'user-9', league_id: 'other-league' }],
    };
    const res = await resolvePotgPlayer(createAdmin(state), 'Jaime Phillips', LEAGUE, {});
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.playerId).toBe('pl-1');
      expect(res.provisioned).toBe(false);
      expect(res.warnings).toContain('potg_player_league_mismatch');
    }
  });

  it('flags unresolved team names but still registers the player', async () => {
    const state: Record<string, Row[]> = { profiles: [], players: [], teams: [] };
    const res = await resolvePotgPlayer(createAdmin(state), 'New Player', LEAGUE, { teamName: 'Ghost Team' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.warnings).toContain('potg_team_not_resolved');
    expect(state.players[0].team_id).toBeNull();
  });

  it('still rejects empty player names', async () => {
    const res = await resolvePotgPlayer(createAdmin({ profiles: [], players: [] }), '   ', LEAGUE, {});
    expect(res).toMatchObject({ ok: false, error: 'potg_player_name_required' });
  });
});
