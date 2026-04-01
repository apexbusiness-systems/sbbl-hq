import { League, PlayerProfile, Team, Game, Product, MediaAsset, ReviewItem, Invoice, PlayerOfTheGame } from '@/types';

import player1 from '@/assets/player-1.svg';
import player2 from '@/assets/player-2.svg';
import player3 from '@/assets/player-3.svg';
import storeJersey from '@/assets/store-jersey.svg';
import storeHoodie from '@/assets/store-hoodie.svg';
import storeCap from '@/assets/store-cap.svg';
import storeTee from '@/assets/store-tee.svg';
import storeAccessories from '@/assets/store-accessories.svg';
import gameAction from '@/assets/game-action.svg';

// Marketing assets — real photos & event graphics
// Drop image files at these paths and they will auto-render throughout the app
const potgTataRamon = '/assets/potg/wbl-tata-ramon.jpg';
const potgMichaelRamos = '/assets/potg/wbl-michael-ramos.jpg';
const potgHaroldCasio = '/assets/potg/wbl-harold-casio.jpg';
const potgJtBalangui = '/assets/potg/wbl-jt-balangui.jpg';
const event1v1Sbbl = '/assets/events/1v1-fred-vs-karl.jpg';
const potgDarylGamiao = '/assets/potg/wbl-daryl-gamiao.jpg';
const potgRjayCuntapay = '/assets/potg/wbl-rjay-cuntapay.jpg';
const potgGilbertBacera = '/assets/potg/wbl-gilbert-bacera.jpg';
const eventSbblSeason11 = '/assets/events/sbbl-season-11.jpg';

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
  { id: 't9', name: 'OSY Phoenix', leagueId: 'wbl', division: 'Main', record: { wins: 4, losses: 1 } },
  { id: 't10', name: 'Ball is Life', leagueId: 'wbl', division: 'Main', record: { wins: 3, losses: 2 } },
  { id: 't11', name: 'Rebelde', leagueId: 'wbl', division: 'Main', record: { wins: 4, losses: 1 } },
  { id: 't12', name: 'Splash', leagueId: 'wbl', division: 'Main', record: { wins: 3, losses: 2 } },
];

export const players: PlayerProfile[] = [
  { id: 'p1', name: 'Marcus Rivera', number: 23, position: 'SF', teamId: 't1', leagueId: 'sbbl', avatar: player1, badges: ['MVP', 'All-Star', '3PT King'], stats: { pts: 28.4, reb: 7.2, ast: 5.1, stl: 2.3, blk: 0.8, fls: 2.1, min: 34.5 } },
  { id: 'p2', name: 'Jaylen Torres', number: 11, position: 'PG', teamId: 't2', leagueId: 'sbbl', avatar: player2, badges: ['Assist Leader', 'Floor General'], stats: { pts: 18.7, reb: 3.4, ast: 9.8, stl: 1.9, blk: 0.2, fls: 1.8, min: 32.1 } },
  { id: 'p3', name: 'Andre Santiago', number: 34, position: 'C', teamId: 't4', leagueId: 'wbl', avatar: player3, badges: ['Defensive Anchor', 'Rebound Machine'], stats: { pts: 14.2, reb: 12.6, ast: 2.1, stl: 0.8, blk: 3.4, fls: 3.2, min: 30.8 } },
  { id: 'p4', name: 'Carlos Mendez', number: 7, position: 'SG', teamId: 't6', leagueId: 'tgifbl', avatar: player1, badges: ['Clutch Performer'], stats: { pts: 22.1, reb: 4.5, ast: 4.2, stl: 1.5, blk: 0.5, fls: 2.4, min: 31.2 } },
  { id: 'p5', name: 'Darius Reyes', number: 5, position: 'PF', teamId: 't1', leagueId: 'sbbl', avatar: player2, badges: ['Rising Star'], stats: { pts: 16.8, reb: 8.9, ast: 2.8, stl: 1.1, blk: 1.7, fls: 2.9, min: 29.4 } },
  { id: 'p6', name: 'Rico Bautista', number: 15, position: 'SF', teamId: 't5', leagueId: 'wbl', avatar: player3, badges: ['6th Man'], stats: { pts: 15.3, reb: 5.1, ast: 3.7, stl: 2.0, blk: 0.6, fls: 1.5, min: 26.7 } },
  { id: 'p7', name: 'Tata Ramon', number: 8, position: 'SG', teamId: 't9', leagueId: 'wbl', avatar: potgTataRamon, badges: ['Player of the Game', 'Scorer'], stats: { pts: 22.0, reb: 5.0, ast: 6.0, stl: 1.5, blk: 0.5, fls: 2.0, min: 32.0 } },
  { id: 'p8', name: 'Michael Ramos', number: 3, position: 'SF', teamId: 't10', leagueId: 'wbl', avatar: potgMichaelRamos, badges: ['Player of the Game', 'All-Star'], stats: { pts: 24.0, reb: 7.0, ast: 6.0, stl: 1.8, blk: 0.8, fls: 1.5, min: 34.0 } },
  { id: 'p9', name: 'Harold Casio', number: 25, position: 'PF', teamId: 't11', leagueId: 'wbl', avatar: potgHaroldCasio, badges: ['Player of the Game', 'Rebounder'], stats: { pts: 20.0, reb: 7.0, ast: 5.0, stl: 1.2, blk: 1.0, fls: 2.5, min: 31.0 } },
  { id: 'p10', name: 'JT Balangui', number: 10, position: 'PG', teamId: 't12', leagueId: 'wbl', avatar: potgJtBalangui, badges: ['Player of the Game', 'Floor General'], stats: { pts: 20.0, reb: 6.0, ast: 6.0, stl: 2.0, blk: 0.4, fls: 1.8, min: 30.0 } },
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
  { id: 'prod1', name: 'SBBL HQ Official Jersey', category: 'jerseys', price: 1850, image: storeJersey, sizes: ['S', 'M', 'L', 'XL', '2XL'], colors: ['Black/Gold', 'White/Gold'], sale: true },
  { id: 'prod2', name: 'APEX Hoodie', category: 'hoodies', price: 2200, image: storeHoodie, sizes: ['S', 'M', 'L', 'XL'], colors: ['Black', 'Charcoal'], sale: true },
  { id: 'prod3', name: 'Championship Cap', category: 'caps', price: 850, image: storeCap, colors: ['Black/Gold', 'Black/Silver'] },
  { id: 'prod4', name: 'Court Culture Tee', category: 'tees', price: 950, image: storeTee, sizes: ['S', 'M', 'L', 'XL', '2XL'], colors: ['Black', 'Graphite'], sale: true },
  { id: 'prod5', name: 'Pro Gear Bundle', category: 'accessories', price: 1450, image: storeAccessories, badge: 'Bundle Deal', sale: true },
  { id: 'prod6', name: 'MVP Rewards Jersey', category: 'rewards', price: 0, image: storeJersey, badge: 'Reward Item', sizes: ['M', 'L', 'XL'] },
];

export const mediaAssets: MediaAsset[] = [
  // SBBL marketing
  { id: 'm-sbbl-1v1', title: '1v1 Event — Fred vs Karl', type: 'poster', thumbnail: event1v1Sbbl, leagueId: 'sbbl', status: 'published', date: '2026-04-03' },
  { id: 'm1', title: 'Rivera 40-Piece Performance', type: 'highlight', thumbnail: gameAction, leagueId: 'sbbl', status: 'published', date: '2026-03-22' },
  { id: 'm4', title: 'All-Star Media Day Reel', type: 'highlight', thumbnail: gameAction, leagueId: 'sbbl', status: 'draft', date: '2026-03-26' },
  // WBL Player of the Game cards
  { id: 'm-wbl-potg-michael', title: 'POTG — Michael Ramos (Ball is Life)', type: 'poster', thumbnail: potgMichaelRamos, leagueId: 'wbl', status: 'published', date: '2026-03-29' },
  { id: 'm-wbl-potg-tata', title: 'POTG — Tata Ramon (OSY Phoenix)', type: 'poster', thumbnail: potgTataRamon, leagueId: 'wbl', status: 'published', date: '2026-03-29' },
  { id: 'm-wbl-potg-harold', title: 'POTG — Harold Casio (Rebelde)', type: 'poster', thumbnail: potgHaroldCasio, leagueId: 'wbl', status: 'published', date: '2026-03-22' },
  { id: 'm-wbl-potg-jt', title: 'POTG — JT Balangui (Splash)', type: 'poster', thumbnail: potgJtBalangui, leagueId: 'wbl', status: 'published', date: '2026-03-22' },
  { id: 'm2', title: 'WBL Finals Preview', type: 'poster', thumbnail: gameAction, leagueId: 'wbl', status: 'ready', date: '2026-03-25' },
  // TGIFBL
  { id: 'm3', title: 'TGIFBL Player of the Week', type: 'clip', thumbnail: gameAction, leagueId: 'tgifbl', status: 'published', date: '2026-03-21' },
  // New Event
  { id: 'm-sbbl-s11', title: 'SBBL Season 11 Spring Edition Tip Off', type: 'poster', thumbnail: eventSbblSeason11, leagueId: 'sbbl', status: 'published', date: '2026-04-12' },
  // New POTGs
  { id: 'm-wbl-potg-daryl', title: 'POTG — Daryl Gamiao (BRB)', type: 'poster', thumbnail: potgDarylGamiao, leagueId: 'wbl', status: 'published', date: '2026-04-01' },
  { id: 'm-wbl-potg-rjay', title: 'POTG — Rjay Cuntapay (SPG Cutie)', type: 'poster', thumbnail: potgRjayCuntapay, leagueId: 'wbl', status: 'published', date: '2026-04-01' },
  { id: 'm-wbl-potg-gilbert', title: 'POTG — Gilbert Bacera (Blacksmith)', type: 'poster', thumbnail: potgGilbertBacera, leagueId: 'wbl', status: 'published', date: '2026-04-01' },
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

export const playersOfTheGame: PlayerOfTheGame[] = [
  { id: 'potg-wbl-1', leagueId: 'wbl', playerName: 'Michael Ramos', playerId: 'p8', team: 'Ball is Life', pts: 24, rebs: 7, assts: 6, gameResult: 'NSD 82 vs Ball is Life 84', date: '2026-03-29', image: potgMichaelRamos },
  { id: 'potg-wbl-2', leagueId: 'wbl', playerName: 'Tata Ramon', playerId: 'p7', team: 'OSY Phoenix', pts: 22, rebs: 5, assts: 6, gameResult: 'OSY 77 vs Solid North 63', date: '2026-03-29', image: potgTataRamon },
  { id: 'potg-wbl-3', leagueId: 'wbl', playerName: 'Harold Casio', playerId: 'p9', team: 'Rebelde', pts: 20, rebs: 7, assts: 5, gameResult: 'Harina x Wild Dogs 62 vs Rebelde 79', date: '2026-03-22', image: potgHaroldCasio },
  { id: 'potg-wbl-4', leagueId: 'wbl', playerName: 'JT Balangui', playerId: 'p10', team: 'Splash', pts: 20, rebs: 6, assts: 6, gameResult: 'Splash 60 vs Rebelde Jrs 51', date: '2026-03-22', image: potgJtBalangui },
  { id: 'potg-wbl-5', leagueId: 'wbl', playerName: 'Daryl Gamiao', team: 'BRB', pts: 15, rebs: 4, assts: 4, gameResult: 'BRB 61 VS SERVITEURS 54', date: '2026-04-01', image: potgDarylGamiao },
  { id: 'potg-wbl-6', leagueId: 'wbl', playerName: 'Rjay Cuntapay', team: 'SPG Cutie', pts: 14, rebs: 3, assts: 4, gameResult: 'BATANG KANTO 45 VS SPG CUTIE 69', date: '2026-04-01', image: potgRjayCuntapay },
  { id: 'potg-wbl-7', leagueId: 'wbl', playerName: 'Gilbert Bacera', team: 'Blacksmith', pts: 16, rebs: 4, assts: 5, gameResult: 'BLACKSMITH 63 VS DOWNTOWN 46', date: '2026-04-01', image: potgGilbertBacera },
];
