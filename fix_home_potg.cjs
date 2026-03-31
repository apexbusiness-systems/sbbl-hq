const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, 'src', 'pages', 'Home.tsx');
let homeCode = fs.readFileSync(homePath, 'utf8');

homeCode = homeCode.replace(
  /const potgList = \(playersOfTheGame \|\| \[\]\)\.map\(\(job: any\) => \(\{/,
  `const playersOfTheGame: any[] = potgQuery.data?.data || [];
  const potgList = (playersOfTheGame || []).map((job: any) => ({`
);

fs.writeFileSync(homePath, homeCode);
