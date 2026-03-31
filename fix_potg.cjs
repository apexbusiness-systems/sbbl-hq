const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, 'src', 'worker', 'index.ts');
let workerCode = fs.readFileSync(workerPath, 'utf8');

const potgHandlerCode = `
async function handlePublicPotg({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const league = url.searchParams.get('league');
  const limit = Math.min(20, Number(url.searchParams.get('limit') ?? '4'));
  let query = admin.from('import_jobs')
    .select('id,payload_summary,created_at')
    .eq('job_type', 'potg_award')
    .in('status', ['completed', 'pending_match'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (league) query = query.contains('payload_summary', { leagueId: league });
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return json({ ok: true, data: data ?? [] });
}
`;

workerCode = workerCode.replace(
  /async function handlePublicSchedule/,
  potgHandlerCode + '\nasync function handlePublicSchedule'
);

workerCode = workerCode.replace(
  /\{ method: 'GET', path: '\/api\/public\/schedule', handler: handlePublicSchedule \},/,
  `{ method: 'GET', path: '/api/public/potg', handler: handlePublicPotg },\n  { method: 'GET', path: '/api/public/schedule', handler: handlePublicSchedule },`
);

fs.writeFileSync(workerPath, workerCode);

const homePagePath = path.join(__dirname, 'src', 'pages', 'Home.tsx');
let homeCode = fs.readFileSync(homePagePath, 'utf8');

homeCode = homeCode.replace(
  "import { playersOfTheGame } from '@/data/mock';",
  `import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';`
);

homeCode = homeCode.replace(
  /const hasPotg = playersOfTheGame && playersOfTheGame\.length > 0;/,
  `const potgQuery = useQuery({
    queryKey: ['potg', activeLeague],
    queryFn: () => apiFetch<{ ok: boolean; data: any[] }>('/api/public/potg?league=' + activeLeague.toLowerCase() + '&limit=4'),
    staleTime: 60_000,
  });

  const playersOfTheGame: any[] = potgQuery.data?.data || [];
  const hasPotg = playersOfTheGame && playersOfTheGame.length > 0;`
);

fs.writeFileSync(homePagePath, homeCode);
