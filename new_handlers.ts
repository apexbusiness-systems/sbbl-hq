// Add near handlePublicConfig or handleTeamsList
async function handlePublicSchedule({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get('leagueId');
  let q = admin.from('schedules').select('*').eq('status', 'published');
  if (leagueId) {
    q = q.eq('league_id', leagueId);
  }
  const { data, error } = await q.order('start_time', { ascending: true });
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}

async function handlePublicPotg({ admin }: HandlerCtx) {
  const { data, error } = await admin.from('potg_records').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}

// Ops List handlers
function requireSuperAdmin(req: Request) {
  const role = req.headers.get('x-user-role');
  if (role !== 'super_admin') throw new Error('Forbidden: Super Admin only');
  return requireAuth(req);
}

async function handleOpsListTeams({ req, admin }: HandlerCtx) {
  requireSuperAdmin(req);
  const { data, error } = await admin.from('teams').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}
async function handleOpsListPlayers({ req, admin }: HandlerCtx) {
  requireSuperAdmin(req);
  const { data, error } = await admin.from('players').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}
async function handleOpsListProducts({ req, admin }: HandlerCtx) {
  requireSuperAdmin(req);
  const { data, error } = await admin.from('products').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}
async function handleOpsListEvents({ req, admin }: HandlerCtx) {
  requireSuperAdmin(req);
  const { data, error } = await admin.from('events').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}

// Ops Edit (Patch) handlers
async function handleOpsPatch(table: string, req: Request, admin: any, params: any) {
  await ensureMutation(req, { req, admin, params } as any);
  requireSuperAdmin(req);
  const id = params.id;
  if (!id) throw new Error('Missing ID');
  const body = await req.json().catch(() => null);
  if (!body || Object.keys(body).length === 0) throw new Error('Empty or invalid patch body');

  const { data, error } = await admin.from(table).update(body).eq('id', id).select().single();
  if (error) throw new Error(error.message);

  await admin.from('audit_logs').insert({
    action: `ops_patch_${table}`,
    actor_id: requireAuth(req),
    target_id: id,
    changes: body,
  });

  return json({ ok: true, data });
}
async function handleOpsPatchTeams(ctx: HandlerCtx) { return handleOpsPatch('teams', ctx.req, ctx.admin, ctx.params); }
async function handleOpsPatchPlayers(ctx: HandlerCtx) { return handleOpsPatch('players', ctx.req, ctx.admin, ctx.params); }
async function handleOpsPatchProducts(ctx: HandlerCtx) { return handleOpsPatch('products', ctx.req, ctx.admin, ctx.params); }
async function handleOpsPatchEvents(ctx: HandlerCtx) { return handleOpsPatch('events', ctx.req, ctx.admin, ctx.params); }
async function handleOpsPatchSchedules(ctx: HandlerCtx) { return handleOpsPatch('schedules', ctx.req, ctx.admin, ctx.params); }

// Ops Delete (Archive) handlers
async function handleOpsDelete(table: string, req: Request, admin: any, params: any) {
  await ensureMutation(req, { req, admin, params } as any);
  requireSuperAdmin(req);
  const id = params.id;
  if (!id) throw new Error('Missing ID');

  // Prefer soft delete/archive over hard delete by setting status
  const { data, error } = await admin.from(table).update({ status: 'archived' }).eq('id', id).select().single();
  if (error) throw new Error(error.message);

  await admin.from('audit_logs').insert({
    action: `ops_archive_${table}`,
    actor_id: requireAuth(req),
    target_id: id,
  });

  return json({ ok: true, data });
}
async function handleOpsDeleteTeams(ctx: HandlerCtx) { return handleOpsDelete('teams', ctx.req, ctx.admin, ctx.params); }
async function handleOpsDeletePlayers(ctx: HandlerCtx) { return handleOpsDelete('players', ctx.req, ctx.admin, ctx.params); }
async function handleOpsDeleteProducts(ctx: HandlerCtx) { return handleOpsDelete('products', ctx.req, ctx.admin, ctx.params); }
async function handleOpsDeleteEvents(ctx: HandlerCtx) { return handleOpsDelete('events', ctx.req, ctx.admin, ctx.params); }
