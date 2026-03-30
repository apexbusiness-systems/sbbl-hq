import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { fetchOpsBootstrap, fetchImportHistory, submitCsvImport, uploadStoreMedia, parsePotgImage, submitPotgRecord } from '@/lib/api/ops';
import { requireSupabaseClient, hasSupabaseClientConfig } from '@/lib/supabase/client';
import { LEAGUE_REGISTRY } from '@/lib/leagues';

type Tab = 'overview' | 'teams' | 'players' | 'schedules' | 'events' | 'store' | 'potg' | 'history';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'teams', label: 'Teams' },
  { id: 'players', label: 'Players' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'events', label: 'Events' },
  { id: 'store', label: 'Store Media' },
  { id: 'potg', label: 'POTG Parser' },
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
  const [storeForm, setStoreForm] = useState({ title: '', price: '0', category: 'apparel', publishStatus: 'draft' as 'draft' | 'published', imageFile: null as File | null, sale: false });
  const potgFileRef = useRef<HTMLInputElement>(null);
  const [potgParseState, setPotgParseState] = useState<'idle' | 'parsing' | 'parsed' | 'error'>('idle');
  const [potgParseError, setPotgParseError] = useState<string | null>(null);
  const [potgForm, setPotgForm] = useState({ playerName: '', team: '', pts: '', rebs: '', assts: '', gameResult: '', leagueId: 'wbl', date: new Date().toISOString().split('T')[0] });

  const handlePotgImageUpload = async (file: File) => {
    setPotgParseState('parsing');
    setPotgParseError(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const imageBase64 = btoa(binary);
      const result = await parsePotgImage(imageBase64, file.type as string);
      if (result.ok && result.data) {
        setPotgForm(f => ({
          ...f,
          playerName: result.data.playerName ?? '',
          team: result.data.team ?? '',
          pts: String(result.data.pts ?? ''),
          rebs: String(result.data.rebs ?? ''),
          assts: String(result.data.assts ?? ''),
          gameResult: result.data.gameResult ?? '',
        }));
        setPotgParseState('parsed');
      } else {
        setPotgParseError((e instanceof Error && e.message.includes('groq_api_key_missing')) ? 'GROQ_API_KEY not set in Workers env — fill in manually' : 'Parse failed — fill in manually');
        setPotgParseState('error');
      }
    } catch (e) {
      setPotgParseError(e instanceof Error ? e.message : 'Unknown error');
      setPotgParseState('error');
    }
  };

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

  const potgMutation = useMutation({
    mutationFn: () => submitPotgRecord({
      playerName: potgForm.playerName,
      team: potgForm.team,
      pts: Number(potgForm.pts),
      rebs: Number(potgForm.rebs),
      assts: Number(potgForm.assts),
      gameResult: potgForm.gameResult,
      leagueId: potgForm.leagueId,
      date: potgForm.date,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-import-history'] });
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
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
        sale: storeForm.sale,
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
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setStoreForm(s => ({ ...s, sale: !s.sale }))}
              className={`w-10 h-5 rounded-full relative transition-colors ${storeForm.sale ? 'bg-primary' : 'bg-secondary'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${storeForm.sale ? 'translate-x-5 bg-primary-foreground' : 'translate-x-0.5 bg-muted-foreground'}`} />
            </div>
            <span className="text-xs font-medium">Feature in Live Stream Carousel <span className="text-muted-foreground">(mark as Sale)</span></span>
          </label>
          <button className="gold-bg px-4 py-2 rounded-sm" onClick={() => storeMutation.mutate()} disabled={storeMutation.isPending || !hasSupabaseClientConfig}>{storeMutation.isPending ? 'Uploading…' : 'Upload & Save'}</button>
          {!hasSupabaseClientConfig && <p className="text-xs text-warning">Supabase client env missing; media uploads disabled.</p>}
          {storeMutation.error && <p className="text-xs text-destructive">{(storeMutation.error as Error).message}</p>}
          {storeMutation.data && <p className="text-xs text-success">Saved product {storeMutation.data.productId}</p>}
        </div>
      )}

      {activeTab === 'potg' && (
        <div className="panel p-4 space-y-5 max-w-xl">
          <div>
            <h2 className="font-display text-xl">POTG Image Parser</h2>
            <p className="text-xs text-muted-foreground mt-1">Upload a Player of the Game graphic — Claude Vision extracts the data automatically, then you confirm before it writes to the pipeline.</p>
          </div>

          {/* Image drop zone */}
          <div
            className="border-2 border-dashed border-border rounded-sm p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => potgFileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handlePotgImageUpload(f); }}
          >
            <input ref={potgFileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePotgImageUpload(f); }} />
            {potgParseState === 'parsing' ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Parsing with Claude Vision…</p>
              </div>
            ) : potgParseState === 'parsed' ? (
              <div className="flex flex-col items-center gap-1">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <p className="text-xs text-success font-medium">Data extracted — review below</p>
                <p className="text-[10px] text-muted-foreground">Click to parse another image</p>
              </div>
            ) : potgParseState === 'error' ? (
              <div className="flex flex-col items-center gap-1">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <p className="text-xs text-destructive">{potgParseError}</p>
                <p className="text-[10px] text-muted-foreground">Fill in fields manually below</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop POTG graphic or click to upload</p>
                <p className="text-[10px] text-muted-foreground">PNG, JPG — Claude reads PTS / REB / AST / player name / team / game result</p>
              </div>
            )}
          </div>

          {/* Editable parsed fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Player Name</label>
                <input className="w-full mt-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={potgForm.playerName} onChange={e => setPotgForm(f => ({ ...f, playerName: e.target.value }))} placeholder="e.g. Michael Ramos" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Team</label>
                <input className="w-full mt-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={potgForm.team} onChange={e => setPotgForm(f => ({ ...f, team: e.target.value }))} placeholder="e.g. Ball is Life" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">PTS</label>
                <input type="number" className="w-full mt-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={potgForm.pts} onChange={e => setPotgForm(f => ({ ...f, pts: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">REB</label>
                <input type="number" className="w-full mt-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={potgForm.rebs} onChange={e => setPotgForm(f => ({ ...f, rebs: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">AST</label>
                <input type="number" className="w-full mt-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={potgForm.assts} onChange={e => setPotgForm(f => ({ ...f, assts: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Game Result</label>
              <input className="w-full mt-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={potgForm.gameResult} onChange={e => setPotgForm(f => ({ ...f, gameResult: e.target.value }))} placeholder="e.g. OSY 77 vs Solid North 63" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">League</label>
                <select className="w-full mt-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={potgForm.leagueId} onChange={e => setPotgForm(f => ({ ...f, leagueId: e.target.value }))}>
                  {LEAGUE_REGISTRY.map(l => <option key={l.id} value={l.id}>{l.shortName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</label>
                <input type="date" className="w-full mt-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={potgForm.date} onChange={e => setPotgForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
          </div>

          <button
            disabled={potgMutation.isPending || !potgForm.playerName || !potgForm.team}
            onClick={() => potgMutation.mutate()}
            className="w-full gold-bg py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm disabled:opacity-50 transition-opacity"
          >
            {potgMutation.isPending ? 'Submitting to Pipeline…' : 'Submit to Data Pipeline'}
          </button>

          {potgMutation.error && <p className="text-xs text-destructive">{(potgMutation.error as Error).message}</p>}
          {potgMutation.data && (
            <div className="p-3 bg-success/10 border border-success/20 rounded-sm">
              <p className="text-xs text-success font-medium">
                ✓ Submitted — Job {potgMutation.data.jobId?.slice(0, 8)}
                {potgMutation.data.matched ? ' · Player profile matched and stats written' : ' · Queued for manual player match'}
              </p>
            </div>
          )}
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
