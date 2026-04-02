const fs = require('fs');

let content = fs.readFileSync('src/pages/Schedules.tsx', 'utf8');

// Add import
const importToAdd = `import { useQuery } from '@tanstack/react-query';
import { fetchPublicSchedule } from '@/lib/api/public';
`;
content = content.replace("import { useState, useEffect } from 'react';", importToAdd + "import { useState, useEffect } from 'react';");

// Inside component: fetch live data
const hooksStr = `  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(
    isValidParam
      ? (paramLeague as LeagueId | 'all')
      : (activeLeague || 'all')
  );`;

const liveQueryStr = `
  const { data: liveDataRes, isLoading } = useQuery({
    queryKey: ['public-schedule', leagueFilter],
    queryFn: () => fetchPublicSchedule(leagueFilter),
    staleTime: 1000 * 60 * 5,
  });
  const liveSchedules = liveDataRes?.data || [];
`;

content = content.replace(hooksStr, hooksStr + liveQueryStr);

// Display logic: show live if available, else static
const mapFallbackStr = `  const filtered = leagueFilter === 'all'
    ? SCHEDULE_DATA
    : SCHEDULE_DATA.filter((s) => s.leagueId === leagueFilter);`;

const newMapStr = `  const filtered = leagueFilter === 'all'
    ? SCHEDULE_DATA
    : SCHEDULE_DATA.filter((s) => s.leagueId === leagueFilter);

  // Safely map live schedules into ScheduleDay shape if we have them
  // Group by league and date, then court
  const groupedLive = liveSchedules.reduce((acc: any, curr: any) => {
    const key = \`\${curr.league_id}-\${curr.start_time.split('T')[0]}\`;
    if (!acc[key]) {
      acc[key] = {
        leagueId: curr.league_id,
        season: 'Current Season',
        week: '1',
        date: curr.start_time.split('T')[0],
        venue: curr.venue || 'TBA',
        address: curr.address || 'TBA',
        courts: {}
      };
    }
    const courtName = curr.court || 'Main Court';
    if (!acc[key].courts[courtName]) {
      acc[key].courts[courtName] = [];
    }
    const time = new Date(curr.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    acc[key].courts[courtName].push({
      time,
      home: curr.home_team_id || 'TBA',
      away: curr.away_team_id || 'TBA'
    });
    return acc;
  }, {});

  const mappedLiveSchedules: ScheduleDay[] = Object.values(groupedLive).map((g: any) => ({
    ...g,
    courts: Object.entries(g.courts).map(([name, games]) => ({ name, games: games as any[] }))
  }));

  const displayData = mappedLiveSchedules.length > 0 ? mappedLiveSchedules : filtered;
`;

content = content.replace(mapFallbackStr, newMapStr);

// Display notice
const renderMapStr = `        <div className="space-y-8">
          {filtered.map((day) => (`

const newRenderMapStr = `        {mappedLiveSchedules.length === 0 && !isLoading && (
          <div className="mb-6 p-4 rounded-md border border-border bg-secondary/30 text-sm text-muted-foreground flex items-center gap-3">
             <Calendar className="w-4 h-4 text-primary" />
             <span>Showing scheduled season structure. Live game times will be updated when finalized.</span>
          </div>
        )}

        <div className="space-y-8">
          {displayData.map((day) => (`

content = content.replace(renderMapStr, newRenderMapStr);

fs.writeFileSync('src/pages/Schedules.tsx', content);
