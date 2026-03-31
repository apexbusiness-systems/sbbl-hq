import { describe, expect, it } from 'vitest';
import { mapTeamDirectoryRow } from '@/lib/teams/directory';

describe('team directory mapping', () => {
  it('preserves league code for downstream filtering and badges', () => {
    const card = mapTeamDirectoryRow({
      id: 'team-1',
      name: 'WBL Warriors',
      leagues: { code: 'wbl', name: 'Weekend Basketball League' },
      seasons: { name: 'Spring 2026' },
      divisions: { name: 'Open' },
      team_memberships: [{ id: 'm1' }, { id: 'm2' }],
    });

    expect(card).toEqual({
      id: 'team-1',
      name: 'WBL Warriors',
      league_code: 'WBL',
      league_name: 'Weekend Basketball League',
      season_name: 'Spring 2026',
      division_name: 'Open',
      roster_count: 2,
    });
  });
});
