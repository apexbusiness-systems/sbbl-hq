import { League, PlayerProfile, Team, Game, Product, MediaAsset, ReviewItem, Invoice } from '@/types';

import player1 from '@/assets/player-1.jpg';
import player2 from '@/assets/player-2.jpg';
import player3 from '@/assets/player-3.jpg';
import storeJersey from '@/assets/store-jersey.jpg';
import storeHoodie from '@/assets/store-hoodie.jpg';
import storeCap from '@/assets/store-cap.jpg';
import storeTee from '@/assets/store-tee.jpg';
import storeAccessories from '@/assets/store-accessories.jpg';
import gameAction from '@/assets/game-action.jpg';

export const leagues: League[] = [
  { id: 'sbbl', name: "Sunday's Best Basketball League", shortName: 'SBBL', fee: 1350, accentVar: '--sbbl', description: 'The flagship Sunday league with multiple Panalay divisions, strict review rules, and all-star media day events.' },
  { id: 'wbl', name: 'Weekend Basketball League', shortName: 'WBL', fee: 1390, accentVar: '--wbl', description: 'Weekend warriors compete at La Liga Sports Complex with best-of-3 finals and live broadcast coverage.' },
  { id: 'tgifbl', name: "Thank God It's Friday Basketball League", shortName: 'TGIFBL', fee: 1390, accentVar: '--tgifbl', description: 'Friday night basketball at Tat Stadium featuring player-of-the-week awards and multiple division groups.' },
];

export const teams: Team[] = [
  { id: 't1', name: 'Panalay Kings', leagueId: 'sbbl', division: 'Panalay A', record: { wins: 8, losses: 2 } },
  { id: 't2', name: 'Court Blazers', leagueId: 'sbbl', division: 'Panalay A', record: { wins: 7, losses: 3 } },
  { id: 't3', name: 'Sunday Strikers', leagueId: 'sbbl', division: 'Panalay B', record: { wins: 6, losses: 4 } },
  { id: 't4', name: 'Weekend Warriors', leagueId: 'wbl', division: 'Main', record: { wins: 9, losses: 1 } },
  { id: 't5', name: 'La Liga Legends', leagueId: 'wbl', division: 'Main', record: { wins: 5, losses: 5 } },
  { id: 't6', name: 'Friday Flames', leagueId: 'tgifbl', division: 'Group 1', record: { wins: 7, losses: 3 } },
  { id: 't7', name: 'Tat Stadium Elite', leagueId: 'tgifbl', division: 'Group 2', record: { wins: 6, losses: 4 } },
  { id: 't8', name: 'Rim Rattlers', leagueId: 'sbbl', division: 'Panalay B', record: { wins: 5, losses: 5 } },
];

export const players: PlayerProfile[] = [
  { id: 'p1', name: 'Marcus Rivera', number: 23, position: 'SF', teamId: 't1', leagueId: 'sbbl', avatar: player1, badges: ['MVP', 'All-Star', '3PT King'], stats: { pts: 28.4, reb: 7.2, ast: 5.1, stl: 2.3, blk: 0.8, fls: 2.1, min: 34.5 } },
  { id: 'p2', name: 'Jaylen Torres', number: 11, position: 'PG', teamId: 't2', leagueId: 'sbbl', avatar: player2, badges: ['Assist Leader', 'Floor General'], stats: { pts: 18.7, reb: 3.4, ast: 9.8, stl: 1.9, blk: 0.2, fls: 1.8, min: 32.1 } },
  { id: 'p3', name: 'Andre Santiago', number: 34, position: 'C', teamId: 't4', leagueId: 'wbl', avatar: player3, badges: ['Defensive Anchor', 'Rebound Machine'], stats: { pts: 14.2, reb: 12.6, ast: 2.1, stl: 0.8, blk: 3.4, fls: 3.2, min: 30.8 } },
  { id: 'p4', name: 'Carlos Mendez', number: 7, position: 'SG', teamId: 't6', leagueId: 'tgifbl', avatar: player1, badges: ['Clutch Performer'], stats: { pts: 22.1, reb: 4.5, ast: 4.2, stl: 1.5, blk: 0.5, fls: 2.4, min: 31.2 } },
  { id: 'p5', name: 'Darius Reyes', number: 5, position: 'PF', teamId: 't1', leagueId: 'sbbl', avatar: player2, badges: ['Rising Star'], stats: { pts: 16.8, reb: 8.9, ast: 2.8, stl: 1.1, blk: 1.7, fls: 2.9, min: 29.4 } },
  { id: 'p6', name: 'Rico Bautista', number: 15, position: 'SF', teamId: 't5', leagueId: 'wbl', avatar: player3, badges: ['6th Man'], stats: { pts: 15.3, reb: 5.1, ast: 3.7, stl: 2.0, blk: 0.6, fls: 1.5, min: 26.7 } },
];

export const games: Game[] = [
  { id: 'g1', leagueId: 'sbbl', homeTeam: teams[0], awayTeam: teams[1], venue: 'Panalay Arena', court: 'Court 1', date: '2026-03-29', time: '14:00', status: 'live', score: { home: 67, away: 62 }, ppvPrice: 2.50 },
  { id: 'g2', leagueId: 'wbl', homeTeam: teams[3], awayTeam: teams[4], venue: 'La Liga Sports Complex', court: 'Main Court', date: '2026-03-28', time: '16:00', status: 'upcoming', ppvPrice: 2.50 },
  { id: 'g3', leagueId: 'tgifbl', homeTeam: teams[5], awayTeam: teams[6], venue: 'Tat Stadium', court: 'Court A', date: '2026-03-27', time: '19:00', status: 'final', score: { home: 88, away: 79 }, ppvPrice: 2.50 },
  { id: 'g4', leagueId: 'sbbl', homeTeam: teams[2], awayTeam: teams[7], venue: 'Panalay Arena', court: 'Court 2', date: '2026-03-30', time: '10:00', status: 'upcoming', ppvPrice: 2.50 },
  { id: 'g5', leagueId: 'wbl', homeTeam: teams[4], awayTeam: teams[3], venue: 'La Liga Sports Complex', court: 'Court 2', date: '2026-04-04', time: '15:00', status: 'upcoming', ppvPrice: 2.50 },
  { id: 'g6', leagueId: 'sbbl', homeTeam: teams[1], awayTeam: teams[2], venue: 'Panalay Arena', court: 'Court 1', date: '2026-03-22', time: '14:00', status: 'final', score: { home: 75, away: 71 }, ppvPrice: 2.50 },
];

export const products: Product[] = [
  { id: 'prod1', name: 'SBBL HQ Official Jersey', category: 'jerseys', price: 1850, image: storeJersey, sizes: ['S', 'M', 'L', 'XL', '2XL'], colors: ['Black/Gold', 'White/Gold'] },
  { id: 'prod2', name: 'APEX Hoodie', category: 'hoodies', price: 2200, image: storeHoodie, sizes: ['S', 'M', 'L', 'XL'], colors: ['Black', 'Charcoal'] },
  { id: 'prod3', name: 'Championship Cap', category: 'caps', price: 850, image: storeCap, colors: ['Black/Gold', 'Black/Silver'] },
  { id: 'prod4', name: 'Court Culture Tee', category: 'tees', price: 950, image: storeTee, sizes: ['S', 'M', 'L', 'XL', '2XL'], colors: ['Black', 'Graphite'] },
  { id: 'prod5', name: 'Pro Gear Bundle', category: 'accessories', price: 1450, image: storeAccessories, badge: 'Bundle Deal' },
  { id: 'prod6', name: 'MVP Rewards Jersey', category: 'rewards', price: 0, image: storeJersey, badge: 'Reward Item', sizes: ['M', 'L', 'XL'] },
];

export const mediaAssets: MediaAsset[] = [
  { id: 'm1', title: 'Rivera 40-Piece Performance', type: 'highlight', thumbnail: gameAction, leagueId: 'sbbl', status: 'published', date: '2026-03-22' },
  { id: 'm2', title: 'WBL Finals Preview', type: 'poster', thumbnail: gameAction, leagueId: 'wbl', status: 'ready', date: '2026-03-25' },
  { id: 'm3', title: 'TGIFBL Player of the Week', type: 'clip', thumbnail: gameAction, leagueId: 'tgifbl', status: 'published', date: '2026-03-21' },
  { id: 'm4', title: 'All-Star Media Day Reel', type: 'highlight', thumbnail: gameAction, leagueId: 'sbbl', status: 'draft', date: '2026-03-26' },
];

export const reviewItems: ReviewItem[] = [
  { id: 'r1', type: 'source_conflict', title: 'WBL Poster Source Conflict', description: 'Uploaded poster for WBL Game 5 uses unapproved sponsor imagery. Requires creative team review before publishing.', leagueId: 'wbl', severity: 'medium', status: 'pending' },
  { id: 'r2', type: 'rule_conflict', title: 'SBBL Rule Review Required', description: 'Updated overtime rules for Panalay Division A require league admin sign-off before next scheduled game.', leagueId: 'sbbl', severity: 'high', status: 'pending' },
  { id: 'r3', type: 'stream_issue', title: 'Stream Entitlement Sync Error', description: '3 viewers reported access issues after PPV purchase for SBBL Game G1. Entitlement records show mismatched session tokens.', leagueId: 'sbbl', severity: 'high', status: 'pending' },
  { id: 'r4', type: 'publish_review', title: 'Media Day Content Approval', description: 'All-Star Media Day reel pending final review before public release.', leagueId: 'sbbl', severity: 'low', status: 'pending' },
];

export const invoices: Invoice[] = [
  { id: 'inv1', description: 'SBBL Season Registration — Panalay Kings', amount: 1350, date: '2026-01-15', status: 'paid', leagueId: 'sbbl' },
  { id: 'inv2', description: 'WBL Season Registration — Weekend Warriors', amount: 1390, date: '2026-01-20', status: 'paid', leagueId: 'wbl' },
  { id: 'inv3', description: 'PPV Access — SBBL Game G1', amount: 2.50, date: '2026-03-29', status: 'paid', leagueId: 'sbbl' },
  { id: 'inv4', description: 'Store Order #1042 — APEX Hoodie', amount: 2200, date: '2026-03-25', status: 'pending' },
  { id: 'inv5', description: 'TGIFBL Season Registration — Friday Flames', amount: 1390, date: '2026-01-22', status: 'paid', leagueId: 'tgifbl' },
];

export const gameActionImage = gameAction;
