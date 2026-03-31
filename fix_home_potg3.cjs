const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, 'src', 'pages', 'Home.tsx');
let homeCode = fs.readFileSync(homePath, 'utf8');

// I need to add potgQuery back into the component.
const queryStr = `const potgQuery = useQuery({
    queryKey: ['potg', activeLeague],
    queryFn: () => apiFetch<{ ok: boolean; data: any[] }>('/api/public/potg?league=' + activeLeague.toLowerCase() + '&limit=4'),
    staleTime: 60_000,
  });`;

homeCode = homeCode.replace(
  /const \[state, setState\] = useState<LoadState>\('loading'\);/,
  `const [state, setState] = useState<LoadState>('loading');\n  ${queryStr}`
);

// We also need to map to the PlayerOfTheGame type properly.
// The component is expecting PotgCard to receive PlayerOfTheGame type:
// { id: string, name: string, teamId: string, leagueId: LeagueId, avatar: string, stats: Record<string, number>, playerName: string, team: string, pts: number, rebs: number, assts: number }

homeCode = homeCode.replace(
  /const potgList = \(playersOfTheGame \|\| \[\]\)\.map\(\(job: any\) => \(\{[\s\S]*?gameResult: job\.payload_summary\.gameResult \|\| ''\n\s*\}\)\);/,
  `const potgList = (playersOfTheGame || []).map((job: any) => ({
    id: job.id,
    playerId: job.payload_summary.playerId || '',
    name: job.payload_summary.playerName || '',
    playerName: job.payload_summary.playerName || '',
    avatar: '',
    teamId: job.payload_summary.team || '',
    team: job.payload_summary.team || '',
    leagueId: job.payload_summary.leagueId || resolvedLeague,
    pts: parseInt(job.payload_summary.pts || '0'),
    rebs: parseInt(job.payload_summary.rebs || '0'),
    assts: parseInt(job.payload_summary.assts || '0'),
    stats: {
      pts: parseInt(job.payload_summary.pts || '0'),
      rebs: parseInt(job.payload_summary.rebs || '0'),
      assts: parseInt(job.payload_summary.assts || '0')
    },
    date: job.created_at,
    gameResult: job.payload_summary.gameResult || ''
  }));`
);

fs.writeFileSync(homePath, homeCode);
