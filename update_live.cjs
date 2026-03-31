const fs = require('fs');
const path = require('path');

const livePath = path.join(__dirname, 'src', 'pages', 'Live.tsx');
let liveCode = fs.readFileSync(livePath, 'utf8');

liveCode = liveCode.replace(
  "import { games, players, products } from '@/data/mock';\n",
  ""
);

// We need to fetch real data or show empty state.
// We'll replace the static mock variables.
liveCode = liveCode.replace(
  /const liveGame = games\.find\(g => g\.status === 'live'\) \|\| games\[0\];/,
  `// TODO: Fetch real live game from API.
  const liveGame = undefined;`
);

// To fix it properly according to instructions:
// "Replace Live page mock with real data + empty state"
// "Minimum viable fix is to remove mock data, show real upcoming/live games from the API, and disable the fake chat/reactions or replace with "Coming soon" UX."

fs.writeFileSync(livePath, liveCode);
