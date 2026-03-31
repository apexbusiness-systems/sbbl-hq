const fs = require('fs');
const path = require('path');

const livePath = path.join(__dirname, 'src', 'pages', 'Live.tsx');
let liveCode = fs.readFileSync(livePath, 'utf8');

// Replace mock products, players
liveCode = liveCode.replace(
  /const featuredProducts = products\.filter\(p => p\.sale\);/s,
  `const featuredProducts: any[] = [];`
);

liveCode = liveCode.replace(
  /\{players\.slice\(0, 3\)\.map\(p => \(/s,
  `{[]} { /* players.slice(0,3) */ } { [].map(p => (`
);

// We should just use empty arrays for now, or use actual API endpoints.
fs.writeFileSync(livePath, liveCode);
