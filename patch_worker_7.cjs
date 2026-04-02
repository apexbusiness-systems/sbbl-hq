const fs = require('fs');
let worker = fs.readFileSync('/app/src/worker/index.ts', 'utf-8');

const additionalWorkerLogic = `
  } else if (kind === 'schedule') {
     if (action === 'create') {
        const { error } = await admin.from('schedules').insert({
           home_team_id: body.homeTeamId,
           away_team_id: body.awayTeamId,
           date: body.date,
           time: body.time,
        });
        if (error) return json({ ok: false, error: error.message }, 500);
     } else if (action === 'delete') {
        const { error } = await admin.from('schedules').delete().eq('id', body.id);
        if (error) return json({ ok: false, error: error.message }, 500);
     }
  } else if (kind === 'event') {
     if (action === 'create') {
        const { error } = await admin.from('events').insert({
           title: body.title,
           location: body.location,
           date: body.date,
        });
        if (error) return json({ ok: false, error: error.message }, 500);
     } else if (action === 'delete') {
        const { error } = await admin.from('events').delete().eq('id', body.id);
        if (error) return json({ ok: false, error: error.message }, 500);
     }
  }
`;

worker = worker.replace("  return json({ ok: true });\n}", additionalWorkerLogic + "  return json({ ok: true });\n}");
fs.writeFileSync('/app/src/worker/index.ts', worker);
