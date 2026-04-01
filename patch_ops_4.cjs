const fs = require('fs');
const file = 'src/pages/Ops.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("import { apiFetch }")) {
  code = code.replace(
    `import { fetchOpsBootstrap`,
    `import { apiFetch } from '@/lib/api/client';\nimport { IDEMPOTENCY_HEADER, createIdempotencyKey } from '@/lib/api/idempotency';\nimport { fetchOpsBootstrap`
  );
}

if (!code.includes("const [editModal, setEditModal]")) {
  code = code.replace(
    `const [potgForm, setPotgForm] = useState`,
    `const [editModal, setEditModal] = useState<{ table: 'teams' | 'players' | 'products' | 'league_events'; id: string; fields: Record<string, string> } | null>(null);\n  const [deleteTarget, setDeleteTarget] = useState<{ table: string; id: string; name: string } | null>(null);\n  const [potgForm, setPotgForm] = useState`
  );
}

code = code.replace(/<Loader className/g, `<Loader2 className`);
code = code.replace(/<CheckIcon className/g, `<CheckCircle2 className`);
code = code.replace(/<X className/g, `<AlertCircle className`); // Hacky fallback to prevent unknown icon if not imported
code = code.replace(/<Trash2/g, `<AlertCircle`);
code = code.replace(/<Edit2/g, `<FileText`);
// To be safe we'll import exactly what we need
code = code.replace(
  `import { Shield, Upload, Loader2, CheckCircle2, AlertCircle, Trophy } from 'lucide-react';`,
  `import { Shield, Upload, Loader2, CheckCircle2, AlertCircle, Trophy, Edit2, Trash2, X, Check as CheckIcon } from 'lucide-react';`
);

// We'll revert the hacky icon replacements to keep standard ones since we've added the imports
code = code.replace(/<AlertCircle className="w-4 h-4" \/><\/button>\s*<\/div>\s*\{Object/g, `<X className="w-4 h-4" /></button></div>{Object`);
code = code.replace(/<AlertCircle className="w-3.5 h-3.5" \/><\/button>\s*<\/div>\s*\{entityListQuery/g, `<Trash2 className="w-3.5 h-3.5" /></button></div>{entityListQuery`);

// Convert "value={val}" in map of editModal fields to be casted to string
code = code.replace(
  `value={val}`,
  `value={val as string}`
);

fs.writeFileSync(file, code);
