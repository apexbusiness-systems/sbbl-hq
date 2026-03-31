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
export const SCHEDULE_DATA: ScheduleDay[] = [
  // ── SBBL ──────────────────────────────────────────────────────────────────
  {
    leagueId: 'sbbl',
    leagueCode: 'SBBL',
    season: 'Season 1',
    week: 1,
    date: '2026-04-03',
    venue: 'Crawford School',
    address: '531 Finch Ave W',
    courts: [
      {
        name: '1v1 Exhibition',
        games: [
          { time: '6:30 PM', home: 'Fred', away: 'Karl', court: '1v1 Exhibition' },
        ],
      },
    ],
  },
  // ── TGIFBL ────────────────────────────────────────────────────────────────
  {
    leagueId: 'tgifbl',
    leagueCode: 'TGIFBL',
    season: 'Season 1',
    week: 5,
    date: '2026-03-27',
    venue: 'TAT Stadium',
    address: '4001 Crouse Rd',
    courts: [
      {
        name: 'Court 5',
        games: [
          { time: '7:00 PM', home: 'Solid North', away: 'OSY x LCL', court: 'Court 5' },
          { time: '8:00 PM', home: 'Batang Riles x Tri J', away: 'J Elite', court: 'Court 5' },
          { time: '9:00 PM', home: 'YG', away: 'Conceited Fantasy', court: 'Court 5' },
          { time: '10:00 PM', home: 'C&F', away: 'City Above Elite', court: 'Court 5' },
          { time: '11:00 PM', home: 'Over Under', away: 'City Above Elite', court: 'Court 5' },
        ],
      },
      {
        name: 'Court 4',
        games: [
          { time: '7:00 PM', home: 'Full Time Ballers', away: 'DBRKDZ', court: 'Court 4' },
          { time: '8:00 PM', home: 'BLBG', away: 'Mantiku', court: 'Court 4' },
          { time: '9:00 PM', home: 'Fourteen Ounce', away: 'Ball is Life', court: 'Court 4' },
          { time: '10:00 PM', home: 'JC Trans Jrs', away: 'Banayad Hoopers', court: 'Court 4' },
        ],
      },
    ],
  },
];

export function getSchedulesByLeague(leagueId: LeagueId): ScheduleDay[] {
  return SCHEDULE_DATA.filter((s) => s.leagueId === leagueId);
}
