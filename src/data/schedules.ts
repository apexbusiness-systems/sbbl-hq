import type { LeagueId } from '@/types';

export type ScheduleGame = {
  time: string;
  home: string;
  away: string;
  court: string;
};

export type ScheduleDay = {
  leagueId: LeagueId;
  leagueCode: string;
  season: string;
  week: number;
  date: string;           // ISO date: YYYY-MM-DD
  venue: string;
  address: string;
  courts: {
    name: string;
    games: ScheduleGame[];
  }[];
};

/**
 * Static schedule data — sourced from official league graphics.
 * Will be replaced by Supabase-backed API when schedule pipeline ships.
 */
export const SCHEDULE_DATA: ScheduleDay[] = [];

export function getSchedulesByLeague(leagueId: LeagueId): ScheduleDay[] {
  return SCHEDULE_DATA.filter((s) => s.leagueId === leagueId);
}
