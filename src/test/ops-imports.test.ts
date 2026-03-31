import { describe, expect, it } from 'vitest';
import {
  findLeagueReference,
  firstNonEmptyValue,
} from '@/lib/imports/ops-imports';

describe('ops import helpers', () => {
  const leagues = [
    { id: '72ba2e09-302d-4bf4-8ebc-f895fb896b5f', code: 'SBBL', name: "Sunday's Best Basketball League" },
    { id: 'cb773203-03b4-4f75-8eff-a1b46ad7f9df', code: 'WBL', name: 'Weekend Basketball League' },
    { id: '15dec6d4-ea7d-4d78-a0cf-2fb3f70e2903', code: 'TGIFBL', name: "Thank God It's Friday Basketball League" },
  ];

  it('maps app slugs and codes to real league references', () => {
    expect(findLeagueReference(leagues, 'wbl')?.id).toBe('cb773203-03b4-4f75-8eff-a1b46ad7f9df');
    expect(findLeagueReference(leagues, 'SBBL')?.id).toBe('72ba2e09-302d-4bf4-8ebc-f895fb896b5f');
    expect(findLeagueReference(leagues, 'tgif')?.id).toBe('15dec6d4-ea7d-4d78-a0cf-2fb3f70e2903');
  });

  it('matches league names case-insensitively', () => {
    expect(findLeagueReference(leagues, 'weekend basketball league')?.code).toBe('WBL');
  });

  it('returns the first populated trimmed value from a row', () => {
    expect(firstNonEmptyValue({
      league_id: '   ',
      league_code: ' WBL ',
      league: 'ignored',
    }, ['league_id', 'league_code', 'league'])).toBe('WBL');
  });
});
