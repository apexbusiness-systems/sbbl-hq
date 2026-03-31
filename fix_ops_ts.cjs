const fs = require('fs');
const path = require('path');

const opsPath = path.join(__dirname, 'src', 'pages', 'Ops.tsx');
let opsCode = fs.readFileSync(opsPath, 'utf8');

if (!opsCode.includes(`import { apiFetch } from '@/lib/api/client';`)) {
  opsCode = opsCode.replace(
    /import \{ useMutation, useQuery, useQueryClient \} from '@tanstack\/react-query';/,
    `import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';\nimport { apiFetch } from '@/lib/api/client';`
  );
  fs.writeFileSync(opsPath, opsCode);
}
