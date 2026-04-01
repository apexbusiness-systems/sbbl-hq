const fs = require('fs');
const file = 'src/pages/Profiles.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(`import { players, teams as mockTeams, leagues } from '@/data/mock';`, `import { leagues } from '@/data/mock';\nconst players: any[] = [];`);
code = code.replace(`return mockTeams;`, `return teamsQuery.data?.teams ?? [];`);

fs.writeFileSync(file, code);
