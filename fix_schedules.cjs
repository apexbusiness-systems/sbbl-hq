const fs = require('fs');
const path = require('path');

const schedulePagePath = path.join(__dirname, 'src', 'pages', 'Schedules.tsx');
let schedulePageCode = fs.readFileSync(schedulePagePath, 'utf8');

schedulePageCode = schedulePageCode.replace(
  /const SCHEDULE_DATA: ScheduleDay\[\] = \[\]; \/\/ In a real implementation we would map the fetched data to ScheduleDay structure\./g,
  `const SCHEDULE_DATA: ScheduleDay[] = [];`
);

fs.writeFileSync(schedulePagePath, schedulePageCode);
