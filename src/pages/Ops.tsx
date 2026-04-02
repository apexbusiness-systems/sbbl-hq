import { parseCsv } from '@/lib/parseCsv';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Upload, Loader2, CheckCircle2, AlertCircle, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PotgCard } from '@/components/ui/PotgCard';
import { fetchOpsBootstrap, fetchImportHistory, submitCsvImport, uploadStoreMedia, parsePotgImage, submitPotgRecord } from '@/lib/api/ops';
import { requireSupabaseClient, hasSupabaseClientConfig } from '@/lib/supabase/client';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { resizeImageToFit } from '@/lib/imageResize';

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


const OpsPage = () => {
  const queryClient = useQueryClient();
  const { user, roles } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [storeForm, setStoreForm] = useState({ title: '', price: '0', category: 'apparel', publishStatus: 'draft' as 'draft' | 'published', imageFile: null as File | null, sale: false });
  const [csvLeagueId, setCsvLeagueId] = useState<string>('wbl');
  const potgFileRef = useRef<HTMLInputElement>(null);
  const [potgParseState, setPotgParseState] = useState<'idle' | 'parsing' | 'parsed' | 'error'>('idle');
  const [potgParseError, setPotgParseError] = useState<string | null>(null);
  const [potgImageFile, setPotgImageFile] = useState<File | null>(null);
  const [potgForm, setPotgForm] = useState({ playerName: '', team: '', pts: '', rebs: '', assts: '', gameResult: '', leagueId: 'wbl', date: new Date().toISOString().split('T')[0] });
  const isSuperAdmin = roles.includes('super_admin');

  const handlePotgImageUpload = async (file: File) => {
    setPotgParseState('parsing');
    setPotgParseError(null);
    setPotgImageFile(file);
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
        setPotgParseError('Parse failed — fill in manually');
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
    mutationFn: ({ kind, rows }: { kind: 'teams' | 'players' | 'schedules' | 'events'; rows: Record<string, string>[] }) =>
      submitCsvImport(kind, rows.map(r => ({ ...r, league_id: csvLeagueId }))),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] }),
        queryClient.invalidateQueries({ queryKey: ['ops-import-history'] }),
      ]);
    },
  });

  const potgMutation = useMutation({
    mutationFn: async () => {
      // Upload the POTG graphic to Supabase storage (resized to 560×747 — 2× the 280×373 card)
      let imageUrl: string | undefined;
      if (potgImageFile && hasSupabaseClientConfig) {
        const supabase = requireSupabaseClient();
        const resized = await resizeImageToFit(potgImageFile, 560, 747);
        const objectPath = `potg/${potgForm.leagueId}/${crypto.randomUUID()}.jpg`;
        const upload = await supabase.storage.from('media').upload(objectPath, resized, { upsert: true });
        if (upload.error) throw upload.error;
        imageUrl = supabase.storage.from('media').getPublicUrl(objectPath).data.publicUrl;
      }
      return submitPotgRecord({
        playerName: potgForm.playerName,
        team: potgForm.team,
        pts: Number(potgForm.pts),
        rebs: Number(potgForm.rebs),
        assts: Number(potgForm.assts),
        gameResult: potgForm.gameResult,
        leagueId: potgForm.leagueId,
        date: potgForm.date,
        imageUrl,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-import-history'] });
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const storeMutation = useMutation({
    mutationFn: async () => {
      if (!storeForm.imageFile) throw new Error('Image is required');
      const supabase = requireSupabaseClient();
      const resized = await resizeImageToFit(storeForm.imageFile, 800, 800);
      const objectPath = `store/${crypto.randomUUID()}.jpg`;
      const upload = await supabase.storage.from('media').upload(objectPath, resized, { upsert: true });
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

  const jobs = useMemo(() => historyQuery.data?.jobs ?? bootstrapQuery.data?.importHistory ?? [], [historyQuery.data?.jobs, bootstrapQuery.data?.importHistory]);
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
          {/* League tag — every imported row gets this league_id */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Target League</label>
            <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit">
              {LEAGUE_REGISTRY.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setCsvLeagueId(l.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${csvLeagueId === l.id ? `bg-card ${l.accentClass} border border-current/20` : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <img src={l.logo} alt="" width={12} height={12} className="flex-shrink-0 opacity-80" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  {l.shortName}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">All imported rows will be tagged with this league.</p>
          </div>
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


      {activeTab === 'teams' && (
        <div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Teams Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage teams.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Team</h3>
                <div className="space-y-2">
                  <input placeholder="Team Name" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <input placeholder="Division" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="gold-bg px-4 py-2 rounded-sm text-xs w-full">Create Team</button>
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Team</h3>
                <div className="flex gap-2">
                  <input placeholder="Team ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'players' && (
        <div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Players Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage players.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Player</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="First Name" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                    <input placeholder="Last Name" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  </div>
                  <input placeholder="Team ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="gold-bg px-4 py-2 rounded-sm text-xs w-full">Create Player</button>
                </div>
              </div>
              <div className="border border-warning/20 p-3 rounded-sm bg-warning/5">
                <h3 className="text-sm font-semibold text-warning mb-2">Suspend Player</h3>
                <div className="flex gap-2">
                  <input placeholder="Player ID to Suspend" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="bg-warning hover:bg-warning/90 text-warning-foreground px-4 py-2 rounded-sm text-xs text-black">Suspend</button>
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Player</h3>
                <div className="flex gap-2">
                  <input placeholder="Player ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {activeTab === 'schedules' && (
        <div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Schedules Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage schedules.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Schedule Entry</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Home Team ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                    <input placeholder="Away Team ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                    <input type="time" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  </div>
                  <button className="gold-bg px-4 py-2 rounded-sm text-xs w-full">Create Schedule</button>
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Schedule Entry</h3>
                <div className="flex gap-2">
                  <input placeholder="Schedule ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Events Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage events.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Event</h3>
                <div className="space-y-2">
                  <input placeholder="Event Title" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <input placeholder="Location" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <input type="date" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="gold-bg px-4 py-2 rounded-sm text-xs w-full">Create Event</button>
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Event</h3>
                <div className="flex gap-2">
                  <input placeholder="Event ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {activeTab === 'store' && (
        <div className="panel p-4 max-w-xl space-y-8">
          <div>
            <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Store Media & Product Ops</h2>
            {!isSuperAdmin ? (
              <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage store operations.</p>
            ) : (
              <div className="space-y-6">

                {/* Batch Create Products */}
                <div className="border border-border p-3 rounded-sm">
                  <h3 className="text-sm font-semibold mb-3">Batch Create Products (Max 4)</h3>
                  <div className="space-y-4">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="border border-secondary p-3 rounded-sm space-y-2 relative">
                        <div className="absolute top-2 right-2 text-[10px] text-muted-foreground font-semibold">Item {i+1}</div>
                        <input placeholder="Title" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" placeholder="Price (USD)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                          <input type="number" placeholder="Inventory Qty" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                        </div>
                        <select className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm">
                          <option value="apparel">Apparel</option>
                          <option value="accessories">Accessories</option>
                          <option value="rewards">Rewards</option>
                        </select>
                      </div>
                    ))}
                    <button className="gold-bg px-4 py-2 rounded-sm text-xs w-full">Submit Batch</button>
                  </div>
                </div>

                {/* Manage Products */}
                <div className="border border-border p-3 rounded-sm">
                  <h3 className="text-sm font-semibold mb-2">Manage Products</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border border-warning/20 p-3 rounded-sm bg-warning/5">
                      <h4 className="text-[10px] font-semibold text-warning mb-2 uppercase tracking-widest">Suspend</h4>
                      <input placeholder="Product ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-1.5 text-xs mb-2" />
                      <button className="bg-warning hover:bg-warning/90 text-warning-foreground px-3 py-1.5 rounded-sm text-[10px] w-full text-black">Suspend</button>
                    </div>
                    <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                      <h4 className="text-[10px] font-semibold text-destructive mb-2 uppercase tracking-widest">Delete</h4>
                      <input placeholder="Product ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-1.5 text-xs mb-2" />
                      <button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-sm text-[10px] w-full">Delete</button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
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

          {/* Live card preview — shown once fields are populated */}
          {(potgParseState === 'parsed' || potgParseState === 'error') && potgForm.playerName && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Trophy className="w-3 h-3 text-primary" /> Card Preview
              </p>
              <PotgCard
                potg={{
                  id: 'preview',
                  leagueId: potgForm.leagueId as import('@/types').LeagueId,
                  playerName: potgForm.playerName,
                  team: potgForm.team,
                  pts: Number(potgForm.pts) || 0,
                  rebs: Number(potgForm.rebs) || 0,
                  assts: Number(potgForm.assts) || 0,
                  gameResult: potgForm.gameResult,
                  date: potgForm.date,
                }}
                featured
              />
            </div>
          )}

          <button
            disabled={potgMutation.isPending || !potgForm.playerName || !potgForm.team}
            onClick={() => potgMutation.mutate()}
            className="w-full gold-bg py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm disabled:opacity-50 transition-opacity"
          >
            {potgMutation.isPending ? (potgImageFile ? 'Resizing & Uploading…' : 'Submitting to Pipeline…') : 'Submit to Data Pipeline'}
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
