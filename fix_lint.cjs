const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, 'src', 'pages', 'Home.tsx');
let homeCode = fs.readFileSync(homePath, 'utf8');
homeCode = homeCode.replace(/any\[\]/g, 'unknown[]');
homeCode = homeCode.replace(/any\)/g, 'unknown)');
homeCode = homeCode.replace(/any \)/g, 'unknown )');
fs.writeFileSync(homePath, homeCode);

const livePath = path.join(__dirname, 'src', 'pages', 'Live.tsx');
let liveCode = fs.readFileSync(livePath, 'utf8');
liveCode = liveCode.replace(/any\[\]/g, 'unknown[]');
fs.writeFileSync(livePath, liveCode);

const opsPath = path.join(__dirname, 'src', 'pages', 'Ops.tsx');
let opsCode = fs.readFileSync(opsPath, 'utf8');
opsCode = opsCode.replace(/any \| null/g, 'Record<string, unknown> | null');
opsCode = opsCode.replace(/any\)/g, 'Record<string, unknown>)');
opsCode = opsCode.replace(/any \)/g, 'Record<string, unknown> )');
opsCode = opsCode.replace(/any\?/g, 'Record<string, unknown>?');
opsCode = opsCode.replace(/any/g, 'Record<string, unknown>');
fs.writeFileSync(opsPath, opsCode);

const schedPath = path.join(__dirname, 'src', 'pages', 'Schedules.tsx');
let schedCode = fs.readFileSync(schedPath, 'utf8');
schedCode = schedCode.replace(/any\[\]/g, 'unknown[]');
fs.writeFileSync(schedPath, schedCode);

const workerPath = path.join(__dirname, 'src', 'worker', 'index.ts');
let workerCode = fs.readFileSync(workerPath, 'utf8');
workerCode = workerCode.replace(/allowedFields: \(body: any\) => any/g, 'allowedFields: (body: Record<string, unknown>) => Record<string, unknown>');

// Fix "let query" at line 1662. We can just run a regex that matches let query = admin.from('schedule_slots') where it doesn't get reassigned.
workerCode = workerCode.replace(/let query = admin\.from\('schedule_slots'\)/, "const query = admin.from('schedule_slots')");

fs.writeFileSync(workerPath, workerCode);
