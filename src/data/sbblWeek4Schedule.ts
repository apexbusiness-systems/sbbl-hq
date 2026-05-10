import type { LeagueId } from '@/types';

type ParsedGame = { time: string; home: string; away: string };
type ParsedCourt = { name: string; games: ParsedGame[] };

export type ParsedScheduleDay = {
  leagueId: LeagueId;
  season: string;
  week: string;
  date: string;
  venue: string;
  address: string;
  courts: ParsedCourt[];
};

export const SBBL_WEEK4_MAY_10_2026: ParsedScheduleDay = {
  leagueId: 'sbbl',
  season: 'Season 11',
  week: '4',
  date: '2026-05-10',
  venue: 'Crawford School',
  address: '531 Finch Ave W',
  courts: [
    { name: 'Court 1', games: [
      { time: '9:00 AM', home: 'Smesh', away: 'Riverside (P9)' },
      { time: '10:00 AM', home: 'Mantiku', away: 'Northstar OGS (P8)' },
      { time: '11:00 AM', home: 'Betterform', away: 'Montanyosa (P9)' },
      { time: '12:00 PM', home: 'Ganapers', away: 'Team Ilocano (P8)' },
      { time: '1:00 PM', home: 'YG', away: 'Downtown Eagle (P5)' },
      { time: '2:00 PM', home: 'TMT', away: '4Lifers (P4)' },
      { time: '3:00 PM', home: 'GLS Auto', away: 'Sheeesh (P6)' },
      { time: '4:00 PM', home: 'Maple Toyota', away: 'Part Time Players (P6)' },
      { time: '5:00 PM', home: 'Maximize', away: 'Lakay Jrs. (P4)' },
      { time: '6:00 PM', home: 'Occci Elite', away: 'Maple Toyota (P6)' },
      { time: '7:00 PM', home: 'Crosslinx Warriors', away: 'FBB (P6)' },
      { time: '8:00 PM', home: 'SBBL', away: 'Selection' },
    ] },
    { name: 'Court 2', games: [
      { time: '11:00 AM', home: 'Northstar Jrs', away: 'Ainails (P9)' },
      { time: '12:00 PM', home: 'Toronto Raps', away: 'Area 51 (P7)' },
      { time: '1:00 PM', home: 'MDS X Titos', away: 'Rebelde Makki (P8)' },
      { time: '2:00 PM', home: 'Unlock', away: 'Alab (P9)' },
      { time: '3:00 PM', home: 'BRB X LCL', away: 'Rebelde Jrs. (P8)' },
      { time: '4:00 PM', home: 'Selection', away: 'Rebelde (P7)' },
      { time: '5:00 PM', home: 'Bravehearts', away: 'Forest Hill (P9)' },
      { time: '6:00 PM', home: 'Tomana X LCYNM', away: 'WGN (P8)' },
      { time: '7:00 PM', home: 'OSY X Phoenix', away: 'SNM JRS (P7)' },
      { time: '8:00 PM', home: 'GLS Titos', away: 'Macao Imperial Tea (P9)' },
    ] },
    { name: 'Court 3', games: [
      { time: '2:30 PM', home: 'San Lorenzo', away: 'Young Bucks' },
      { time: '3:30 PM', home: 'Grind Elite', away: 'Nobat (P9)' },
      { time: '7:30 PM', home: 'Keele Yutes', away: 'Tita Hunters (P9)' },
    ] },
    { name: 'Court 4', games: [
      { time: '12:00 PM', home: 'Blacksmith', away: 'Vipers (P7)' },
      { time: '1:00 PM', home: 'Panday', away: 'Pangasinan Ballers (P8)' },
      { time: '2:00 PM', home: 'Eagles', away: 'JRV (P6)' },
      { time: '3:00 PM', home: 'SPG All Stars', away: 'Quadro (P7)' },
      { time: '4:00 PM', home: 'Kanto Terros', away: 'SPG OGS (P9)' },
      { time: '5:00 PM', home: 'NVBC Victors', away: 'Mapogo (P8)' },
    ] },
  ],
};
