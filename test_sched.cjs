const fs = require('fs');
const path = require('path');
const file = fs.readFileSync(path.join(__dirname, 'src/pages/Schedules.tsx'), 'utf8');
if (file.includes('SCHEDULE_DATA')) {
  console.log('SCHEDULE_DATA is in file');
}
