import { parseCsv } from '@/lib/parseCsv';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Upload, Loader2, CheckCircle2, AlertCircle, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PotgCard } from '@/components/ui/PotgCard';
import { fetchOpsBootstrap, fetchImportHistory, submitCsvImport, uploadStoreMedia, parsePotgImage, submitPotgRecord, manualOpsAction } from '@/lib/api/ops';
import { requireSupabaseClient, hasSupabaseClientConfig } from '@/lib/supabase/client';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { resizeImageToFit } from '@/lib/imageResize';
import { fetchAdminStreamConfig, fetchPublicStreamStatus, fetchReviewQueue, fetchStreamRevenue, fetchStreamSessions, resolveReviewItem, setStreamLive, updateStreamConfig } from '@/lib/api/stream';
import { getAuthToken } from '@/lib/api/client';
import { fetchScores, submitScoreManual, submitScoresCsvImport, parseScoreboardImage } from '@/lib/api/scores';
import type { ScoreCategory } from '@/types';

type Tab = 'overview' | 'streams' | 'scores' | 'teams' | 'players' | 'schedules' | 'events' | 'store' | 'potg' | 'history';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview',  label: 'Overview'       },
  { id: 'streams',   label: 'Streams'        },
  { id: 'scores',    label: 'Scores'         },
  { id: 'teams',     label: 'Teams'          },
  { id: 'players',   label: 'Players'        },
  { id: 'schedules', label: 'Schedules'      },
  { id: 'events',    label: 'Events'         },
  { id: 'store',     label: 'Store Media'    },
  { id: 'potg',      label: 'POTG Parser'    },
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
  const [streamForm, setStreamForm] = useState({ collectionId: '', title: '', source: 'main' as 'main' | 'backup' | 'test' });
  const [reviewResolution, setReviewResolution] = useState<Record<string, 'resolved' | 'dismissed'>>({});
  const isSuperAdmin = roles.includes('super_admin');

  // ── Admin CRUD form state ──────────────────────────────────────────────────
  const [teamForm, setTeamForm] = useState({ name: '', leagueId: '', seasonId: '', divisionId: '' });
  const [deleteTeamId, setDeleteTeamId] = useState('');

  const [playerForm, setPlayerForm] = useState({ userId: '', teamId: '', leagueId: '', jerseyNumber: '', position: '' });
  const [deletePlayerId, setDeletePlayerId] = useState('');
  const [suspendPlayerId, setSuspendPlayerId] = useState('');
  const [suspendPlayerReason, setSuspendPlayerReason] = useState('');

  const [scheduleForm, setScheduleForm] = useState({ leagueId: '', seasonId: '', startsAt: '', endsAt: '' });
  const [deleteScheduleId, setDeleteScheduleId] = useState('');

  const [eventForm, setEventForm] = useState({ title: '', location: '', date: '', leagueId: '' });
  const [deleteEventId, setDeleteEventId] = useState('');

  const [storeBatchItems, setStoreBatchItems] = useState([
    { title: '', price: '', category: 'apparel' },
    { title: '', price: '', category: 'apparel' },
    { title: '', price: '', category: 'apparel' },
    { title: '', price: '', category: 'apparel' },
  ]);
  const [storeSuspendId, setStoreSuspendId] = useState('');
  const [storeDeleteId, setStoreDeleteId] = useState('');

  // ── Scores state ──────────────────────────────────────────────────────────
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

  const updateStoreBatchItem = (i: number, field: string, value: string) =>
    setStoreBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

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
  const streamStatusQuery = useQuery({ queryKey: ['ops-stream-public-status'], queryFn: () => fetchPublicStreamStatus(), refetchInterval: 15000 });
  const streamConfigQuery = useQuery({
    queryKey: ['ops-stream-config'],
    queryFn: async () => fetchAdminStreamConfig(await getAuthToken()),
  });
  const streamSessionsQuery = useQuery({
    queryKey: ['ops-stream-sessions'],
    queryFn: async () => fetchStreamSessions(await getAuthToken()),
  });
  const streamRevenueQuery = useQuery({
    queryKey: ['ops-stream-revenue'],
    queryFn: async () => fetchStreamRevenue(await getAuthToken()),
  });
  const reviewQueueQuery = useQuery({
    queryKey: ['ops-stream-review'],
    queryFn: async () => fetchReviewQueue(await getAuthToken()),
  });

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

  const streamConfigMutation = useMutation({
    mutationFn: async () => updateStreamConfig(streamForm, await getAuthToken()),
    onSuccess: async (res) => {
      setStreamForm({
        collectionId: res.config.collectionId,
        title: res.config.title,
        source: res.config.source,
      });
      await queryClient.invalidateQueries({ queryKey: ['ops-stream-config'] });
    },
  });

  const streamLiveMutation = useMutation({
    mutationFn: async (nextLive: boolean) => setStreamLive(nextLive, await getAuthToken()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-stream-public-status'] });
      await queryClient.invalidateQueries({ queryKey: ['ops-stream-config'] });
      await queryClient.invalidateQueries({ queryKey: ['ops-stream-sessions'] });
    },
  });

  const resolveReviewMutation = useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: 'resolved' | 'dismissed' }) =>
      resolveReviewItem(id, resolution, await getAuthToken()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-stream-review'] });
    },
  });

  // ── Admin CRUD mutations ───────────────────────────────────────────────
  const createTeamMutation = useMutation({
    mutationFn: () => manualOpsAction('team', 'create', {
      name: teamForm.name,
      leagueId: teamForm.leagueId,
      seasonId: teamForm.seasonId,
      divisionId: teamForm.divisionId || undefined,
    }),
    onSuccess: async () => {
      setTeamForm({ name: '', leagueId: '', seasonId: '', divisionId: '' });
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: () => manualOpsAction('team', 'delete', { id: deleteTeamId }),
    onSuccess: async () => {
      setDeleteTeamId('');
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const createPlayerMutation = useMutation({
    mutationFn: () => manualOpsAction('player', 'create', {
      userId: playerForm.userId,
      teamId: playerForm.teamId || undefined,
      leagueId: playerForm.leagueId || undefined,
      jerseyNumber: playerForm.jerseyNumber ? Number(playerForm.jerseyNumber) : undefined,
      position: playerForm.position || undefined,
    }),
    onSuccess: async () => {
      setPlayerForm({ userId: '', teamId: '', leagueId: '', jerseyNumber: '', position: '' });
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const suspendPlayerMutation = useMutation({
    mutationFn: () => manualOpsAction('player', 'suspend', { id: suspendPlayerId, reason: suspendPlayerReason || undefined }),
    onSuccess: async () => {
      setSuspendPlayerId('');
      setSuspendPlayerReason('');
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const deletePlayerMutation = useMutation({
    mutationFn: () => manualOpsAction('player', 'delete', { id: deletePlayerId }),
    onSuccess: async () => {
      setDeletePlayerId('');
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: () => manualOpsAction('schedule', 'create', {
      leagueId: scheduleForm.leagueId,
      seasonId: scheduleForm.seasonId,
      startsAt: scheduleForm.startsAt,
      endsAt: scheduleForm.endsAt || undefined,
    }),
    onSuccess: async () => {
      setScheduleForm({ leagueId: '', seasonId: '', startsAt: '', endsAt: '' });
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: () => manualOpsAction('schedule', 'delete', { id: deleteScheduleId }),
    onSuccess: async () => {
      setDeleteScheduleId('');
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: () => manualOpsAction('event', 'create', {
      title: eventForm.title,
      location: eventForm.location || undefined,
      date: eventForm.date || undefined,
      leagueId: eventForm.leagueId || undefined,
    }),
    onSuccess: async () => {
      setEventForm({ title: '', location: '', date: '', leagueId: '' });
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: () => manualOpsAction('event', 'delete', { id: deleteEventId }),
    onSuccess: async () => {
      setDeleteEventId('');
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const storeBatchMutation = useMutation({
    mutationFn: () => manualOpsAction('store', 'batch_create', {
      items: storeBatchItems
        .filter(it => it.title.trim())
        .map(it => ({ title: it.title, price: Number(it.price) || 0, category: it.category })),
    }),
    onSuccess: async () => {
      setStoreBatchItems([
        { title: '', price: '', category: 'apparel' },
        { title: '', price: '', category: 'apparel' },
        { title: '', price: '', category: 'apparel' },
        { title: '', price: '', category: 'apparel' },
      ]);
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const storeSuspendMutation = useMutation({
    mutationFn: () => manualOpsAction('store', 'suspend', { id: storeSuspendId }),
    onSuccess: async () => {
      setStoreSuspendId('');
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
  });

  const storeDeleteMutation = useMutation({
    mutationFn: () => manualOpsAction('store', 'delete', { id: storeDeleteId }),
    onSuccess: async () => {
      setStoreDeleteId('');
      await queryClient.invalidateQueries({ queryKey: ['ops-bootstrap'] });
    },
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

  useEffect(() => {
    const cfg = streamConfigQuery.data?.config;
    if (!cfg) return;
    setStreamForm((prev) => {
      if (prev.collectionId === cfg.collectionId && prev.title === cfg.title && prev.source === cfg.source) return prev;
      return { collectionId: cfg.collectionId, title: cfg.title, source: cfg.source };
    });
  }, [streamConfigQuery.data?.config]);

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

      {activeTab === 'streams' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="panel p-4">
              <p className="text-xs text-muted-foreground">Public stream status</p>
              <p className={`stat-numeral text-3xl ${streamStatusQuery.data?.isLive ? 'text-success' : 'text-muted-foreground'}`}>
                {streamStatusQuery.data?.isLive ? 'LIVE' : 'OFFLINE'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{streamStatusQuery.data?.title ?? 'No stream title set'}</p>
            </div>
            <div className="panel p-4">
              <p className="text-xs text-muted-foreground">Viewer count</p>
              <p className="stat-numeral text-3xl">{streamStatusQuery.data?.viewerCount ?? 0}</p>
            </div>
            <div className="panel p-4">
              <p className="text-xs text-muted-foreground">PPV revenue</p>
              <p className="stat-numeral text-3xl">{streamRevenueQuery.data?.totalPpvRevenue ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Orders: {streamRevenueQuery.data?.totalPpvOrders ?? 0}</p>
            </div>
          </div>

          <div className="panel p-4 space-y-3 max-w-2xl">
            <h2 className="font-display text-xl">Admin Stream Controls</h2>
            <p className="text-xs text-muted-foreground">Visible to admins. Live toggle and config save are restricted to super admins.</p>
            <input
              placeholder="Stream URL"
              className="w-full bg-secondary border border-border rounded-sm px-3 py-2"
              value={streamForm.collectionId}
              onChange={(e) => setStreamForm((s) => ({ ...s, collectionId: e.target.value }))}
            />
            <input
              placeholder="Stream title"
              className="w-full bg-secondary border border-border rounded-sm px-3 py-2"
              value={streamForm.title}
              onChange={(e) => setStreamForm((s) => ({ ...s, title: e.target.value }))}
            />
            <select
              className="w-full bg-secondary border border-border rounded-sm px-3 py-2"
              value={streamForm.source}
              onChange={(e) => setStreamForm((s) => ({ ...s, source: e.target.value as 'main' | 'backup' | 'test' }))}
            >
              <option value="main">Main</option>
              <option value="backup">Backup</option>
              <option value="test">Test</option>
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                className="gold-bg px-4 py-2 rounded-sm disabled:opacity-60"
                disabled={!isSuperAdmin || streamConfigMutation.isPending}
                onClick={() => streamConfigMutation.mutate()}
              >
                {streamConfigMutation.isPending ? 'Saving…' : 'Save Config'}
              </button>
              <button
                className="px-4 py-2 rounded-sm border border-border disabled:opacity-60"
                disabled={!isSuperAdmin || streamLiveMutation.isPending}
                onClick={() => streamLiveMutation.mutate(!(streamStatusQuery.data?.isLive ?? false))}
              >
                {streamLiveMutation.isPending ? 'Updating…' : (streamStatusQuery.data?.isLive ? 'Go Offline' : 'Go Live')}
              </button>
            </div>
            {!isSuperAdmin && <p className="text-xs text-warning">Super admin role required for live/config changes.</p>}
            {(streamConfigMutation.error || streamLiveMutation.error) && (
              <p className="text-xs text-destructive">{(streamConfigMutation.error as Error)?.message ?? (streamLiveMutation.error as Error)?.message}</p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="panel p-4">
              <h3 className="font-display text-lg mb-2">Review Queue</h3>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {(reviewQueueQuery.data?.queue ?? []).map((item) => (
                  <div key={item.id} className="border border-border rounded-sm p-2 text-xs space-y-2">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground">{item.type} · {item.status}</p>
                    <div className="flex gap-2">
                      <select
                        className="bg-secondary border border-border rounded-sm px-2 py-1"
                        value={reviewResolution[item.id] ?? 'resolved'}
                        onChange={(e) => setReviewResolution((s) => ({ ...s, [item.id]: e.target.value as 'resolved' | 'dismissed' }))}
                      >
                        <option value="resolved">Resolve</option>
                        <option value="dismissed">Dismiss</option>
                      </select>
                      <button
                        className="px-2 py-1 border border-border rounded-sm disabled:opacity-60"
                        disabled={resolveReviewMutation.isPending}
                        onClick={() => resolveReviewMutation.mutate({ id: item.id, resolution: reviewResolution[item.id] ?? 'resolved' })}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel p-4">
              <h3 className="font-display text-lg mb-2">Session History</h3>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {(streamSessionsQuery.data?.sessions ?? []).map((s) => (
                  <div key={s.id} className="border border-border rounded-sm p-2 text-xs">
                    <p className="font-medium">Game {s.gameId}</p>
                    <p className="text-muted-foreground">{s.startedAt} → {s.endedAt ?? 'active'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'scores' && (
        <div className="space-y-6">
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
                  <input placeholder="Team Name *" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} />
                  <input placeholder="League ID (UUID) *" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={teamForm.leagueId} onChange={e => setTeamForm(f => ({ ...f, leagueId: e.target.value }))} />
                  <input placeholder="Season ID (UUID) *" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={teamForm.seasonId} onChange={e => setTeamForm(f => ({ ...f, seasonId: e.target.value }))} />
                  <input placeholder="Division ID (optional)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={teamForm.divisionId} onChange={e => setTeamForm(f => ({ ...f, divisionId: e.target.value }))} />
                  <button disabled={!teamForm.name || !teamForm.leagueId || !teamForm.seasonId || createTeamMutation.isPending} className="gold-bg px-4 py-2 rounded-sm text-xs w-full disabled:opacity-60" onClick={() => createTeamMutation.mutate()}>{createTeamMutation.isPending ? 'Creating…' : 'Create Team'}</button>
                  {createTeamMutation.error && <p className="text-xs text-destructive">{(createTeamMutation.error as Error).message}</p>}
                  {createTeamMutation.isSuccess && <p className="text-xs text-success">Team created.</p>}
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Team</h3>
                <div className="flex gap-2">
                  <input placeholder="Team ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={deleteTeamId} onChange={e => setDeleteTeamId(e.target.value)} />
                  <button disabled={!deleteTeamId || deleteTeamMutation.isPending} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs disabled:opacity-60" onClick={() => deleteTeamMutation.mutate()}>{deleteTeamMutation.isPending ? '…' : 'Delete'}</button>
                </div>
                {deleteTeamMutation.error && <p className="text-xs text-destructive mt-1">{(deleteTeamMutation.error as Error).message}</p>}
                {deleteTeamMutation.isSuccess && <p className="text-xs text-success mt-1">Team archived.</p>}
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
      )}


      {activeTab === 'schedules' && (
        <div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Schedules Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage schedules.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Schedule Slot</h3>
                <div className="space-y-2">
                  <input placeholder="League ID (UUID) *" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={scheduleForm.leagueId} onChange={e => setScheduleForm(f => ({ ...f, leagueId: e.target.value }))} />
                  <input placeholder="Season ID (UUID) *" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={scheduleForm.seasonId} onChange={e => setScheduleForm(f => ({ ...f, seasonId: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Starts At *</label>
                      <input type="datetime-local" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm mt-1" value={scheduleForm.startsAt} onChange={e => setScheduleForm(f => ({ ...f, startsAt: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Ends At</label>
                      <input type="datetime-local" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm mt-1" value={scheduleForm.endsAt} onChange={e => setScheduleForm(f => ({ ...f, endsAt: e.target.value }))} />
                    </div>
                  </div>
                  <button disabled={!scheduleForm.leagueId || !scheduleForm.seasonId || !scheduleForm.startsAt || createScheduleMutation.isPending} className="gold-bg px-4 py-2 rounded-sm text-xs w-full disabled:opacity-60" onClick={() => createScheduleMutation.mutate()}>{createScheduleMutation.isPending ? 'Creating…' : 'Create Schedule'}</button>
                  {createScheduleMutation.error && <p className="text-xs text-destructive">{(createScheduleMutation.error as Error).message}</p>}
                  {createScheduleMutation.isSuccess && <p className="text-xs text-success">Schedule slot created.</p>}
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Schedule Entry</h3>
                <div className="flex gap-2">
                  <input placeholder="Schedule Slot ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={deleteScheduleId} onChange={e => setDeleteScheduleId(e.target.value)} />
                  <button disabled={!deleteScheduleId || deleteScheduleMutation.isPending} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs disabled:opacity-60" onClick={() => deleteScheduleMutation.mutate()}>{deleteScheduleMutation.isPending ? '…' : 'Delete'}</button>
                </div>
                {deleteScheduleMutation.error && <p className="text-xs text-destructive mt-1">{(deleteScheduleMutation.error as Error).message}</p>}
                {deleteScheduleMutation.isSuccess && <p className="text-xs text-success mt-1">Schedule slot deleted.</p>}
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
                  <input placeholder="Event Title *" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} />
                  <input placeholder="Location (optional)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} />
                  <input placeholder="League ID (optional)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventForm.leagueId} onChange={e => setEventForm(f => ({ ...f, leagueId: e.target.value }))} />
                  <input type="date" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} />
                  <button disabled={!eventForm.title || createEventMutation.isPending} className="gold-bg px-4 py-2 rounded-sm text-xs w-full disabled:opacity-60" onClick={() => createEventMutation.mutate()}>{createEventMutation.isPending ? 'Creating…' : 'Create Event'}</button>
                  {createEventMutation.error && <p className="text-xs text-destructive">{(createEventMutation.error as Error).message}</p>}
                  {createEventMutation.isSuccess && <p className="text-xs text-success">Event created.</p>}
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
                        <input placeholder="Title" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={storeBatchItems[i].title} onChange={e => updateStoreBatchItem(i, 'title', e.target.value)} />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" placeholder="Price (USD)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={storeBatchItems[i].price} onChange={e => updateStoreBatchItem(i, 'price', e.target.value)} />
                        </div>
                        <select className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" value={storeBatchItems[i].category} onChange={e => updateStoreBatchItem(i, 'category', e.target.value)}>
                          <option value="apparel">Apparel</option>
                          <option value="accessories">Accessories</option>
                          <option value="rewards">Rewards</option>
                        </select>
                      </div>
                    ))}
                    <button disabled={storeBatchItems.every(it => !it.title.trim()) || storeBatchMutation.isPending} className="gold-bg px-4 py-2 rounded-sm text-xs w-full disabled:opacity-60" onClick={() => storeBatchMutation.mutate()}>{storeBatchMutation.isPending ? 'Submitting…' : 'Submit Batch'}</button>
                    {storeBatchMutation.error && <p className="text-xs text-destructive">{(storeBatchMutation.error as Error).message}</p>}
                    {storeBatchMutation.isSuccess && <p className="text-xs text-success">Products created.</p>}
                  </div>
                </div>

                {/* Manage Products */}
                <div className="border border-border p-3 rounded-sm">
                  <h3 className="text-sm font-semibold mb-2">Manage Products</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border border-warning/20 p-3 rounded-sm bg-warning/5">
                      <h4 className="text-[10px] font-semibold text-warning mb-2 uppercase tracking-widest">Suspend</h4>
                      <input placeholder="Product ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-1.5 text-xs mb-2" value={storeSuspendId} onChange={e => setStoreSuspendId(e.target.value)} />
                      <button disabled={!storeSuspendId || storeSuspendMutation.isPending} className="bg-warning hover:bg-warning/90 text-warning-foreground px-3 py-1.5 rounded-sm text-[10px] w-full text-black disabled:opacity-60" onClick={() => storeSuspendMutation.mutate()}>{storeSuspendMutation.isPending ? '…' : 'Suspend'}</button>
                      {storeSuspendMutation.error && <p className="text-[10px] text-destructive mt-1">{(storeSuspendMutation.error as Error).message}</p>}
                      {storeSuspendMutation.isSuccess && <p className="text-[10px] text-success mt-1">Product suspended.</p>}
                    </div>
                    <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                      <h4 className="text-[10px] font-semibold text-destructive mb-2 uppercase tracking-widest">Delete</h4>
                      <input placeholder="Product ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-1.5 text-xs mb-2" value={storeDeleteId} onChange={e => setStoreDeleteId(e.target.value)} />
                      <button disabled={!storeDeleteId || storeDeleteMutation.isPending} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-sm text-[10px] w-full disabled:opacity-60" onClick={() => storeDeleteMutation.mutate()}>{storeDeleteMutation.isPending ? '…' : 'Delete'}</button>
                      {storeDeleteMutation.error && <p className="text-[10px] text-destructive mt-1">{(storeDeleteMutation.error as Error).message}</p>}
                      {storeDeleteMutation.isSuccess && <p className="text-[10px] text-success mt-1">Product archived.</p>}
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
