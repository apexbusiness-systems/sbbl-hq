const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, 'src', 'worker', 'index.ts');
let workerCode = fs.readFileSync(workerPath, 'utf8');

workerCode = workerCode.replace(
  /async function handleDeleteEntity\(table: string\)/,
  `function handleDeleteEntity(table: string)`
);

fs.writeFileSync(workerPath, workerCode);
