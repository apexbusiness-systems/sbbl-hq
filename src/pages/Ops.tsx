import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { fetchOpsBootstrap, fetchImportHistory, submitCsvImport, uploadStoreMedia } from '@/lib/api/ops';
import { requireSupabaseClient, hasSupabaseClientConfig } from '@/lib/supabase/client';

type Tab = 'overview' | 'teams' | 'players' | 'schedules' | 'events' | 'store' | 'history';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'teams', label: 'Teams' },
  { id: 'players', label: 'Players' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'events', label: 'Events' },
  { id: 'store', label: 'Store Media' },
  { id: 'history', label: 'Import History' },
];

function parseCsv(raw: string) {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    return headers.reduce<Record<string, string>>((acc, key, idx) => {
      acc[key] = values[idx] ?? '';
      return acc;
    }, {});
  });
}

const OpsPage = () => {
  const queryClient = useQueryClient();
  const { user, roles } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [storeForm, setStoreForm] = useState({ title: '', price: '0', category: 'apparel', publishStatus: 'draft' as 'draft' | 'published', imageFile: null as File | null });

  const bootstrapQuery = useQuery({ queryKey: ['ops-bootstrap'], queryFn: fetchOpsBootstrap });
  const historyQuery = useQuery({ queryKey: ['ops-import-history'], queryFn: fetchImportHistory });

  const importMutation = useMutation({
    mutationFn: ({ kind, rows }: { kind: 'teams' | 'players' | 'schedules' | 'events'; rows: Record<string, string>[] }) => submitCsvImport(kind, rows),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] }),
        queryClient.invalidateQueries({ queryKey: ['ops-import-history'] }),
      ]);
    },
  });

  const storeMutation = useMutation({
    mutationFn: async () => {
      if (!storeForm.imageFile) throw new Error('Image is required');
      const supabase = requireSupabaseClient();
      const objectPath = `store/${crypto.randomUUID()}-${storeForm.imageFile.name}`;
      const upload = await supabase.storage.from('media').upload(objectPath, storeForm.imageFile, { upsert: true });
      if (upload.error) throw upload.error;
      const imageUrl = supabase.storage.from('media').getPublicUrl(objectPath).data.publicUrl;
      return uploadStoreMedia({
        title: storeForm.title,
        price: Number(storeForm.price),
        category: storeForm.category,
        publishStatus: storeForm.publishStatus,
        imageUrl,
      });
    },
  });

  const jobs = historyQuery.data?.jobs ?? bootstrapQuery.data?.importHistory ?? [];
  const latestSummary = useMemo(() => jobs.slice(0, 5), [jobs]);

  return (
    <div className="container py-8 md:py-12 max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Ops Console</h1>
          <p className="text-xs text-muted-foreground">Signed in as {user?.email ?? 'unknown'} · roles: {roles.join(', ') || 'none'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3 py-2 rounded-sm text-sm border ${activeTab === tab.id ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="panel p-4"><p className="text-xs text-muted-foreground">Import jobs</p><p className="stat-numeral text-3xl">{jobs.length}</p></div>
          <div className="panel p-4"><p className="text-xs text-muted-foreground">Recent successful rows</p><p className="stat-numeral text-3xl">{jobs.reduce((acc, j) => acc + (j.inserted_rows || 0), 0)}</p></div>
          <div className="panel p-4"><p className="text-xs text-muted-foreground">Failed rows</p><p className="stat-numeral text-3xl text-destructive">{jobs.reduce((acc, j) => acc + (j.failed_rows || 0), 0)}</p></div>
          <div className="panel p-4 md:col-span-3">
            <h2 className="font-display text-xl mb-2">Recent Actions</h2>
            {latestSummary.length === 0 ? <p className="text-sm text-muted-foreground">No imports yet.</p> : latestSummary.map((job) => <p key={job.id} className="text-sm">{job.job_type} · {job.status} · {job.inserted_rows}/{job.total_rows}</p>)}
          </div>
        </div>
      )}

      {(['teams', 'players', 'schedules', 'events'] as const).includes(activeTab as never) && (
        <div className="panel p-4 space-y-3">
          <h2 className="font-display text-xl">{activeTab} CSV Import</h2>
          <input type="file" accept=".csv,text/csv" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const raw = await file.text();
            setCsvRows(parseCsv(raw));
          }} />
          <p className="text-xs text-muted-foreground">Preview rows: {csvRows.length}</p>
          <div className="max-h-52 overflow-auto text-xs bg-secondary p-2 rounded-sm border border-border">{csvRows.slice(0, 8).map((row, i) => <pre key={i}>{JSON.stringify(row)}</pre>)}</div>
          <button
            disabled={csvRows.length === 0 || importMutation.isPending}
            className="gold-bg px-4 py-2 rounded-sm disabled:opacity-70"
            onClick={() => importMutation.mutate({ kind: activeTab as 'teams' | 'players' | 'schedules' | 'events', rows: csvRows })}
          >
            {importMutation.isPending ? 'Importing…' : 'Submit Import'}
          </button>
          {importMutation.error && <p className="text-xs text-destructive">{(importMutation.error as Error).message}</p>}
          {importMutation.data?.summary && <p className="text-xs text-success">Completed: {importMutation.data.summary.inserted_rows}/{importMutation.data.summary.total_rows}</p>}
        </div>
      )}

      {activeTab === 'store' && (
        <div className="panel p-4 space-y-3 max-w-xl">
          <h2 className="font-display text-xl">Store Media Upload</h2>
          <input placeholder="Title" className="w-full bg-secondary border border-border rounded-sm px-3 py-2" value={storeForm.title} onChange={(e) => setStoreForm((s) => ({ ...s, title: e.target.value }))} />
          <input placeholder="Price" className="w-full bg-secondary border border-border rounded-sm px-3 py-2" value={storeForm.price} onChange={(e) => setStoreForm((s) => ({ ...s, price: e.target.value }))} />
          <input placeholder="Category" className="w-full bg-secondary border border-border rounded-sm px-3 py-2" value={storeForm.category} onChange={(e) => setStoreForm((s) => ({ ...s, category: e.target.value }))} />
          <select className="w-full bg-secondary border border-border rounded-sm px-3 py-2" value={storeForm.publishStatus} onChange={(e) => setStoreForm((s) => ({ ...s, publishStatus: e.target.value as 'draft' | 'published' }))}>
            <option value="draft">Draft</option><option value="published">Published</option>
          </select>
          <input type="file" accept="image/*" onChange={(e) => setStoreForm((s) => ({ ...s, imageFile: e.target.files?.[0] ?? null }))} />
          <button className="gold-bg px-4 py-2 rounded-sm" onClick={() => storeMutation.mutate()} disabled={storeMutation.isPending || !hasSupabaseClientConfig}>{storeMutation.isPending ? 'Uploading…' : 'Upload & Save'}</button>
          {!hasSupabaseClientConfig && <p className="text-xs text-warning">Supabase client env missing; media uploads disabled.</p>}
          {storeMutation.error && <p className="text-xs text-destructive">{(storeMutation.error as Error).message}</p>}
          {storeMutation.data && <p className="text-xs text-success">Saved product {storeMutation.data.productId}</p>}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="panel p-4">
          <h2 className="font-display text-xl mb-3">Import History</h2>
          {jobs.length === 0 ? <p className="text-sm text-muted-foreground">No import history.</p> : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="border border-border rounded-sm p-3 text-sm">
                  <p className="font-medium">{job.job_type} · {job.status}</p>
                  <p className="text-xs text-muted-foreground">Rows {job.inserted_rows}/{job.total_rows} · failed {job.failed_rows}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OpsPage;
