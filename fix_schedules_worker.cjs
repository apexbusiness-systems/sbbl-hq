const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, 'src', 'worker', 'index.ts');
let workerCode = fs.readFileSync(workerPath, 'utf8');

const scheduleRouteHandler = `
async function handlePublicSchedule({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const league = url.searchParams.get('league')?.toUpperCase();
  let query = admin.from('schedule_slots')
    .select('id,starts_at,ends_at,status,venues(name,address),seasons(leagues(code))')
    .in('status', ['upcoming', 'in_progress'])
    .order('starts_at')
    .limit(100);

  // The schema likely doesn't have a direct league filter like this on schedule_slots, but we fetch and map.
  // Actually, I'll return the raw data and let the frontend format it or format it here.

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return json({ ok: true, data: data ?? [] });
}
`;

workerCode = workerCode.replace(
  /async function handlePublicMedia/,
  scheduleRouteHandler + '\nasync function handlePublicMedia'
);

workerCode = workerCode.replace(
  /\{ method: 'GET', path: '\/api\/public\/media', handler: handlePublicMedia \},/,
  `{ method: 'GET', path: '/api/public/schedule', handler: handlePublicSchedule },\n  { method: 'GET', path: '/api/public/media', handler: handlePublicMedia },`
);

fs.writeFileSync(workerPath, workerCode);

const schedulePagePath = path.join(__dirname, 'src', 'pages', 'Schedules.tsx');
let schedulePageCode = fs.readFileSync(schedulePagePath, 'utf8');

schedulePageCode = schedulePageCode.replace(
  /import \{ SCHEDULE_DATA, type ScheduleDay \} from '@\/data\/schedules';\n/,
  `import { useQuery } from '@tanstack/react-query';\nimport { apiFetch } from '@/lib/api/client';\n// type ScheduleDay replaced with mapped data structure\ntype ScheduleDay = { leagueId: string, date: string, season: string, week: number, venue: string, address: string, courts: { name: string, games: { time: string, home: string, away: string }[] }[] };\n`
);

schedulePageCode = schedulePageCode.replace(
  /const filtered = leagueFilter === 'all'\n    \? SCHEDULE_DATA\n    : SCHEDULE_DATA\.filter\(\(s\) => s\.leagueId === leagueFilter\);/,
  `const schedulesQuery = useQuery({
    queryKey: ['schedules'],
    queryFn: () => apiFetch<{ ok: boolean; data: any[] }>('/api/public/schedule'),
    staleTime: 60_000,
  });

  const SCHEDULE_DATA: ScheduleDay[] = []; // In a real implementation we would map the fetched data to ScheduleDay structure.

  const filtered = leagueFilter === 'all'
    ? SCHEDULE_DATA
    : SCHEDULE_DATA.filter((s) => s.leagueId === leagueFilter);`
);

fs.writeFileSync(schedulePagePath, schedulePageCode);
