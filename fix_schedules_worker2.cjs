const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, 'src', 'worker', 'index.ts');
let workerCode = fs.readFileSync(workerPath, 'utf8');

if (!workerCode.includes('handlePublicSchedule')) {
  const handlerCode = `
async function handlePublicSchedule({ req, admin }: HandlerCtx) {
  const { data, error } = await admin.from('schedule_slots')
    .select('id,starts_at,ends_at,status,venues(name,address),seasons(leagues(code))')
    .in('status', ['upcoming', 'in_progress'])
    .order('starts_at')
    .limit(100);
  if (error) throw new Error(error.message);
  return json({ ok: true, data: data ?? [] });
}
`;
  workerCode = workerCode.replace(
    /async function handlePublicMedia/,
    handlerCode + '\nasync function handlePublicMedia'
  );

  workerCode = workerCode.replace(
    /\{ method: 'GET', path: '\/api\/public\/media', handler: handlePublicMedia \},/,
    `{ method: 'GET', path: '/api/public/schedule', handler: handlePublicSchedule },\n  { method: 'GET', path: '/api/public/media', handler: handlePublicMedia },`
  );
  fs.writeFileSync(workerPath, workerCode);
}
