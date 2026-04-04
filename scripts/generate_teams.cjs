const fs = require('fs');

// We have 34 static teams in teams.ts. We need to preserve the existing SBBL teams from mock.ts
const existingSbbl = [
  { id: 't1', name: 'Panalay Kings', leagueId: 'sbbl', division: 'Panalay A', record: { wins: 8, losses: 2 } },
  { id: 't2', name: 'Solid North', leagueId: 'sbbl', division: 'Panalay A', record: { wins: 7, losses: 3 } },
  { id: 't3', name: 'Gensan Warriors', leagueId: 'sbbl', division: 'Panalay A', record: { wins: 6, losses: 4 } },
  { id: 't8', name: 'Rim Rattlers', leagueId: 'sbbl', division: 'Panalay B', record: { wins: 5, losses: 5 } },
];

const staticTeams = [
  { name: 'Solid North', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'OSY x LCL', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'Batang Riles x Tri J', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'J Elite', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'YG', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'Conceited Fantasy', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'C&F', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'City Above Elite', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'Over Under', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'Full Time Ballers', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'DBRKDZ', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'BLBG', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'Mantiku', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'Fourteen Ounce', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'Ball is Life', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'JC Trans Jrs', leagueId: 'tgifbl', season: 'Season 1' },
  { name: 'Banayad Hoopers', leagueId: 'tgifbl', season: 'Season 1' },

  { name: 'OSY', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Rebelde Jrs', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Solid North', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Crosslinx Warriors', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Rebelde', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Downtown', leagueId: 'wbl', season: 'Season 3' },
  { name: 'La Liga Elite', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Blacksmith', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Splash', leagueId: 'wbl', season: 'Season 3' },
  { name: 'SPG', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Harina x Wild Dogs', leagueId: 'wbl', season: 'Season 3' },
  { name: 'NSD', leagueId: 'wbl', season: 'Season 3' },
  { name: '4Lifers', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Serviteurs', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Batang Kanto', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Disciples', leagueId: 'wbl', season: 'Season 3' },
  { name: 'Ball is Life', leagueId: 'wbl', season: 'Season 3' },
];

let nextId = 1;
// we want to ensure t1, t2, t3, t8 map to the SBBL ones so let's just make sure all original IDs map to the right place.
const newTeams = [...existingSbbl];

const existingIds = new Set(existingSbbl.map(t => t.id));

let currentWblId = 4; // Use t4, t5, t9, t10, t11, t12, then t13+ for WBL
let currentTgifId = 6; // Use t6, t7, then whatever

// We should replace any existing WBL/TGIFBL teams that match the static ones, or just completely replace WBL and TGIF teams.
// The problem asks to "incorporate ALL 34 of these teams as realistic, 1:1 records into mock.ts".
// For existing WBL/TGIF teams in mock.ts:
// t4: Weekend Warriors (WBL) -> not in static teams
// t5: La Liga Legends (WBL) -> not in static teams
// t6: Friday Flames (TGIFBL) -> not in static teams
// t7: Tat Stadium Elite (TGIFBL) -> not in static teams
// t9: OSY Phoenix (WBL) -> not in static teams
// t10: Ball is Life (WBL) -> YES in static teams
// t11: Rebelde (WBL) -> YES in static teams
// t12: Splash (WBL) -> YES in static teams

// To not break players/games linked to t4, t5, t6, t7, t9, t10, t11, t12, let's map the old mock team names to static names:
// Let's replace:
// t4 -> 'Crosslinx Warriors'
// t5 -> 'La Liga Elite'
// t6 -> 'Solid North'
// t7 -> 'OSY x LCL'
// t9 -> 'OSY'
// t10 -> 'Ball is Life' (already there)
// t11 -> 'Rebelde' (already there)
// t12 -> 'Splash' (already there)

const mapIdToName = {
  't4': 'Crosslinx Warriors',
  't5': 'La Liga Elite',
  't6': 'Solid North', // TGIF
  't7': 'OSY x LCL', // TGIF
  't9': 'OSY', // WBL
  't10': 'Ball is Life', // WBL
  't11': 'Rebelde', // WBL
  't12': 'Splash' // WBL
};

const mapNameToId = {};
for (const [id, name] of Object.entries(mapIdToName)) {
  mapNameToId[name] = id;
}

let nextAvailableId = 13;

for (const t of staticTeams) {
  let id;
  // NOTE: There are TWO "Solid North", one TGIF and one WBL. Same for "Ball is Life".
  // So mapNameToId should be unique by league+name
  const key = `${t.leagueId}-${t.name}`;
  if (key === 'tgifbl-Solid North') id = 't6';
  else if (key === 'tgifbl-OSY x LCL') id = 't7';
  else if (key === 'wbl-Crosslinx Warriors') id = 't4';
  else if (key === 'wbl-La Liga Elite') id = 't5';
  else if (key === 'wbl-OSY') id = 't9';
  else if (key === 'wbl-Ball is Life') id = 't10';
  else if (key === 'wbl-Rebelde') id = 't11';
  else if (key === 'wbl-Splash') id = 't12';
  else {
    id = `t${nextAvailableId++}`;
  }

  // Assign random W/L record and group for mockup
  const wins = Math.floor(Math.random() * 8);
  const losses = Math.floor(Math.random() * 5);
  const div = t.leagueId === 'wbl' ? 'Main' : 'Group 1';

  newTeams.push({
    id,
    name: t.name,
    leagueId: t.leagueId,
    division: div,
    record: { wins, losses }
  });
}

// Ensure the final teams array has the exact original objects for the unmapped ones
console.log(JSON.stringify(newTeams, null, 2));
