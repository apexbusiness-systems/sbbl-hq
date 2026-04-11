import type { LeagueId } from '@/types';
import { getLeagueSeasonLabel } from '@/lib/leagues';

export type StaticTeam = {
  name: string;
  leagueId: LeagueId;
  leagueCode: string;
  season: string;
};

const TGIF_SEASON = getLeagueSeasonLabel('tgifbl');
const WBL_SEASON = getLeagueSeasonLabel('wbl');

/**
 * Static team roster sourced from official league schedule graphics.
 * Will be replaced by Supabase teams table when data pipeline ships.
 */
export const STATIC_TEAMS: StaticTeam[] = [
  // ── TGIF Basketball League — Season 1 ──
  { name: 'Solid North', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'OSY x LCL', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'Batang Riles x Tri J', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'J Elite', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'YG', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'Conceited Fantasy', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'C&F', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'City Above Elite', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'Over Under', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'Full Time Ballers', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'DBRKDZ', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'BLBG', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'Mantiku', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'Fourteen Ounce', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'Ball is Life', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'JC Trans Jrs', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },
  { name: 'Banayad Hoopers', leagueId: 'tgifbl', leagueCode: 'TGIFBL', season: TGIF_SEASON },

  // ── Weekend Basketball League — Season 3 ──
  { name: 'OSY', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Rebelde Jrs', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Solid North', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Crosslinx Warriors', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Rebelde', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Downtown', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'La Liga Elite', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Blacksmith', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Splash', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'SPG', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Harina x Wild Dogs', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'NSD', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: '4Lifers', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Serviteurs', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Batang Kanto', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Disciples', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
  { name: 'Ball is Life', leagueId: 'wbl', leagueCode: 'WBL', season: WBL_SEASON },
];

export function getTeamsByLeague(leagueId: LeagueId): StaticTeam[] {
  return STATIC_TEAMS.filter((t) => t.leagueId === leagueId);
}

export function getAllTeams(): StaticTeam[] {
  return STATIC_TEAMS;
}
