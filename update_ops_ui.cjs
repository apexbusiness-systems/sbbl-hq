const fs = require('fs');
const path = require('path');

const opsPath = path.join(__dirname, 'src', 'pages', 'Ops.tsx');
let opsCode = fs.readFileSync(opsPath, 'utf8');

opsCode = opsCode.replace(
  /const \[activeTab, setActiveTab\] = useState<Tab>\('overview'\);/,
  `const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editTarget, setEditTarget] = useState<any | null>(null);

  const editMutation = useMutation({
    mutationFn: ({ type, id, patch }: { type: string; id: string; patch: Record<string, unknown> }) =>
      apiFetch(\`/ops/\${type}/\${id}\`, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': \`edit-\${type}-\${id}-\${Date.now()}\` },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
      setEditTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) =>
      apiFetch(\`/ops/\${type}/\${id}\`, {
        method: 'DELETE',
        headers: { 'Idempotency-Key': \`delete-\${type}-\${id}-\${Date.now()}\` },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] }),
  });`
);

// We need to inject the Edit form and List into the existing tabs. Since the CSV form is what is currently present for Teams/Players, we can append the list below it.
opsCode = opsCode.replace(
  /\{\(activeTab === 'teams' \|\| activeTab === 'players' \|\| activeTab === 'schedules' \|\| activeTab === 'events'\) && \(/,
  `{(activeTab === 'teams' || activeTab === 'players' || activeTab === 'schedules' || activeTab === 'events') && (
        <div className="space-y-8">
          {/* Edit Modal / Inline Edit Form */}
          {editTarget && editTarget.type === activeTab && (
            <div className="panel p-4 mb-4 border-primary">
              <h3 className="font-bold mb-2">Edit {activeTab}</h3>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  className="bg-secondary px-3 py-2 rounded-sm flex-1 text-sm"
                  value={editTarget.name || ''}
                  onChange={e => setEditTarget({...editTarget, name: e.target.value})}
                  placeholder="Name"
                />
                <button
                  onClick={() => editMutation.mutate({ type: activeTab, id: editTarget.id, patch: { name: editTarget.name } })}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-sm text-sm font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditTarget(null)}
                  className="bg-secondary text-secondary-foreground px-4 py-2 rounded-sm text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* List Entities */}
          <div className="panel p-4">
            <h3 className="font-bold mb-4 capitalize">{activeTab} Directory</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {(bootstrapQuery.data?.references?.[activeTab] || []).map((entity: any) => (
                <div key={entity.id} className="flex items-center justify-between p-2 hover:bg-secondary/50 rounded-sm border-b border-border last:border-0">
                  <div>
                    <span className="text-sm font-medium">{entity.name || entity.title || entity.id}</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditTarget({ type: activeTab, ...entity })}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(\`Archive this item? This cannot be undone from the UI.\`)) return;
                        deleteMutation.mutate({ type: activeTab, id: entity.id });
                      }}
                      className="text-xs text-destructive hover:underline"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-sm text-muted-foreground mt-4 mb-2">Import New Data via CSV</div>
        `
);

fs.writeFileSync(opsPath, opsCode);
