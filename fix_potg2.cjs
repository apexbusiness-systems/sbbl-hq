const fs = require('fs');
const path = require('path');

const homePagePath = path.join(__dirname, 'src', 'pages', 'Home.tsx');
let homeCode = fs.readFileSync(homePagePath, 'utf8');

homeCode = homeCode.replace(
  /const potgList = playersOfTheGame\.filter\(p => p\.leagueId === resolvedLeague\);/,
  `// In a real scenario we might map import_jobs to PotgProfile here.
  const potgList = (potgQuery.data?.data || []).map((job: any) => ({
    id: job.id,
    playerId: job.payload_summary.playerId || '',
    name: job.payload_summary.playerName || '',
    avatar: '',
    teamId: job.payload_summary.team || '',
    leagueId: job.payload_summary.leagueId || resolvedLeague,
    stats: {
      pts: parseInt(job.payload_summary.pts || '0'),
      rebs: parseInt(job.payload_summary.rebs || '0'),
      assts: parseInt(job.payload_summary.assts || '0')
    },
    date: job.created_at,
    gameResult: job.payload_summary.gameResult || ''
  }));`
);

fs.writeFileSync(homePagePath, homeCode);
