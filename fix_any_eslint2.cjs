const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, 'src', 'pages', 'Home.tsx');
let homeCode = fs.readFileSync(homePath, 'utf8');

homeCode = homeCode.replace(
  /apiFetch<\{ ok: boolean; data: Record<string, unknown>\[\] \}>\('\/\/api\/public\/potg\?league=' \+ activeLeague\.toLowerCase\(\) \+ '&limit=4'\),/,
  `apiFetch<{ ok: boolean; data: PotgJob[] }>('/api/public/potg?league=' + activeLeague.toLowerCase() + '&limit=4'),`
);

homeCode = homeCode.replace(
  /const playersOfTheGame: Record<string, unknown>\[\] = potgQuery\.data\?\.data \|\| \[\];/,
  `const playersOfTheGame: PotgJob[] = potgQuery.data?.data || [];`
);

fs.writeFileSync(homePath, homeCode);
