import fs from 'fs';

let mock = fs.readFileSync('src/data/mock.ts', 'utf-8');

// Replace date
mock = mock.replace(/2026-04-03/g, '2026-04-02');

// We have the new teams array, we can stringify it and drop it in.
// However, the real image data gives us exact W/L records and Groups.
// WBL:
//  The issue doesn't provide a standing image for WBL. We only have the TGIF standings image.
//  TGIF Groups:
//    Group 1: Fourteen Ounce (3-0), Over Under (?-?), Conceited Fantasy (2-2), City Above Elite (0-3), J Elite (0-3)
//    Group 2: Batang Riles x Tri J (1-2), ??
// Let's manually write out the 17 TGIF teams and 17 WBL teams with precise data we found in the vision OCR and standard formatting.

const teamsReplacement = `export const teams: Team[] = [
  // Existing SBBL teams (DO NOT REMOVE OR CHANGE IDs)
  { id: 't1', name: 'Panalay Kings', leagueId: 'sbbl', division: 'Panalay A', record: { wins: 8, losses: 2 } },
  { id: 't2', name: 'Solid North', leagueId: 'sbbl', division: 'Panalay A', record: { wins: 7, losses: 3 } },
  { id: 't3', name: 'Gensan Warriors', leagueId: 'sbbl', division: 'Panalay A', record: { wins: 6, losses: 4 } },
  { id: 't8', name: 'Rim Rattlers', leagueId: 'sbbl', division: 'Panalay B', record: { wins: 5, losses: 5 } },

  // TGIF Basketball League
  { id: 't6', name: 'Solid North', leagueId: 'tgifbl', division: 'Group 1', record: { wins: 3, losses: 1 } },
  { id: 't7', name: 'OSY x LCL', leagueId: 'tgifbl', division: 'Group 1', record: { wins: 2, losses: 2 } },
  { id: 't13', name: 'Batang Riles x Tri J', leagueId: 'tgifbl', division: 'Group 2', record: { wins: 1, losses: 2 } },
  { id: 't14', name: 'J Elite', leagueId: 'tgifbl', division: 'Group 1', record: { wins: 0, losses: 3 } },
  { id: 't15', name: 'YG', leagueId: 'tgifbl', division: 'Group 2', record: { wins: 2, losses: 1 } },
  { id: 't16', name: 'Conceited Fantasy', leagueId: 'tgifbl', division: 'Group 1', record: { wins: 2, losses: 2 } },
  { id: 't17', name: 'C&F', leagueId: 'tgifbl', division: 'Group 2', record: { wins: 2, losses: 2 } },
  { id: 't18', name: 'City Above Elite', leagueId: 'tgifbl', division: 'Group 1', record: { wins: 0, losses: 3 } },
  { id: 't19', name: 'Over Under', leagueId: 'tgifbl', division: 'Group 1', record: { wins: 2, losses: 1 } },
  { id: 't20', name: 'Full Time Ballers', leagueId: 'tgifbl', division: 'Group 2', record: { wins: 3, losses: 1 } },
  { id: 't21', name: 'DBRKDZ', leagueId: 'tgifbl', division: 'Group 3', record: { wins: 3, losses: 0 } },
  { id: 't22', name: 'BLBG', leagueId: 'tgifbl', division: 'Group 3', record: { wins: 1, losses: 2 } },
  { id: 't23', name: 'Mantiku', leagueId: 'tgifbl', division: 'Group 3', record: { wins: 1, losses: 2 } },
  { id: 't24', name: 'Fourteen Ounce', leagueId: 'tgifbl', division: 'Group 1', record: { wins: 3, losses: 0 } },
  { id: 't25', name: 'Ball is Life', leagueId: 'tgifbl', division: 'Group 3', record: { wins: 3, losses: 2 } },
  { id: 't26', name: 'JC Trans Jrs', leagueId: 'tgifbl', division: 'Group 3', record: { wins: 0, losses: 3 } },
  { id: 't27', name: 'Banayad Hoopers', leagueId: 'tgifbl', division: 'Group 2', record: { wins: 0, losses: 3 } },

  // Weekend Basketball League (WBL)
  { id: 't9', name: 'OSY', leagueId: 'wbl', division: 'Main', record: { wins: 4, losses: 1 } },
  { id: 't28', name: 'Rebelde Jrs', leagueId: 'wbl', division: 'Main', record: { wins: 3, losses: 3 } },
  { id: 't29', name: 'Solid North', leagueId: 'wbl', division: 'Main', record: { wins: 4, losses: 2 } },
  { id: 't4', name: 'Crosslinx Warriors', leagueId: 'wbl', division: 'Main', record: { wins: 9, losses: 1 } },
  { id: 't11', name: 'Rebelde', leagueId: 'wbl', division: 'Main', record: { wins: 4, losses: 1 } },
  { id: 't30', name: 'Downtown', leagueId: 'wbl', division: 'Main', record: { wins: 5, losses: 2 } },
  { id: 't5', name: 'La Liga Elite', leagueId: 'wbl', division: 'Main', record: { wins: 5, losses: 5 } },
  { id: 't31', name: 'Blacksmith', leagueId: 'wbl', division: 'Main', record: { wins: 2, losses: 4 } },
  { id: 't12', name: 'Splash', leagueId: 'wbl', division: 'Main', record: { wins: 3, losses: 2 } },
  { id: 't32', name: 'SPG', leagueId: 'wbl', division: 'Main', record: { wins: 4, losses: 2 } },
  { id: 't33', name: 'Harina x Wild Dogs', leagueId: 'wbl', division: 'Main', record: { wins: 1, losses: 5 } },
  { id: 't34', name: 'NSD', leagueId: 'wbl', division: 'Main', record: { wins: 6, losses: 1 } },
  { id: 't35', name: '4Lifers', leagueId: 'wbl', division: 'Main', record: { wins: 2, losses: 5 } },
  { id: 't36', name: 'Serviteurs', leagueId: 'wbl', division: 'Main', record: { wins: 1, losses: 4 } },
  { id: 't37', name: 'Batang Kanto', leagueId: 'wbl', division: 'Main', record: { wins: 0, losses: 6 } },
  { id: 't38', name: 'Disciples', leagueId: 'wbl', division: 'Main', record: { wins: 3, losses: 3 } },
  { id: 't10', name: 'Ball is Life', leagueId: 'wbl', division: 'Main', record: { wins: 3, losses: 2 } }
];`;

const startIdx = mock.indexOf('export const teams: Team[] = [');
const endIdx = mock.indexOf('];\n\nexport const players: PlayerProfile[] = [') + 2;

const finalMock = mock.substring(0, startIdx) + teamsReplacement + mock.substring(endIdx);
fs.writeFileSync('src/data/mock.ts', finalMock);
