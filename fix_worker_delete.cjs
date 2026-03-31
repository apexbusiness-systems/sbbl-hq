const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, 'src', 'worker', 'index.ts');
let workerCode = fs.readFileSync(workerPath, 'utf8');

const deleteHandlersCode = `
async function handleDeleteEntity(table: string) {
  return async (ctx: HandlerCtx) => {
    await ensureMutation(ctx.req, ctx);
    const session = await requireAdminSession(ctx.req, ctx.admin);
    const { id } = ctx.params;

    const { error } = await ctx.admin.from(table).update({ status: 'archived' }).eq('id', id);
    if (error) throw new Error(error.message);

    await ctx.admin.from('audit_logs').insert({
      actor_id: session.userId,
      action: \`ops_delete_\${table.replace('_', '-')}\`,
      ref_type: table,
      ref_id: id,
      payload: { soft_deleted: true },
      idempotency_key: readIdempotencyKey(ctx.req.headers),
    });

    return json({ ok: true, id, archived: true });
  };
}
`;

workerCode = workerCode.replace(
  /async function handleGetCart/,
  deleteHandlersCode + '\nasync function handleGetCart'
);

workerCode = workerCode.replace(
  /\{ method: 'GET', path: '\/ops\/bootstrap', handler: handleOpsBootstrap \},/,
  `{ method: 'GET', path: '/ops/bootstrap', handler: handleOpsBootstrap },
  { method: 'DELETE', path: '/ops/teams/:id', handler: handleDeleteEntity('teams') },
  { method: 'DELETE', path: '/ops/players/:id', handler: handleDeleteEntity('players') },
  { method: 'DELETE', path: '/ops/products/:id', handler: handleDeleteEntity('products') },
  { method: 'DELETE', path: '/ops/games/:id', handler: handleDeleteEntity('games') },`
);

fs.writeFileSync(workerPath, workerCode);
