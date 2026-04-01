const fs = require('fs');
const file = 'src/pages/Ops.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `import { Upload, Settings, Users, Calendar, AlertCircle, CheckCircle2, FileText, Database, Shield, Zap, RefreshCw, Trophy, Crown, Camera } from 'lucide-react';`,
  `import { Upload, Settings, Users, Calendar, AlertCircle, CheckCircle2, FileText, Database, Shield, Zap, RefreshCw, Trophy, Crown, Camera, Edit2, Trash2, X, Check as CheckIcon, Loader2 as Loader } from 'lucide-react';`
);

if (!code.includes("import { apiFetch }")) {
  code = code.replace(
    `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';`,
    `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { apiFetch } from '@/lib/api/client';\nimport { IDEMPOTENCY_HEADER, createIdempotencyKey } from '@/lib/api/idempotency';`
  );
}

if (!code.includes("const [editModal, setEditModal]")) {
  code = code.replace(
    `const [csvContent, setCsvContent] = useState<string>('');`,
    `const [csvContent, setCsvContent] = useState<string>('');\n  const [editModal, setEditModal] = useState<{ table: 'teams' | 'players' | 'products' | 'league_events'; id: string; fields: Record<string, string> } | null>(null);\n  const [deleteTarget, setDeleteTarget] = useState<{ table: string; id: string; name: string } | null>(null);`
  );
}

// Convert "value={val}" in map of editModal fields to be casted to string
code = code.replace(
  `value={val}`,
  `value={val as string}`
);

fs.writeFileSync(file, code);
