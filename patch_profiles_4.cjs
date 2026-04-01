const fs = require('fs');
const file = 'src/pages/Profiles.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(`import { leagues } from '@/data/mock';\nconst players: Record<string, unknown>[] = [];`, `import { leagues } from '@/data/mock';\nimport type { PlayerProfile } from '@/types';\nconst players: PlayerProfile[] = [];`);

fs.writeFileSync(file, code);
