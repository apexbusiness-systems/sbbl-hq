const fs = require('fs');
const path = require('path');

const statsPath = path.join(__dirname, 'src', 'pages', 'Stats.tsx');
let statsCode = fs.readFileSync(statsPath, 'utf8');

statsCode = statsCode.replace(
  "import { mockPlayers } from '@/data/mock';\n",
  ""
);

statsCode = statsCode.replace(
  /const players = useMemo<PlayerProfile\[\]>\(\(\) => \{\n\s*const apiData = statsQuery\.data\?\.data;\n\s*if \(Array\.isArray\(apiData\) && apiData\.length > 0 && 'stats' in \(apiData\[0\] \?\? \{\}\)\) \{\n\s*return apiData;\n\s*\}\n\s*return mockPlayers;\n\s*\}, \[statsQuery\.data\]\);/s,
  `const players = useMemo<PlayerProfile[]>(() => {
    const apiData = statsQuery.data?.data;
    if (Array.isArray(apiData) && apiData.length > 0 && 'stats' in (apiData[0] ?? {})) {
      return apiData;
    }
    return [];
  }, [statsQuery.data]);`
);

statsCode = statsCode.replace(
  /enabled: isSignedIn,/g,
  "enabled: true,"
);

fs.writeFileSync(statsPath, statsCode);

const leaderboardsPath = path.join(__dirname, 'src', 'pages', 'Leaderboards.tsx');
let leaderboardsCode = fs.readFileSync(leaderboardsPath, 'utf8');

leaderboardsCode = leaderboardsCode.replace(
  "import { mockPlayers } from '@/data/mock';\n",
  ""
);

leaderboardsCode = leaderboardsCode.replace(
  /const players = useMemo<PlayerProfile\[\]>\(\(\) => \{\n\s*const apiData = leaderboardsQuery\.data\?\.data;\n\s*if \(Array\.isArray\(apiData\) && apiData\.length > 0 && 'stats' in \(apiData\[0\] \?\? \{\}\)\) \{\n\s*return apiData;\n\s*\}\n\s*return mockPlayers;\n\s*\}, \[leaderboardsQuery\.data\]\);/s,
  `const players = useMemo<PlayerProfile[]>(() => {
    const apiData = leaderboardsQuery.data?.data;
    if (Array.isArray(apiData) && apiData.length > 0 && 'stats' in (apiData[0] ?? {})) {
      return apiData;
    }
    return [];
  }, [leaderboardsQuery.data]);`
);

leaderboardsCode = leaderboardsCode.replace(
  /enabled: isSignedIn,/g,
  "enabled: true,"
);

fs.writeFileSync(leaderboardsPath, leaderboardsCode);
