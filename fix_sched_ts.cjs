const fs = require('fs');
const path = require('path');

const schedPath = path.join(__dirname, 'src', 'pages', 'Schedules.tsx');
let schedCode = fs.readFileSync(schedPath, 'utf8');

schedCode = schedCode.replace(
  /type ScheduleDay = \{ leagueId: string,/g,
  `type ScheduleDay = { leagueId: LeagueId,`
);

fs.writeFileSync(schedPath, schedCode);
