import type { LeagueId } from '@/types';

export type StaticTeam = {
  name: string;
  leagueId: LeagueId;
  leagueCode: string;
  season: string;
  division?: string;
};

/**
 * Static team roster sourced from official league schedule graphics.
 * Will be replaced by Supabase teams table when data pipeline ships.
 */
export const STATIC_TEAMS: StaticTeam[] = [
  // ── TGIF Basketball League — Season 1 ──
  { name: 'Solid North', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'OSY x LCL', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'Batang Riles x Tri J', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'J Elite', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'YG', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'Conceited Fantasy', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'C&F', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'City Above Elite', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'Over Under', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'Full Time Ballers', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'DBRKDZ', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'BLBG', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'Mantiku', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'Fourteen Ounce', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'Ball is Life', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'JC Trans Jrs', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },
  { name: 'Banayad Hoopers', leagueId: 'tgif', leagueCode: 'TGIF', season: 'Season 1' },

  // ── Weekend Basketball League — Season 3 ──
  { name: 'Ball is Life', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite' },
  { name: '4Lifers', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite' },
  { name: 'NSD', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite' },
  { name: 'Disciples', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite' },
  { name: 'Dark Knight', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite' },
  { name: 'Avlis', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite' },
  { name: 'Downtown', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 2' },
  { name: 'Rebelde', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 2' },
  { name: 'BRB', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 2' },
  { name: 'Harina x Wild Dogs', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 2' },
  { name: 'GLS Auto', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 2' },
  { name: 'Crosslinx Warriors', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 2' },
  { name: 'Splash', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 3' },
  { name: 'Batang Kanto', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 3' },
  { name: 'Blacksmith', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 3' },
  { name: 'Rebelde Jrs.', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 3' },
  { name: 'Solid North', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 3' },
  { name: 'Pinoy Northstars', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 3' },
  { name: 'Serviteurs', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 3' },
  { name: 'OSY x LCL', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 3' },
  { name: 'SPG Cutie', leagueId: 'wbl', leagueCode: 'WBL', season: 'Season 3', division: 'Elite 3' },
];

export function getTeamsByLeague(leagueId: LeagueId): StaticTeam[] {
  return STATIC_TEAMS.filter((t) => t.leagueId === leagueId);
}

export function getAllTeams(): StaticTeam[] {
  return STATIC_TEAMS;
}
