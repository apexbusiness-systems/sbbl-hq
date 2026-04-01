const fs = require('fs');
const file = 'src/pages/Ops.tsx';
let code = fs.readFileSync(file, 'utf8');

// 9A Imports
code = code.replace(
  `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';`,
  `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';` // actually no-op
);
code = code.replace(
  `import { Upload, Settings, Users, Calendar, AlertCircle, CheckCircle2, FileText, Database, Shield, Zap, RefreshCw, Trophy, Crown, Camera } from 'lucide-react';`,
  `import { Upload, Settings, Users, Calendar, AlertCircle, CheckCircle2, FileText, Database, Shield, Zap, RefreshCw, Trophy, Crown, Camera, Edit2, Trash2, X, Check as CheckIcon, Loader2 as Loader } from 'lucide-react';`
);

// 9B New state
code = code.replace(
  `  const [csvContent, setCsvContent] = useState<string>('');`,
  `  const [csvContent, setCsvContent] = useState<string>('');\n  const [editModal, setEditModal] = useState<{ table: 'teams' | 'players' | 'products' | 'league_events'; id: string; fields: Record<string, string> } | null>(null);\n  const [deleteTarget, setDeleteTarget] = useState<{ table: string; id: string; name: string } | null>(null);`
);

// 9C New queries
code = code.replace(
  `  const historyQuery = useQuery({`,
  `  const entityListQuery = useQuery({\n    queryKey: ['ops-list', activeTab],\n    queryFn: () => apiFetch<{ ok: boolean; data: Array<Record<string, unknown>> }>(\`/ops/list/\${activeTab === 'events' ? 'events' : activeTab}\`),\n    enabled: ['teams', 'players', 'events'].includes(activeTab),\n    staleTime: 30_000,\n  });\n\n  const editMutation = useMutation({\n    mutationFn: ({ table, id, patch }: { table: string; id: string; patch: Record<string, unknown> }) =>\n      apiFetch(\`/ops/\${table}/\${id}\`, {\n        method: 'PATCH',\n        headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(\`edit-\${table}-\${id}\`) },\n        body: JSON.stringify(patch),\n      }),\n    onSuccess: () => {\n      queryClient.invalidateQueries({ queryKey: ['ops-list'] });\n      setEditModal(null);\n    },\n  });\n\n  const deleteMutation = useMutation({\n    mutationFn: ({ table, id }: { table: string; id: string }) =>\n      apiFetch(\`/ops/\${table}/\${id}\`, {\n        method: 'DELETE',\n        headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey(\`delete-\${table}-\${id}\`) },\n      }),\n    onSuccess: () => {\n      queryClient.invalidateQueries({ queryKey: ['ops-list'] });\n      setDeleteTarget(null);\n    },\n  });\n\n  const historyQuery = useQuery({`
);

// 9D Modals
const modalsCode = `      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setEditModal(null)} />
          <div className="relative panel p-5 w-full max-w-md space-y-4 z-10">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold capitalize">Edit {editModal.table.replace('_', ' ')}</h3>
              <button onClick={() => setEditModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {Object.entries(editModal.fields).map(([key, val]) => (
              <div key={key}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">{key.replace(/_/g, ' ')}</label>
                <input
                  className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm"
                  value={val}
                  onChange={e => setEditModal(m => m ? { ...m, fields: { ...m.fields, [key]: e.target.value } } : null)}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => editMutation.mutate({ table: editModal.table, id: editModal.id, patch: editModal.fields })}
                disabled={editMutation.isPending}
                className="flex-1 gold-bg py-2 text-sm font-display font-bold uppercase tracking-wider rounded-sm disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {editMutation.isPending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckIcon className="w-3.5 h-3.5" />}
                Save Changes
              </button>
              <button onClick={() => setEditModal(null)} className="px-4 py-2 text-sm border border-border rounded-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
            {editMutation.error && <p className="text-xs text-destructive">{(editMutation.error as Error).message}</p>}
          </div>
        </div>
      )}

      {/* Delete / Archive Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative panel p-5 w-full max-w-sm space-y-4 z-10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display font-bold text-base">Archive {deleteTarget.name}?</h3>
                <p className="text-xs text-muted-foreground mt-1">This will soft-archive the record. It will not appear in any public views. Action is logged and reversible by a super admin.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => deleteMutation.mutate({ table: deleteTarget.table, id: deleteTarget.id })}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-destructive text-destructive-foreground py-2 text-sm font-display font-bold uppercase tracking-wider rounded-sm disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Archive
              </button>
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-border rounded-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
            {deleteMutation.error && <p className="text-xs text-destructive">{(deleteMutation.error as Error).message}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default OpsPage;`;

code = code.replace(/    <\/div>\s*  \);\s*};\s*export default OpsPage;/g, modalsCode);

// 9E Entity list block
const listBlock = `          {/* Live Entity List */}
          {['teams', 'players', 'events'].includes(activeTab) && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider">
                  Existing {activeTab} ({entityListQuery.data?.data?.length ?? 0})
                </h3>
                {entityListQuery.isFetching && <Loader className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </div>

              {entityListQuery.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
              {entityListQuery.isError && <p className="text-xs text-destructive">Failed to load entity list.</p>}

              {!entityListQuery.isLoading && (entityListQuery.data?.data ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No records yet. Use CSV import above to add data.</p>
              )}

              <div className="space-y-1 max-h-80 overflow-y-auto">
                {(entityListQuery.data?.data ?? []).map((row) => {
                  const id = String(row.id ?? '');
                  const name = String(row.name ?? row.title ?? row.display_name ?? id.slice(0, 8));
                  const sub = String(
                    (row.leagues as Record<string, unknown> | null)?.code ??
                    (row.teams as Record<string, unknown> | null)?.name ??
                    row.league_id ?? ''
                  );

                  // Build editable fields based on current tab
                  const editFields: Record<string, string> = activeTab === 'teams'
                    ? { name: String(row.name ?? '') }
                    : activeTab === 'players'
                    ? { jersey_number: String(row.jersey_number ?? ''), position: String(row.position ?? '') }
                    : { title: String(row.title ?? ''), starts_at: String(row.starts_at ?? '') };

                  const tableKey = (activeTab === 'events' ? 'league_events' : activeTab) as 'teams' | 'players' | 'league_events';

                  return (
                    <div key={id} className="flex items-center gap-3 p-2.5 bg-secondary rounded-sm border border-border/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{name}</p>
                        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
                      </div>
                      <button
                        onClick={() => setEditModal({ table: tableKey, id, fields: editFields })}
                        className="p-1.5 rounded-sm hover:bg-card text-muted-foreground hover:text-primary transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ table: tableKey, id, name })}
                        className="p-1.5 rounded-sm hover:bg-card text-muted-foreground hover:text-destructive transition-colors"
                        title="Archive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }`;

code = code.replace(/        <\/div>\s*\);\s*\}/g, listBlock);

fs.writeFileSync(file, code);
