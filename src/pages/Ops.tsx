import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseCsv } from '@/lib/parseCsv';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Upload, Loader2, CheckCircle2, AlertCircle, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PotgCard } from '@/components/ui/PotgCard';
import { fetchOpsBootstrap, fetchImportHistory, submitCsvImport, ingestPresign, ingestSubmit, ingestApprove, ingestReject, ingestReplay } from '@/lib/api/ops';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { resizeImageToFit, inferTargetDimensions } from '@/lib/imageResize';
import { fetchScores, submitScoreManual, submitScoresCsvImport, parseScoreboardImage } from '@/lib/api/scores';
import type { ScoreCategory } from '@/types';

type Tab = 'overview' | 'scores' | 'teams' | 'players' | 'schedules' | 'events' | 'store' | 'potg' | 'history' | 'media';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview',  label: 'Overview'       },
  { id: 'scores',    label: 'Scores'         },
  { id: 'teams',     label: 'Teams'          },
  { id: 'players',   label: 'Players'        },
  { id: 'schedules', label: 'Schedules'      },
  { id: 'events',    label: 'Events'         },
  { id: 'store',     label: 'Store Media'    },
  { id: 'potg',      label: 'POTG Parser'    },
  { id: 'media',     label: 'Generic Media'  },
  { id: 'history',   label: 'Import History' },
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
  const [genericMediaForm, setGenericMediaForm] = useState({ title: '', file: null as File | null });

  const [teamForm, setTeamForm] = useState({ name: '', leagueId: '', seasonId: '', divisionId: '' });

  const [playerForm, setPlayerForm] = useState({ userId: '', teamId: '', leagueId: '', jerseyNumber: '', position: '' });

  const [scheduleForm, setScheduleForm] = useState({ leagueId: '', seasonId: '', startsAt: '', endsAt: '' });


  const [storeSuspendId, setStoreSuspendId] = useState('');
  const [storeDeleteId, setStoreDeleteId] = useState('');

  // ── Scores state ──────────────────────────────────────────────────────────

  // --- Event Graphics Parser State ---
  const eventFileRef = useRef<HTMLInputElement>(null);
  const [eventParseState, setEventParseState] = useState<'idle' | 'parsing' | 'parsed' | 'error'>('idle');
  const [eventParseError, setEventParseError] = useState('');
  const [eventGraphicForm, setEventGraphicForm] = useState({
    title: '',
    location: '',
    date: '',
    leagueId: 'sbbl',
    file: null as File | null,
  });
  const scoreboardFileRef = useRef<HTMLInputElement>(null);
  const scoresCsvFileRef = useRef<HTMLInputElement>(null);
  const [scoresCsvRows, setScoresCsvRows] = useState<Record<string, string>[]>([]);
  const [scoreboardImageFile, setScoreboardImageFile] = useState<File | null>(null);
  const [scoreboardParseState, setScoreboardParseState] = useState<'idle' | 'parsing' | 'parsed' | 'error'>('idle');
  const [scoreboardParseError, setScoreboardParseError] = useState<string | null>(null);
  const defaultScoreForm = {
    category: 'league' as ScoreCategory,
    leagueId: 'sbbl',
    homeLabel: '',
    awayLabel: '',
    homeScore: '',
    awayScore: '',
    status: 'final',
    gameDate: new Date().toISOString().split('T')[0],
    eventName: '',
    notes: '',
  };
  const [scoresForm, setScoresForm] = useState(defaultScoreForm);


  const handlePotgImageUpload = async (file: File) => {
    setPotgImageFile(file);
    setPotgParseState('parsed'); // Bypass client-side parsing
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

  const approveJobMutation = useMutation({
    mutationFn: (jobId: string) => ingestApprove(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ops-import-history'] }),
  });

  const rejectJobMutation = useMutation({
    mutationFn: (jobId: string) => ingestReject(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ops-import-history'] }),
  });

  const replayJobMutation = useMutation({
    mutationFn: (jobId: string) => ingestReplay(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ops-import-history'] }),
  });

  const potgMutation = useMutation({
    mutationFn: async () => {
      if (!potgImageFile) throw new Error("Missing file");
      const dims = await inferTargetDimensions(potgImageFile);
      const resized = await resizeImageToFit(potgImageFile, dims.width, dims.height, dims.mode);
      const { signedUrl, objectPath } = await ingestPresign('potg', potgImageFile.name);
      await fetch(signedUrl, { method: 'PUT', body: resized });

      return ingestSubmit({
        kind: 'potg',
        objectPath,
        publicUrl: objectPath,
        title: `POTG: ${potgForm.playerName}`,
        leagueId: potgForm.leagueId,
        publishStatus: 'published',
        meta: {
          playerName: potgForm.playerName,
          team: potgForm.team,
          pts: Number(potgForm.pts),
          rebs: Number(potgForm.rebs),
          assts: Number(potgForm.assts),
          gameResult: potgForm.gameResult,
          date: potgForm.date,
        }
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
      const resized = await resizeImageToFit(storeForm.imageFile, 800, 800);
      const { signedUrl, objectPath } = await ingestPresign('store', storeForm.imageFile.name);
      await fetch(signedUrl, { method: 'PUT', body: resized });

      return ingestSubmit({
        kind: 'store',
        objectPath,
        publicUrl: objectPath,
        title: storeForm.title,
        publishStatus: storeForm.publishStatus,
        meta: {
          price: Number(storeForm.price),
          category: storeForm.category,
          sale: storeForm.sale,
        }
      });
    },
    onSuccess: () => setStoreForm({ title: '', price: '0', category: 'apparel', publishStatus: 'draft', imageFile: null, sale: false }),
  });

  const eventMediaMutation = useMutation({
    mutationFn: async () => {
      if (!eventGraphicForm.file || !eventGraphicForm.title) return null;
      const { signedUrl, objectPath } = await ingestPresign('event', eventGraphicForm.file.name);
      await fetch(signedUrl, { method: 'PUT', body: eventGraphicForm.file });

      return ingestSubmit({
        kind: 'event',
        objectPath,
        publicUrl: objectPath,
        title: eventGraphicForm.title,
        leagueId: eventGraphicForm.leagueId || null,
        publishStatus: 'published',
        meta: {
          date: eventGraphicForm.date || undefined,
        }
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-import-history'] });
    }
  });

  const genericMediaMutation = useMutation({
    mutationFn: async () => {
      if (!genericMediaForm.file) throw new Error("File is required");
      const { signedUrl, objectPath } = await ingestPresign('generic', genericMediaForm.file.name);
      await fetch(signedUrl, { method: 'PUT', body: genericMediaForm.file });
      return ingestSubmit({
        kind: 'generic',
        objectPath,
        publicUrl: objectPath,
        title: genericMediaForm.title,
        publishStatus: 'published',
      });
    },
    onSuccess: async () => {
      setGenericMediaForm({ title: '', file: null });
      await queryClient.invalidateQueries({ queryKey: ['ops-import-history'] });
    }
  });

  // ── Scores mutations ───────────────────────────────────────────────────────
  const scoresQuery = useQuery({
    queryKey: ['ops-scores-list'],
    queryFn: () => fetchScores(),
    enabled: activeTab === 'scores',
    staleTime: 30_000,
  });

  const scoreManualMutation = useMutation({
    mutationFn: () => submitScoreManual({
      category: scoresForm.category,
      leagueId: scoresForm.category === 'league' ? scoresForm.leagueId : undefined,
      participant1Label: scoresForm.homeLabel || undefined,
      participant2Label: scoresForm.awayLabel || undefined,
      homeScore: scoresForm.homeScore !== '' ? Number(scoresForm.homeScore) : undefined,
      awayScore: scoresForm.awayScore !== '' ? Number(scoresForm.awayScore) : undefined,
      status: scoresForm.status,
      gameDate: scoresForm.gameDate || undefined,
      eventName: scoresForm.eventName || undefined,
      notes: scoresForm.notes || undefined,
    }),
    onSuccess: async () => {
      setScoresForm(defaultScoreForm);
      await queryClient.invalidateQueries({ queryKey: ['ops-scores-list'] });
      await queryClient.invalidateQueries({ queryKey: ['scores'] });
    },
  });

  const scoresCsvMutation = useMutation({
    mutationFn: () => submitScoresCsvImport(scoresCsvRows),
    onSuccess: async () => {
      setScoresCsvRows([]);
      if (scoresCsvFileRef.current) scoresCsvFileRef.current.value = '';
      await queryClient.invalidateQueries({ queryKey: ['ops-scores-list'] });
      await queryClient.invalidateQueries({ queryKey: ['scores'] });
    },
  });


  const handleEventImageUpload = async (file: File) => {
    setEventGraphicForm(f => ({ ...f, file }));
  };
  const handleScoreboardImage = async (file: File) => {
    setScoreboardParseState('parsing');
    setScoreboardParseError(null);
    setScoreboardImageFile(file);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const imageBase64 = btoa(binary);
      const result = await parseScoreboardImage(imageBase64, file.type);
      if (result.ok && result.data) {
        const d = result.data;
        setScoresForm(f => ({
          ...f,
          homeLabel: d.homeLabel ?? f.homeLabel,
          awayLabel: d.awayLabel ?? f.awayLabel,
          homeScore: d.homeScore != null ? String(d.homeScore) : f.homeScore,
          awayScore: d.awayScore != null ? String(d.awayScore) : f.awayScore,
          gameDate: d.gameDate ?? f.gameDate,
          eventName: d.eventName ?? f.eventName,
          status: d.status ?? f.status,
        }));
        setScoreboardParseState('parsed');
      } else {
        setScoreboardParseError('Parse failed — fill in manually');
        setScoreboardParseState('error');
      }
    } catch (e) {
      setScoreboardParseError(e instanceof Error ? e.message : 'Unknown error');
      setScoreboardParseState('error');
    }
  };

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

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as Tab)} className="space-y-6">
      <TabsList className="flex flex-wrap h-auto w-full justify-start gap-2 bg-transparent p-0">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border border-border bg-card"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview"><div className="grid md:grid-cols-3 gap-4">
          <div className="panel p-4"><p className="text-xs text-muted-foreground">Import jobs</p><p className="stat-numeral text-3xl">{jobs.length}</p></div>
          <div className="panel p-4"><p className="text-xs text-muted-foreground">Recent successful rows</p><p className="stat-numeral text-3xl">{jobs.reduce((acc, j) => acc + (j.inserted_rows || 0), 0)}</p></div>
          <div className="panel p-4"><p className="text-xs text-muted-foreground">Failed rows</p><p className="stat-numeral text-3xl text-destructive">{jobs.reduce((acc, j) => acc + (j.failed_rows || 0), 0)}</p></div>
          <div className="panel p-4 md:col-span-3">
            <h2 className="font-display text-xl mb-2">Recent Actions</h2>
            {latestSummary.length === 0 ? <p className="text-sm text-muted-foreground">No imports yet.</p> : latestSummary.map((job) => <p key={job.id} className="text-sm">{job.job_type} · {job.status} · {job.inserted_rows}/{job.total_rows}</p>)}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="scores"><div className="space-y-6">
          {!isSuperAdmin && <p className="text-sm text-destructive font-semibold panel p-4">Super Admin role required for score management.</p>}

          {/* ── Scoreboard image OCR ──────────────────────────────── */}
          <div className="panel p-4 space-y-4 max-w-2xl">
            <div>
              <h2 className="font-display text-xl flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Scoreboard Image Parser</h2>
              <p className="text-xs text-muted-foreground mt-1">Upload a scoreboard photo — Claude Vision auto-extracts team names and scores.</p>
            </div>
            <div
              className="border-2 border-dashed border-border rounded-sm p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => scoreboardFileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void handleScoreboardImage(f); }}
            >
              <input ref={scoreboardFileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleScoreboardImage(f); }} />
              {scoreboardParseState === 'parsing' ? (
                <div className="flex flex-col items-center gap-2"><Loader2 className="w-6 h-6 text-primary animate-spin" /><p className="text-sm text-muted-foreground">Parsing with Claude Vision…</p></div>
              ) : scoreboardParseState === 'parsed' ? (
                <div className="flex flex-col items-center gap-1"><CheckCircle2 className="w-5 h-5 text-success" /><p className="text-xs text-success font-medium">Data extracted — review below</p><p className="text-[10px] text-muted-foreground">Click to parse another image</p></div>
              ) : scoreboardParseState === 'error' ? (
                <div className="flex flex-col items-center gap-1"><AlertCircle className="w-5 h-5 text-destructive" /><p className="text-xs text-destructive">{scoreboardParseError}</p><p className="text-[10px] text-muted-foreground">Fill in fields manually below</p></div>
              ) : (
                <div className="flex flex-col items-center gap-2"><Upload className="w-6 h-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">Drop scoreboard photo or click to upload</p><p className="text-[10px] text-muted-foreground">PNG, JPG — reads team names, scores, date</p></div>
              )}
            </div>
          </div>

          {/* ── Manual score entry ────────────────────────────────── */}
          <div className="panel p-4 space-y-4 max-w-2xl">
            <h2 className="font-display text-xl flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Manual Score Entry</h2>

            {/* Category */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Category</label>
              <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit">
                {(['league', '1v1', 'special_event'] as ScoreCategory[]).map(cat => (
                  <button key={cat} type="button" onClick={() => setScoresForm(f => ({ ...f, category: cat }))}
                    className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${scoresForm.category === cat ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {cat === '1v1' ? '1-on-1' : cat === 'special_event' ? 'Special Event' : 'League'}
                  </button>
                ))}
              </div>
            </div>

            {/* League selector — only for league games */}
            {scoresForm.category === 'league' && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">League</label>
                <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit">
                  {LEAGUE_REGISTRY.map(l => (
                    <button key={l.id} type="button" onClick={() => setScoresForm(f => ({ ...f, leagueId: l.id }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${scoresForm.leagueId === l.id ? `bg-card ${l.accentClass} border border-current/20` : 'text-muted-foreground hover:text-foreground'}`}>
                      <img src={l.logo} alt="" width={12} height={12} className="flex-shrink-0 opacity-80" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      {l.shortName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Event name — for special events */}
            {scoresForm.category === 'special_event' && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Event Name</label>
                <input className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" placeholder="e.g. SBBL All-Star Weekend" value={scoresForm.eventName} onChange={e => setScoresForm(f => ({ ...f, eventName: e.target.value }))} />
              </div>
            )}

            {/* Teams / participants */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Away Team / Player</label>
                <input className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" placeholder="Away label" value={scoresForm.awayLabel} onChange={e => setScoresForm(f => ({ ...f, awayLabel: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Home Team / Player</label>
                <input className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" placeholder="Home label" value={scoresForm.homeLabel} onChange={e => setScoresForm(f => ({ ...f, homeLabel: e.target.value }))} />
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Away Score</label>
                <input type="number" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" placeholder="—" value={scoresForm.awayScore} onChange={e => setScoresForm(f => ({ ...f, awayScore: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Home Score</label>
                <input type="number" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" placeholder="—" value={scoresForm.homeScore} onChange={e => setScoresForm(f => ({ ...f, homeScore: e.target.value }))} />
              </div>
            </div>

            {/* Status + Date + Venue */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Status</label>
                <select className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={scoresForm.status} onChange={e => setScoresForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="final">Final</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="postponed">Postponed</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Game Date</label>
                <input type="date" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={scoresForm.gameDate} onChange={e => setScoresForm(f => ({ ...f, gameDate: e.target.value }))} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Notes (optional)</label>
              <input className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" placeholder="e.g. OT, playoff game, mercy rule…" value={scoresForm.notes} onChange={e => setScoresForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <button
              disabled={!isSuperAdmin || !scoresForm.homeLabel || !scoresForm.awayLabel || scoreManualMutation.isPending}
              className="w-full gold-bg py-2.5 font-display font-bold text-sm uppercase tracking-wider rounded-sm disabled:opacity-50 transition-opacity"
              onClick={() => scoreManualMutation.mutate()}
            >
              {scoreManualMutation.isPending ? 'Saving…' : 'Save Score'}
            </button>
            {scoreManualMutation.error && <p className="text-xs text-destructive">{(scoreManualMutation.error as Error).message}</p>}
            {scoreManualMutation.isSuccess && <p className="text-xs text-success">Score saved — game ID: {scoreManualMutation.data?.gameId?.slice(0, 8)}</p>}
          </div>

          {/* ── CSV bulk import ───────────────────────────────────── */}
          <div className="panel p-4 space-y-3 max-w-2xl">
            <div>
              <h2 className="font-display text-xl">CSV Bulk Import</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Required columns: <code className="text-[10px] bg-secondary px-1 py-0.5 rounded">category, home_label, away_label, status</code>.
                Optional: <code className="text-[10px] bg-secondary px-1 py-0.5 rounded">league_id, home_score, away_score, game_date, event_name, notes</code>
              </p>
            </div>
            <input ref={scoresCsvFileRef} type="file" accept=".csv,text/csv" onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const raw = await file.text();
              setScoresCsvRows(parseCsv(raw));
            }} />
            <p className="text-xs text-muted-foreground">Rows loaded: {scoresCsvRows.length}</p>
            {scoresCsvRows.length > 0 && (
              <div className="max-h-44 overflow-auto text-xs bg-secondary p-2 rounded-sm border border-border">
                {scoresCsvRows.slice(0, 6).map((row, i) => <pre key={i} className="truncate">{JSON.stringify(row)}</pre>)}
                {scoresCsvRows.length > 6 && <p className="text-muted-foreground mt-1">…and {scoresCsvRows.length - 6} more</p>}
              </div>
            )}
            <button
              disabled={!isSuperAdmin || scoresCsvRows.length === 0 || scoresCsvMutation.isPending}
              className="gold-bg px-4 py-2 rounded-sm text-sm font-semibold disabled:opacity-60"
              onClick={() => scoresCsvMutation.mutate()}
            >
              {scoresCsvMutation.isPending ? 'Importing…' : `Import ${scoresCsvRows.length} Row${scoresCsvRows.length !== 1 ? 's' : ''}`}
            </button>
            {scoresCsvMutation.error && <p className="text-xs text-destructive">{(scoresCsvMutation.error as Error).message}</p>}
            {scoresCsvMutation.data && (
              <p className="text-xs text-success">
                Imported: {scoresCsvMutation.data.inserted} · Failed: {scoresCsvMutation.data.failed}
                {scoresCsvMutation.data.errors?.length > 0 && (
                  <span className="text-warning"> · {scoresCsvMutation.data.errors[0]}</span>
                )}
              </p>
            )}
          </div>

          {/* ── Recent scores list ────────────────────────────────── */}
          <div className="panel p-4 max-w-4xl">
            <h2 className="font-display text-xl mb-3">Recent Scores</h2>
            {scoresQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!scoresQuery.isLoading && (scoresQuery.data?.games ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No scores yet. Add them above or import a CSV.</p>
            )}
            <div className="space-y-2 max-h-96 overflow-auto pr-1">
              {(scoresQuery.data?.games ?? []).slice(0, 20).map(g => (
                <div key={g.id} className="border border-border rounded-sm p-3 text-xs flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase ${g.category === 'league' ? 'bg-blue-500/15 text-blue-400' : g.category === '1v1' ? 'bg-purple-500/15 text-purple-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {g.category === '1v1' ? '1v1' : g.category === 'special_event' ? 'Event' : (g.leagueCode ?? g.leagueId ?? 'LGE').toUpperCase()}
                    </span>
                    <span className="truncate font-medium">{g.awayLabel} vs {g.homeLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="stat-numeral text-sm">{g.awayScore ?? '—'} – {g.homeScore ?? '—'}</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${g.status === 'final' ? 'text-green-400 bg-green-500/10' : g.status === 'live' ? 'text-red-400 bg-red-500/15' : 'text-muted-foreground bg-secondary'}`}>{g.status}</span>
                    {g.gameDate && <span className="text-muted-foreground">{new Date(g.gameDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="teams">
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
</TabsContent>

      <TabsContent value="players">
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
<div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Players Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage players.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Player</h3>
                <div className="space-y-2">
                  <input placeholder="User ID (UUID) *" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={playerForm.userId} onChange={e => setPlayerForm(f => ({ ...f, userId: e.target.value }))} />
                  <input placeholder="Team ID (optional)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={playerForm.teamId} onChange={e => setPlayerForm(f => ({ ...f, teamId: e.target.value }))} />
                  <input placeholder="League ID (optional)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={playerForm.leagueId} onChange={e => setPlayerForm(f => ({ ...f, leagueId: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Jersey #" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={playerForm.jerseyNumber} onChange={e => setPlayerForm(f => ({ ...f, jerseyNumber: e.target.value }))} />
                    <input placeholder="Position" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={playerForm.position} onChange={e => setPlayerForm(f => ({ ...f, position: e.target.value }))} />
                  </div>
                  <button disabled={!playerForm.userId || createPlayerMutation.isPending} className="gold-bg px-4 py-2 rounded-sm text-xs w-full disabled:opacity-60" onClick={() => createPlayerMutation.mutate()}>{createPlayerMutation.isPending ? 'Creating…' : 'Create Player'}</button>
                  {createPlayerMutation.error && <p className="text-xs text-destructive">{(createPlayerMutation.error as Error).message}</p>}
                  {createPlayerMutation.isSuccess && <p className="text-xs text-success">Player created.</p>}
                </div>
              </div>
              <div className="border border-warning/20 p-3 rounded-sm bg-warning/5">
                <h3 className="text-sm font-semibold text-warning mb-2">Suspend Player</h3>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input placeholder="Player ID to Suspend" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={suspendPlayerId} onChange={e => setSuspendPlayerId(e.target.value)} />
                    <button disabled={!suspendPlayerId || suspendPlayerMutation.isPending} className="bg-warning hover:bg-warning/90 text-warning-foreground px-4 py-2 rounded-sm text-xs text-black disabled:opacity-60" onClick={() => suspendPlayerMutation.mutate()}>{suspendPlayerMutation.isPending ? '…' : 'Suspend'}</button>
                  </div>
                  <input placeholder="Reason (optional)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={suspendPlayerReason} onChange={e => setSuspendPlayerReason(e.target.value)} />
                  {suspendPlayerMutation.error && <p className="text-xs text-destructive">{(suspendPlayerMutation.error as Error).message}</p>}
                  {suspendPlayerMutation.isSuccess && <p className="text-xs text-success">Player suspended.</p>}
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Player</h3>
                <div className="flex gap-2">
                  <input placeholder="Player ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={deletePlayerId} onChange={e => setDeletePlayerId(e.target.value)} />
                  <button disabled={!deletePlayerId || deletePlayerMutation.isPending} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs disabled:opacity-60" onClick={() => deletePlayerMutation.mutate()}>{deletePlayerMutation.isPending ? '…' : 'Delete'}</button>
                </div>
                {deletePlayerMutation.error && <p className="text-xs text-destructive mt-1">{(deletePlayerMutation.error as Error).message}</p>}
                {deletePlayerMutation.isSuccess && <p className="text-xs text-success mt-1">Player deleted.</p>}
              </div>
            </div>
          )}
        </div>
      </TabsContent>


      <TabsContent value="schedules">
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
</TabsContent>

      <TabsContent value="events">
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
<div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Events Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage events.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Event</h3>
                <div className="space-y-2">
                  <input placeholder="Event Title *" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} />
                  <input placeholder="Location (optional)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} />
                  <input placeholder="League ID (optional)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventForm.leagueId} onChange={e => setEventForm(f => ({ ...f, leagueId: e.target.value }))} />
                  <input type="date" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} />
                  <button disabled={!eventForm.title || createEventMutation.isPending} className="gold-bg px-4 py-2 rounded-sm text-xs w-full disabled:opacity-60" onClick={() => createEventMutation.mutate()}>{createEventMutation.isPending ? 'Creating…' : 'Create Event'}</button>
                  {createEventMutation.error && <p className="text-xs text-destructive">{(createEventMutation.error as Error).message}</p>}
                  {createEventMutation.isSuccess && <p className="text-xs text-success">Event created.</p>}
                </div>
              </div>

              <div className="border border-border p-3 rounded-sm mt-6 mb-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  Event Graphic Parser
                </h3>
                <p className="text-xs text-muted-foreground mb-4">Upload a flyer/graphic to automatically extract event details.</p>

                <div
                  className="border-2 border-dashed border-border rounded-sm p-6 text-center cursor-pointer hover:border-primary/40 transition-colors mb-4"
                  onClick={() => eventFileRef.current?.click()}
                  onDragOver={(e: React.DragEvent) => e.preventDefault()}
                  onDrop={(e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { void handleEventImageUpload(f); } }}
                >
                  <input ref={eventFileRef} type="file" accept="image/*" className="hidden" onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { void handleEventImageUpload(f); } }} />
                  {eventParseState === 'parsing' ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">Extracting event details…</p>
                    </div>
                  ) : eventParseState === 'parsed' ? (
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <p className="text-xs text-success font-medium">Extracted successfully</p>
                      <p className="text-[10px] text-muted-foreground">Review fields below</p>
                    </div>
                  ) : eventParseState === 'error' ? (
                    <div className="flex flex-col items-center gap-1">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      <p className="text-xs text-destructive">{eventParseError}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Drop flyer image or click to upload</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 bg-secondary/30 p-3 rounded-sm border border-border">
                  <input placeholder="Event Title *" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventGraphicForm.title} onChange={(e) => setEventGraphicForm(f => ({ ...f, title: e.target.value }))} />
                  <input placeholder="Location" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventGraphicForm.location} onChange={(e) => setEventGraphicForm(f => ({ ...f, location: e.target.value }))} />
                  <input placeholder="League ID (e.g. wbl, sbbl)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventGraphicForm.leagueId} onChange={(e) => setEventGraphicForm(f => ({ ...f, leagueId: e.target.value }))} />
                  <input placeholder="Date / Time" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventGraphicForm.date} onChange={(e) => setEventGraphicForm(f => ({ ...f, date: e.target.value }))} />
                  <button
                    disabled={!eventGraphicForm.title || createEventMutation.isPending || eventMediaMutation.isPending}
                    className="gold-bg px-4 py-2 rounded-sm text-xs w-full disabled:opacity-60 flex justify-center items-center gap-2"
                    onClick={() => {
                      setEventForm({
                        title: eventGraphicForm.title,
                        location: eventGraphicForm.location,
                        date: eventGraphicForm.date,
                        leagueId: eventGraphicForm.leagueId,
                      });
                      setTimeout(() => {
                        createEventMutation.mutate();
                        if (eventResizedBlob) eventMediaMutation.mutate();
                      }, 0);
                    }}
                  >
                    {(createEventMutation.isPending || eventMediaMutation.isPending) ? 'Publishing…' : 'Create Event & Publish to Media'}
                  </button>
                  {eventMediaMutation.isSuccess && eventMediaMutation.data && (
                    <p className="text-xs text-success">✓ Event graphic published to Media page</p>
                  )}
                  {eventMediaMutation.error && (
                    <p className="text-xs text-destructive">{(eventMediaMutation.error as Error).message}</p>
                  )}
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Event</h3>
                <div className="flex gap-2">
                  <input placeholder="Event ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={deleteEventId} onChange={e => setDeleteEventId(e.target.value)} />
                  <button disabled={!deleteEventId || deleteEventMutation.isPending} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs disabled:opacity-60" onClick={() => deleteEventMutation.mutate()}>{deleteEventMutation.isPending ? '…' : 'Delete'}</button>
                </div>
                {deleteEventMutation.error && <p className="text-xs text-destructive mt-1">{(deleteEventMutation.error as Error).message}</p>}
                {deleteEventMutation.isSuccess && <p className="text-xs text-success mt-1">Event archived.</p>}
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="store"><div className="panel p-4 max-w-xl space-y-8">
          <div>
            <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Store Media Upload</h2>
            {!isSuperAdmin ? (
              <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage store operations.</p>
            ) : (
              <div className="space-y-6">
                {/* Upload Store Product with Image */}
                <div className="border border-primary/30 p-3 rounded-sm bg-primary/5">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" /> Upload Store Product with Image
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">Creates the product AND publishes the image to the Store Media surface.</p>
                  <div className="space-y-2">
                    <input
                      placeholder="Product Title *"
                      className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm"
                      value={storeForm.title}
                      onChange={e => setStoreForm(f => ({ ...f, title: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Price (CAD) *"
                        className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm"
                        value={storeForm.price}
                        onChange={e => setStoreForm(f => ({ ...f, price: e.target.value }))}
                      />
                      <select
                        className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm"
                        value={storeForm.category}
                        onChange={e => setStoreForm(f => ({ ...f, category: e.target.value }))}
                      >
                        <option value="apparel">Apparel</option>
                        <option value="gear">Gear</option>
                        <option value="accessories">Accessories</option>
                        <option value="rewards">Rewards</option>
                      </select>
                    </div>
                    <div className="flex gap-4 mb-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={storeForm.sale} onChange={e => setStoreForm(f => ({ ...f, sale: e.target.checked }))} className="rounded bg-secondary border-border" />
                        On Sale
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="radio" checked={storeForm.publishStatus === 'published'} onChange={() => setStoreForm(f => ({ ...f, publishStatus: 'published' }))} name="status" /> Published
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="radio" checked={storeForm.publishStatus === 'draft'} onChange={() => setStoreForm(f => ({ ...f, publishStatus: 'draft' }))} name="status" /> Draft
                      </label>
                    </div>
                    <div
                      className="border border-dashed border-border rounded-sm p-4 text-center cursor-pointer relative overflow-hidden"
                    >
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setStoreForm(prev => ({ ...prev, imageFile: f }));
                        }}
                      />
                      {storeForm.imageFile ? (
                        <p className="text-xs text-primary">{storeForm.imageFile.name}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Drop product image or click to select (PNG/JPG)</p>
                      )}
                    </div>
                    <button
                      disabled={!storeForm.title || !storeForm.imageFile || storeMutation.isPending}
                      className="gold-bg px-4 py-2 rounded-sm text-xs w-full disabled:opacity-60"
                      onClick={() => storeMutation.mutate()}
                    >
                      {storeMutation.isPending ? 'Uploading & Creating…' : 'Upload & Create Product'}
                    </button>
                    {storeMutation.error && <p className="text-xs text-destructive">{(storeMutation.error as Error).message}</p>}
                    {storeMutation.data && (
                      <div className="p-3 bg-secondary/30 border border-border rounded-sm mt-3 space-y-2">
                        <p className="text-xs font-medium">✓ Submitted — Job {storeMutation.data.jobId?.slice(0, 8)}</p>
                        <p className="text-[10px] text-muted-foreground">State: {storeMutation.data.state}</p>
                        {storeMutation.data.state === 'needs_review' && (
                          <div className="flex gap-2 mt-2">
                            <button disabled={approveJobMutation.isPending} onClick={() => approveJobMutation.mutate(storeMutation.data.jobId)} className="bg-success/20 text-success px-3 py-1 rounded text-xs">Approve</button>
                            <button disabled={rejectJobMutation.isPending} onClick={() => rejectJobMutation.mutate(storeMutation.data.jobId)} className="bg-destructive/20 text-destructive px-3 py-1 rounded text-xs">Reject</button>
                          </div>
                        )}
                        {storeMutation.data.state === 'published' && (
                          <p className="text-[10px] text-success">✓ Published to <a href="/media" className="underline">/media</a></p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="potg"><div className="panel p-4 space-y-5 max-w-xl">
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
            <div className="p-3 bg-secondary/30 border border-border rounded-sm mt-3 space-y-2">
              <p className="text-xs font-medium">✓ Submitted — Job {potgMutation.data.jobId?.slice(0, 8)}</p>
              <p className="text-[10px] text-muted-foreground">State: {potgMutation.data.state}</p>
              {potgMutation.data.state === 'needs_review' && (
                <div className="flex gap-2 mt-2">
                  <button disabled={approveJobMutation.isPending} onClick={() => approveJobMutation.mutate(potgMutation.data.jobId)} className="bg-success/20 text-success px-3 py-1 rounded text-xs">Approve</button>
                  <button disabled={rejectJobMutation.isPending} onClick={() => rejectJobMutation.mutate(potgMutation.data.jobId)} className="bg-destructive/20 text-destructive px-3 py-1 rounded text-xs">Reject</button>
                </div>
              )}
              {potgMutation.data.state === 'published' && (
                <p className="text-[10px] text-success">✓ Published to <a href="/media" className="underline">/media</a></p>
              )}
            </div>
          )}
        </div>
      </TabsContent>


      <TabsContent value="media">
        <div className="panel p-4 max-w-xl space-y-8">
          <div>
            <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Generic Media Upload</h2>
            {!isSuperAdmin ? (
              <p className="text-sm text-destructive font-semibold">Super Admin required to upload media.</p>
            ) : (
              <div className="space-y-6">
                <div className="border border-primary/30 p-3 rounded-sm bg-primary/5 mb-6">
                  <h3 className="text-sm font-semibold mb-3">Upload Generic Media</h3>
                  <p className="text-xs text-muted-foreground mb-4">Upload an image or video to the media feed.</p>

                  <div className="space-y-2">
                    <input
                      placeholder="Title *"
                      className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm"
                      value={genericMediaForm.title}
                      onChange={e => setGenericMediaForm(f => ({ ...f, title: e.target.value }))}
                    />
                    <div
                      className="border border-dashed border-border rounded-sm p-4 text-center cursor-pointer relative overflow-hidden"
                    >
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setGenericMediaForm(prev => ({ ...prev, file: f }));
                        }}
                      />
                      {genericMediaForm.file ? (
                        <p className="text-xs text-primary">{genericMediaForm.file.name}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Drop media or click to select</p>
                      )}
                    </div>
                    <button
                      disabled={!genericMediaForm.title || !genericMediaForm.file || genericMediaMutation.isPending}
                      className="gold-bg px-4 py-2 rounded-sm text-xs w-full disabled:opacity-60"
                      onClick={() => genericMediaMutation.mutate()}
                    >
                      {genericMediaMutation.isPending ? 'Uploading…' : 'Upload Media'}
                    </button>
                    {genericMediaMutation.error && <p className="text-xs text-destructive">{(genericMediaMutation.error as Error).message}</p>}
                    {genericMediaMutation.data && (
                      <div className="p-3 bg-secondary/30 border border-border rounded-sm mt-3 space-y-2">
                        <p className="text-xs font-medium">✓ Submitted — Job {genericMediaMutation.data.jobId?.slice(0, 8)}</p>
                        <p className="text-[10px] text-muted-foreground">State: {genericMediaMutation.data.state}</p>
                        {genericMediaMutation.data.state === 'needs_review' && (
                          <div className="flex gap-2 mt-2">
                            <button disabled={approveJobMutation.isPending} onClick={() => approveJobMutation.mutate(genericMediaMutation.data.jobId)} className="bg-success/20 text-success px-3 py-1 rounded text-xs">Approve</button>
                            <button disabled={rejectJobMutation.isPending} onClick={() => rejectJobMutation.mutate(genericMediaMutation.data.jobId)} className="bg-destructive/20 text-destructive px-3 py-1 rounded text-xs">Reject</button>
                          </div>
                        )}
                        {genericMediaMutation.data.state === 'published' && (
                          <p className="text-[10px] text-success">✓ Published to <a href="/media" className="underline">/media</a></p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="history"><div className="panel p-4">
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
      </TabsContent>
      </Tabs>
    </div>
  );
};

export default OpsPage;
