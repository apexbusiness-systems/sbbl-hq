export type LeagueId = 'sbbl' | 'wbl' | 'tgifbl';
export type AuthRole = 'fan' | 'member' | 'player' | 'coach' | 'team_manager' | 'league_admin' | 'media_operator' | 'store_operator' | 'super_admin';
export type GameStatus = 'upcoming' | 'live' | 'final' | 'postponed' | 'review_pending';
export type EntitlementStatus = 'locked' | 'preview' | 'purchased' | 'active' | 'expired';

export interface League {
  id: LeagueId;
  name: string;
  shortName: string;
  fee: number;
  accentVar: string;
  description: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  number: number;
  position: string;
  teamId: string;
  leagueId: LeagueId;
  avatar: string;
  badges: string[];
  stats: StatLine;
}

export interface Team {
  id: string;
  name: string;
  leagueId: LeagueId;
  division: string;
  logo?: string;
  record: { wins: number; losses: number };
}

export interface Game {
  id: string;
  leagueId: LeagueId;
  homeTeam: Team;
  awayTeam: Team;
  venue: string;
  court: string;
  date: string;
  time: string;
  status: GameStatus;
  score?: { home: number; away: number };
  ppvPrice: number;
}

export interface StatLine {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fls: number;
  min: number;
}

export interface Product {
  id: string;
  name: string;
  category: 'tees' | 'hoodies' | 'jerseys' | 'caps' | 'accessories' | 'rewards';
  price: number;
  image: string;
  sizes?: string[];
  colors?: string[];
  badge?: string;
  sale?: boolean;
}

export interface MediaAsset {
  id: string;
  title: string;
  type: 'highlight' | 'clip' | 'poster' | 'photo';
  thumbnail: string;
  leagueId: LeagueId;
  status: 'draft' | 'ready' | 'published';
  date: string;
}

export interface ReviewItem {
  id: string;
  type: 'rule_conflict' | 'source_conflict' | 'publish_review' | 'stream_issue' | 'moderation';
  title: string;
  description: string;
  leagueId: LeagueId;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'resolved' | 'dismissed';
}

export interface PlayerOfTheGame {
  id: string;
  leagueId: LeagueId;
  playerName: string;
  playerId?: string;
  team: string;
  pts: number;
  rebs: number;
  assts: number;
  gameResult: string;
  date: string;
  /** Path to POTG graphic card (marketing asset) */
  image?: string;
}

export interface Invoice {
  id: string;
  description: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'overdue';
  leagueId?: LeagueId;
}
