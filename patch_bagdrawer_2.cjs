const fs = require('fs');
const file = 'src/components/layout/BagDrawer.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(`import { useQuery } from '@tanstack/react-query';\nimport { apiFetch } from '@/lib/api/client';`, `import { useQuery } from '@tanstack/react-query';`);
code = code.replace(/import { apiFetch } from '@\/lib\/api\/client';\nimport { apiFetch } from '@\/lib\/api\/client';/g, `import { apiFetch } from '@/lib/api/client';`);

// Find duplicate imports
code = [...new Set(code.split('\n'))].join('\n'); // not perfect but helps with full lines

fs.writeFileSync(file, code);
