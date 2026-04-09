const fs = require('fs');
const content = fs.readFileSync('src/worker/index.ts', 'utf-8');
const cacheControlLines = content.split('\n').filter(line => line.includes('Cache-Control'));
console.log(cacheControlLines);
