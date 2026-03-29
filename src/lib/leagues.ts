import type { LeagueId } from '@/types';

export type LeagueConfig = {
  id: LeagueId;
  code: string;
  name: string;
  shortName: string;
  accentVar: string;
};

export const LEAGUE_CONFIGS: LeagueConfig[] = [
  { id: 'sbbl', code: 'SBBL', name: "Sunday's Best Basketball League", shortName: 'SBBL', accentVar: '--sbbl' },
  { id: 'wbl', code: 'WBL', name: 'Weekend Basketball League', shortName: 'WBL', accentVar: '--wbl' },
  { id: 'tgifbl', code: 'TGIFBL', name: "Thank God It's Friday Basketball League", shortName: 'TGIFBL', accentVar: '--tgifbl' },
];

export function getLeagueConfig(id: LeagueId): LeagueConfig {
  return LEAGUE_CONFIGS.find((l) => l.id === id) ?? LEAGUE_CONFIGS[0];
}

export function leagueIdFromCode(code: string): LeagueId {
  const upper = code.toUpperCase();
  const match = LEAGUE_CONFIGS.find((l) => l.code === upper);
  return match?.id ?? 'sbbl';
}

export function leagueCodeFromId(id: LeagueId): string {
  return getLeagueConfig(id).code;
}

const LEAGUE_STORAGE_KEY = 'sbblhq.activeLeague';

export function persistLeague(id: LeagueId): void {
  try { localStorage.setItem(LEAGUE_STORAGE_KEY, id); } catch { /* noop */ }
}

export function loadPersistedLeague(): LeagueId | null {
  try {
    const stored = localStorage.getItem(LEAGUE_STORAGE_KEY);
    if (stored && LEAGUE_CONFIGS.some((l) => l.id === stored)) return stored as LeagueId;
  } catch { /* noop */ }
  return null;
}
