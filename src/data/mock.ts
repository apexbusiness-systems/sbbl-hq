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

export const leagues: League[] = [
  { id: 'sbbl', name: "Sunday's Best Basketball League", shortName: 'SBBL', fee: 1350, accentVar: '--sbbl', description: 'The flagship Sunday league with multiple Panalay divisions, strict review rules, and all-star media day events.' },
  { id: 'wbl', name: 'Weekend Basketball League', shortName: 'WBL', fee: 1390, accentVar: '--wbl', description: 'Weekend warriors compete at La Liga Sports Complex with best-of-3 finals and live broadcast coverage.' },
  { id: 'tgif', name: "Thank God It's Friday Basketball League", shortName: 'TGIF', fee: 1390, accentVar: '--tgif', description: 'Friday night basketball at Tat Stadium featuring player-of-the-week awards and multiple division groups.' },
];

export const teams: Team[] = [];

export const players: PlayerProfile[] = [];

export const games: Game[] = [];

export const products: Product[] = [
  { id: 'prod1', name: 'SBBL HQ Official Jersey', category: 'jerseys', price: 1850, image: storeJersey, sizes: ['S', 'M', 'L', 'XL', '2XL'], colors: ['Black/Gold', 'White/Gold'], sale: true },
  { id: 'prod2', name: 'APEX Hoodie', category: 'hoodies', price: 2200, image: storeHoodie, sizes: ['S', 'M', 'L', 'XL'], colors: ['Black', 'Charcoal'], sale: true },
  { id: 'prod3', name: 'Championship Cap', category: 'caps', price: 850, image: storeCap, colors: ['Black/Gold', 'Black/Silver'] },
  { id: 'prod4', name: 'Court Culture Tee', category: 'tees', price: 950, image: storeTee, sizes: ['S', 'M', 'L', 'XL', '2XL'], colors: ['Black', 'Graphite'], sale: true },
  { id: 'prod5', name: 'Pro Gear Bundle', category: 'accessories', price: 1450, image: storeAccessories, badge: 'Bundle Deal', sale: true },
  { id: 'prod6', name: 'MVP Rewards Jersey', category: 'rewards', price: 0, image: storeJersey, badge: 'Reward Item', sizes: ['M', 'L', 'XL'] },
];

export const mediaAssets: MediaAsset[] = [];

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
  { id: 'inv5', description: 'TGIF Season Registration — Friday Flames', amount: 1390, date: '2026-01-22', status: 'paid', leagueId: 'tgif' },
];

export const gameActionImage = gameAction;

export const playersOfTheGame: PlayerOfTheGame[] = [];
