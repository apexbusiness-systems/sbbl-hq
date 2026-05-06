import fs from 'fs';

let mock = fs.readFileSync('src/data/mock.ts', 'utf-8');

// I also need to ensure that the actual mapping indices are correct in the final teams array.
// Let's write a script to automatically detect the new indices and rewrite the games array safely.
let teamsCode = mock.substring(mock.indexOf('export const teams: Team[] = ['), mock.indexOf('];\n\nexport const players: PlayerProfile[] = [') + 1);

let gamesCode = mock.substring(mock.indexOf('export const games: Game[] = ['), mock.indexOf('];\n\nexport const products: Product[] = [') + 1);

// original mapping:
const originalMap = [
  't1', 't2', 't3', 't8', 't4', 't5', 't6', 't7', 't9', 't10', 't11', 't12'
];
// In original games:
// g1: 0, 1 -> t1 vs t2
// g2: 3, 4 -> t8 vs t4
// g3: 5, 6 -> t5 vs t6
// g4: 2, 7 -> t3 vs t7
// g5: 4, 3 -> t4 vs t8
// g6: 1, 2 -> t2 vs t3

const tIdRegex = /id:\s*'([^']+)'/g;
let match;
let newMap = [];
while ((match = tIdRegex.exec(teamsCode)) !== null) {
  newMap.push(match[1]);
}

console.log('New teams mapped:', newMap);

const t1_idx = newMap.indexOf('t1');
const t2_idx = newMap.indexOf('t2');
const t3_idx = newMap.indexOf('t3');
const t8_idx = newMap.indexOf('t8');
const t4_idx = newMap.indexOf('t4');
const t5_idx = newMap.indexOf('t5');
const t6_idx = newMap.indexOf('t6');
const t7_idx = newMap.indexOf('t7');

let fixedGames = `export const games: Game[] = [
  { id: 'g1', leagueId: 'sbbl', homeTeam: teams[${t1_idx}], awayTeam: teams[${t2_idx}], venue: 'Panalay Arena', court: 'Court 1', date: '2026-03-29', time: '14:00', status: 'live', score: { home: 67, away: 62 }, ppvPrice: 2.50 },
  { id: 'g2', leagueId: 'wbl', homeTeam: teams[${t8_idx}], awayTeam: teams[${t4_idx}], venue: 'La Liga Sports Complex', court: 'Main Court', date: '2026-03-28', time: '16:00', status: 'upcoming', ppvPrice: 2.50 },
  { id: 'g3', leagueId: 'tgifbl', homeTeam: teams[${t5_idx}], awayTeam: teams[${t6_idx}], venue: 'Tat Stadium', court: 'Court A', date: '2026-03-27', time: '19:00', status: 'final', score: { home: 88, away: 79 }, ppvPrice: 2.50 },
  { id: 'g4', leagueId: 'sbbl', homeTeam: teams[${t3_idx}], awayTeam: teams[${t7_idx}], venue: 'Panalay Arena', court: 'Court 2', date: '2026-03-30', time: '10:00', status: 'upcoming', ppvPrice: 2.50 },
  { id: 'g5', leagueId: 'wbl', homeTeam: teams[${t4_idx}], awayTeam: teams[${t8_idx}], venue: 'La Liga Sports Complex', court: 'Court 2', date: '2026-04-04', time: '15:00', status: 'upcoming', ppvPrice: 2.50 },
  { id: 'g6', leagueId: 'sbbl', homeTeam: teams[${t2_idx}], awayTeam: teams[${t3_idx}], venue: 'Panalay Arena', court: 'Court 1', date: '2026-03-22', time: '14:00', status: 'final', score: { home: 75, away: 71 }, ppvPrice: 2.50 },
];`;

const startIdx = mock.indexOf('export const games: Game[] = [');
const endIdx = mock.indexOf('];\n\nexport const products: Product[] = [') + 2;

mock = mock.substring(0, startIdx) + fixedGames + mock.substring(endIdx);
fs.writeFileSync('src/data/mock.ts', mock);
