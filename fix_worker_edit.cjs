const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, 'src', 'worker', 'index.ts');
let workerCode = fs.readFileSync(workerPath, 'utf8');

const editHandlersCode = `
async function handleEditEntity(ctx: HandlerCtx, table: string, allowedFields: (body: any) => any) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireAdminSession(ctx.req, ctx.admin);
  const id = ctx.params.id;
  const body = await ctx.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, error: 'invalid_body' }, 400);

  const clean = allowedFields(body);

  const { error } = await ctx.admin.from(table).update(clean).eq('id', id);
  if (error) throw new Error(error.message);

  await ctx.admin.from('audit_logs').insert({
    actor_id: session.userId,
    action: \`ops_edit_\${table.replace('_', '-')}\`,
    ref_type: table,
    ref_id: id,
    payload: clean,
    idempotency_key: readIdempotencyKey(ctx.req.headers),
  });

  return json({ ok: true, id });
}

async function handleEditTeam(ctx: HandlerCtx) {
  return handleEditEntity(ctx, 'teams', body => {
    const allowed = { name: body.name, division_id: body.division_id, season_id: body.season_id };
    return Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));
  });
}

async function handleEditPlayer(ctx: HandlerCtx) {
  return handleEditEntity(ctx, 'players', body => {
    const allowed = { name: body.name, position: body.position, jersey_number: body.jersey_number };
    return Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));
  });
}

async function handleEditProduct(ctx: HandlerCtx) {
  return handleEditEntity(ctx, 'products', body => {
    const allowed = { name: body.name, price: body.price, status: body.status };
    return Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));
  });
}

async function handleEditGame(ctx: HandlerCtx) {
  return handleEditEntity(ctx, 'games', body => {
    const allowed = { status: body.status, score: body.score };
    return Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));
  });
}
`;

workerCode = workerCode.replace(
  /async function handleDeleteCartItem/,
  editHandlersCode + '\nasync function handleDeleteCartItem'
);

// If handleDeleteCartItem is not there yet, append before handleGetCart
if (!workerCode.includes('handleDeleteCartItem')) {
    workerCode = workerCode.replace(
        /async function handleGetCart/,
        editHandlersCode + '\nasync function handleGetCart'
    );
}

workerCode = workerCode.replace(
  /\{ method: 'GET', path: '\/ops\/bootstrap', handler: handleOpsBootstrap \},/,
  `{ method: 'GET', path: '/ops/bootstrap', handler: handleOpsBootstrap },
  { method: 'PATCH', path: '/ops/teams/:id', handler: handleEditTeam },
  { method: 'PATCH', path: '/ops/players/:id', handler: handleEditPlayer },
  { method: 'PATCH', path: '/ops/products/:id', handler: handleEditProduct },
  { method: 'PATCH', path: '/ops/games/:id', handler: handleEditGame },`
);

fs.writeFileSync(workerPath, workerCode);
