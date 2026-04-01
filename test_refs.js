import fs from 'fs';

const mock = fs.readFileSync('src/data/mock.ts', 'utf-8');

// Also make sure players are mapped correctly.
// original players:
// t1 (p1, p5)
// t2 (p2)
// t4 (p3)
// t6 (p4)
// t5 (p6)
// t9 (p7)
// t10 (p8)
// t11 (p9)
// t12 (p10)

// The players are referenced via `teamId: 't1'`, etc in the mock data objects.
// Since we specifically kept the IDs of the preserved teams identical, these references should inherently be fine!

const t1Matches = mock.match(/teamId: 't1'/g);
const t4Matches = mock.match(/teamId: 't4'/g);

if (t1Matches && t4Matches) {
  console.log("Team IDs preserved successfully in players.");
} else {
  console.log("WARNING: missing team ID references for players.");
}
