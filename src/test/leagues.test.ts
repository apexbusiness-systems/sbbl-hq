import { describe, expect, it } from 'vitest';
import { getLeagueConfig, leagueIdFromCode, leagueCodeFromId, LEAGUE_CONFIGS } from '@/lib/leagues';

describe('canonical league model', () => {
  it('returns correct config for each league id', () => {
    expect(getLeagueConfig('sbbl').code).toBe('SBBL');
    expect(getLeagueConfig('wbl').code).toBe('WBL');
    expect(getLeagueConfig('tgifbl').code).toBe('TGIFBL');
  });

  it('maps league codes to ids', () => {
    expect(leagueIdFromCode('SBBL')).toBe('sbbl');
    expect(leagueIdFromCode('WBL')).toBe('wbl');
    expect(leagueIdFromCode('TGIFBL')).toBe('tgifbl');
    expect(leagueIdFromCode('sbbl')).toBe('sbbl');
  });

  it('falls back to sbbl for unknown codes', () => {
    expect(leagueIdFromCode('UNKNOWN')).toBe('sbbl');
  });

  it('maps league ids to codes', () => {
    expect(leagueCodeFromId('sbbl')).toBe('SBBL');
    expect(leagueCodeFromId('wbl')).toBe('WBL');
    expect(leagueCodeFromId('tgifbl')).toBe('TGIFBL');
  });

  it('has exactly 3 league configs', () => {
    expect(LEAGUE_CONFIGS).toHaveLength(3);
  });
});
