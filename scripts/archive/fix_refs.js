import fs from 'fs';

let mock = fs.readFileSync('src/data/mock.ts', 'utf-8');

// The original teams were indexed 0 to 11.
// 0: t1 (SBBL) - Panalay Kings -> index 0
// 1: t2 (SBBL) - Solid North -> index 1
// 2: t3 (SBBL) - Gensan Warriors -> index 2
// 3: t8 (SBBL) - Rim Rattlers -> index 3
// 4: t4 (WBL) - Weekend Warriors -> Crosslinx Warriors (t4) -> index 24
// 5: t5 (WBL) - La Liga Legends -> La Liga Elite (t5) -> index 27
// 6: t6 (TGIFBL) - Friday Flames -> Solid North (t6) -> index 4
// 7: t7 (TGIFBL) - Tat Stadium Elite -> OSY x LCL (t7) -> index 5
// 8: t9 (WBL) - OSY Phoenix -> OSY (t9) -> index 21
// 9: t10 (WBL) - Ball is Life -> Ball is Life (t10) -> index 37
// 10: t11 (WBL) - Rebelde -> Rebelde (t11) -> index 25
// 11: t12 (WBL) - Splash -> Splash (t12) -> index 29

// We need to fix the `games` array references.
// Previous games array:
//  { id: 'g1', homeTeam: teams[0], awayTeam: teams[1] } // Panalay Kings vs Solid North (0 vs 1) -> 0 vs 1
//  { id: 'g2', homeTeam: teams[3], awayTeam: teams[4] } // Rim Rattlers (3) vs Weekend Warriors (4) -> 3 vs 24
//  { id: 'g3', homeTeam: teams[5], awayTeam: teams[6] } // La Liga Legends (5) vs Friday Flames (6) -> 27 vs 4
//  { id: 'g4', homeTeam: teams[2], awayTeam: teams[7] } // Gensan Warriors (2) vs Tat Stadium Elite (7) -> 2 vs 5
//  { id: 'g5', homeTeam: teams[4], awayTeam: teams[3] } // Weekend Warriors (4) vs Rim Rattlers (3) -> 24 vs 3
//  { id: 'g6', homeTeam: teams[1], awayTeam: teams[2] } // Solid North (1) vs Gensan Warriors (2) -> 1 vs 2

let gamesStr = `export const games: Game[] = [
  { id: 'g1', leagueId: 'sbbl', homeTeam: teams[0], awayTeam: teams[1], venue: 'Panalay Arena', court: 'Court 1', date: '2026-03-29', time: '14:00', status: 'live', score: { home: 67, away: 62 }, ppvPrice: 2.50 },
  { id: 'g2', leagueId: 'wbl', homeTeam: teams[3], awayTeam: teams[24], venue: 'La Liga Sports Complex', court: 'Main Court', date: '2026-03-28', time: '16:00', status: 'upcoming', ppvPrice: 2.50 },
  { id: 'g3', leagueId: 'tgifbl', homeTeam: teams[27], awayTeam: teams[4], venue: 'Tat Stadium', court: 'Court A', date: '2026-03-27', time: '19:00', status: 'final', score: { home: 88, away: 79 }, ppvPrice: 2.50 },
  { id: 'g4', leagueId: 'sbbl', homeTeam: teams[2], awayTeam: teams[5], venue: 'Panalay Arena', court: 'Court 2', date: '2026-03-30', time: '10:00', status: 'upcoming', ppvPrice: 2.50 },
  { id: 'g5', leagueId: 'wbl', homeTeam: teams[24], awayTeam: teams[3], venue: 'La Liga Sports Complex', court: 'Court 2', date: '2026-04-04', time: '15:00', status: 'upcoming', ppvPrice: 2.50 },
  { id: 'g6', leagueId: 'sbbl', homeTeam: teams[1], awayTeam: teams[2], venue: 'Panalay Arena', court: 'Court 1', date: '2026-03-22', time: '14:00', status: 'final', score: { home: 75, away: 71 }, ppvPrice: 2.50 },
];`;

const startIdx = mock.indexOf('export const games: Game[] = [');
const endIdx = mock.indexOf('];\n\nexport const products: Product[] = [') + 2;

mock = mock.substring(0, startIdx) + gamesStr + mock.substring(endIdx);

fs.writeFileSync('src/data/mock.ts', mock);
console.log('Fixed game references in mock.ts');
