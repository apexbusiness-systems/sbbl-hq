import fs from 'fs';

const mock = fs.readFileSync('src/data/mock.ts', 'utf-8');

// Ensure there are 38 teams (4 SBBL, 17 TGIF, 17 WBL)
const teamsMatch = mock.match(/\{ id: 't\d+', name: '[^']+'/g);
console.log('Total Teams:', teamsMatch.length);
if (teamsMatch.length !== 38) {
  console.log('ERROR: Expected 38 teams, got ' + teamsMatch.length);
}

// Ensure 2026-04-03 was changed in schedules.ts
let sched = fs.readFileSync('src/data/schedules.ts', 'utf-8');
if (sched.includes('2026-04-03')) {
  console.log('Fixing schedules.ts...');
  sched = sched.replace(/2026-04-03/g, '2026-04-02');
  fs.writeFileSync('src/data/schedules.ts', sched);
  console.log('Done fixing schedules.ts');
} else {
  console.log('schedules.ts is correct.');
}
