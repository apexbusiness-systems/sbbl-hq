const fs = require('fs');

const file = 'src/worker/index.ts';
let code = fs.readFileSync(file, 'utf8');

const insertBlock = `
// ── ENTITY EDIT (PATCH) ──────────────────────────────────────────────────────

type EditableTable = 'teams' | 'players' | 'products' | 'league_events' | 'schedule_slots';

const EDITABLE_FIELDS: Record<EditableTable, string[]> = {
  teams: ['name', 'division_id', 'season_id', 'status'],
  players: ['jersey_number', 'position', 'height', 'team_id', 'league_id'],
  products: ['name', 'price', 'status', 'league_id'],
  league_events: ['title', 'starts_at', 'venue_id', 'metadata'],
  schedule_slots: ['starts_at', 'ends_at', 'venue_id', 'court_id', 'status'],
};

function makeEditHandler(table: EditableTable) {
  return async function handleEdit(ctx: HandlerCtx) {
    await ensureMutation(ctx.req, ctx);
    const session = await requireAdminSession(ctx.req, ctx.admin);
    const { id } = ctx.params;
    if (!id) return json({ ok: false, error: 'id_required' }, 400);

    const body = await ctx.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ ok: false, error: 'invalid_body' }, 400);

    const allowed = EDITABLE_FIELDS[table];
    const patch = Object.fromEntries(
      Object.entries(body).filter(([k, v]) => allowed.includes(k) && v !== undefined),
    );
    if (Object.keys(patch).length === 0) return json({ ok: false, error: 'no_valid_fields' }, 400);

    const { error } = await ctx.admin.from(table).update(patch).eq('id', id);
    if (error) throw new Error(error.message);

    await ctx.admin.from('audit_logs').insert({
      actor_id: session.userId,
      action: \`ops_edit_\${table}\`,
      ref_type: table,
      ref_id: id,
      payload: patch,
      idempotency_key: readIdempotencyKey(ctx.req.headers),
    });

    return json({ ok: true, id, patched: patch });
  };
}

// ── ENTITY DELETE (SOFT ARCHIVE) ─────────────────────────────────────────────

function makeDeleteHandler(table: EditableTable) {
  return async function handleDelete(ctx: HandlerCtx) {
    await ensureMutation(ctx.req, ctx);
    const session = await requireAdminSession(ctx.req, ctx.admin);
    const { id } = ctx.params;
    if (!id) return json({ ok: false, error: 'id_required' }, 400);

    const { error } = await ctx.admin.from(table).update({ status: 'archived' }).eq('id', id);
    if (error) throw new Error(error.message);

    await ctx.admin.from('audit_logs').insert({
      actor_id: session.userId,
      action: \`ops_archive_\${table}\`,
      ref_type: table,
      ref_id: id,
      payload: { archived: true },
      idempotency_key: readIdempotencyKey(ctx.req.headers),
    });

    return json({ ok: true, id, archived: true });
  };
}

// ── CART ITEM DELETE (REAL — ownership-verified) ──────────────────────────────

async function handleDeleteCartItem({ req, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env: {} as Env, admin, params: {} });
  const userId = requireAuth(req);
  const itemId = new URL(req.url).pathname.split('/').pop() ?? '';
  if (!itemId) return json({ ok: false, error: 'item_id_required' }, 400);

  const { data: item, error: fetchErr } = await admin
    .from('cart_items')
    .select('id, cart_id, carts!inner(user_id)')
    .eq('id', itemId)
    .maybeSingle();

  if (fetchErr || !item) return json({ ok: false, error: 'not_found' }, 404);
  const cartRow = (item as Record<string, unknown>).carts as { user_id: string } | null;
  if (cartRow?.user_id !== userId) return json({ ok: false, error: 'forbidden' }, 403);

  const { error: delErr } = await admin.from('cart_items').delete().eq('id', itemId);
  if (delErr) throw new Error(delErr.message);

  return json({ ok: true, deleted: itemId });
}

// ── PUBLIC SCHEDULE API ───────────────────────────────────────────────────────

async function handlePublicSchedule({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueCode = url.searchParams.get('league')?.toUpperCase() ?? null;

  const { data: slotsData, error: slotsErr } = await admin
    .from('schedule_slots')
    .select(
      'id,starts_at,ends_at,status,' +
      'venues(id,name,address),' +
      'courts(id,name),' +
      'seasons!inner(id,name,leagues!inner(id,code,name)),' +
      'games(id,home_team_id,away_team_id,home_score,away_score,status)'
    )
    .in('status', ['upcoming', 'in_progress', 'final'])
    .order('starts_at', { ascending: true })
    .limit(200);

  if (slotsErr) throw new Error(slotsErr.message);

  const allSlots = (slotsData ?? []) as Array<Record<string, unknown>>;
  const filtered = leagueCode
    ? allSlots.filter((s) => {
        const seasons = s.seasons as Record<string, unknown> | null;
        const leagues = seasons?.leagues as Record<string, unknown> | null;
        return (leagues?.code as string ?? '').toUpperCase() === leagueCode;
      })
    : allSlots;

  const byDate = new Map<string, Array<Record<string, unknown>>>();
  for (const slot of filtered) {
    const date = String(slot.starts_at ?? '').split('T')[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(slot);
  }

  const days = Array.from(byDate.entries()).map(([date, slots]) => {
    const first = slots[0];
    const seasons = first?.seasons as Record<string, unknown> | null;
    const leagues = seasons?.leagues as Record<string, unknown> | null;
    return {
      date,
      league_code: (leagues?.code as string ?? '').toUpperCase(),
      league_name: String(leagues?.name ?? ''),
      season_name: String(seasons?.name ?? ''),
      venue: (first?.venues as Record<string, unknown> | null)?.name ?? null,
      venue_address: (first?.venues as Record<string, unknown> | null)?.address ?? null,
      slots: slots.map((s) => ({
        id: s.id,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        status: s.status,
        court: (s.courts as Record<string, unknown> | null)?.name ?? null,
        games: (Array.isArray(s.games) ? s.games : []).map((g: Record<string, unknown>) => ({
          id: g.id, home_team_id: g.home_team_id, away_team_id: g.away_team_id,
          home_score: g.home_score, away_score: g.away_score, status: g.status,
        })),
      })),
    };
  });

  return json({ ok: true, days });
}

// ── PUBLIC POTG API ───────────────────────────────────────────────────────────

async function handlePublicPotg({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get('league');
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? '4')));

  const { data, error } = await admin
    .from('import_jobs')
    .select('id,payload_summary,created_at,status')
    .eq('job_type', 'potg_award')
    .in('status', ['completed', 'pending_match'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  let records = (data ?? []).map((row: Record<string, unknown>) => {
    const summary = (row.payload_summary ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      leagueId: summary.leagueId ?? null,
      playerName: summary.playerName ?? '',
      team: summary.team ?? '',
      pts: Number(summary.pts ?? 0),
      rebs: Number(summary.rebs ?? 0),
      assts: Number(summary.assts ?? 0),
      gameResult: summary.gameResult ?? '',
      date: summary.date ?? String(row.created_at ?? '').split('T')[0],
      imageUrl: summary.imageUrl ?? null,
      matched: row.status === 'completed',
    };
  });

  if (leagueId) {
    records = records.filter(r => r.leagueId === leagueId);
  }

  return json({ ok: true, data: records });
}

// ── OPS ENTITY LIST ───────────────────────────────────────────────────────────

async function handleOpsList(ctx: HandlerCtx, table: 'teams' | 'players' | 'products' | 'league_events') {
  await requireAdminSession(ctx.req, ctx.admin);
  const url = new URL(ctx.req.url);
  const leagueId = url.searchParams.get('leagueId');

  const selectMap: Record<typeof table, string> = {
    teams: 'id,name,status,league_id,season_id,division_id,created_at,leagues(code,name)',
    players: 'id,user_id,jersey_number,position,status,team_id,league_id,created_at,teams(name)',
    products: 'id,name,price,status,league_id,created_at',
    league_events: 'id,title,starts_at,status,league_id,venue_id,created_at',
  };

  let query = ctx.admin
    .from(table)
    .select(selectMap[table])
    .neq('status', 'archived')
    .order('created_at' as never, { ascending: false })
    .limit(200);

  if (leagueId) query = query.eq('league_id', leagueId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return json({ ok: true, data: data ?? [] });
}

`;

code = code.replace(
  'const routes: Array<{ method: string; path: string; handler: Handler }> = [',
  insertBlock + '\nconst routes: Array<{ method: string; path: string; handler: Handler }> = ['
);

const cartItemReplace = `{ method: 'DELETE', path: '/api/cart/items/:itemId', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'cart-item-delete', ...ctx.params } }) },`;
code = code.replace(
  cartItemReplace,
  `{ method: 'DELETE', path: '/api/cart/items/:itemId', handler: handleDeleteCartItem },`
);

const publicRoutesReplace = `  { method: 'GET', path: '/api/public/products', handler: handlePublicProducts },
  { method: 'GET', path: '/api/public/media', handler: handlePublicMedia },`;
code = code.replace(
  publicRoutesReplace,
  `  { method: 'GET', path: '/api/public/products', handler: handlePublicProducts },
  { method: 'GET', path: '/api/public/media', handler: handlePublicMedia },
  { method: 'GET', path: '/api/public/schedule', handler: handlePublicSchedule },
  { method: 'GET', path: '/api/public/potg', handler: handlePublicPotg },`
);

const opsBootstrapReplace = `  { method: 'GET', path: '/ops/bootstrap', handler: handleOpsBootstrap },`;
code = code.replace(
  opsBootstrapReplace,
  `  { method: 'GET', path: '/ops/bootstrap', handler: handleOpsBootstrap },
  { method: 'GET', path: '/ops/list/teams', handler: (ctx) => handleOpsList(ctx, 'teams') },
  { method: 'GET', path: '/ops/list/players', handler: (ctx) => handleOpsList(ctx, 'players') },
  { method: 'GET', path: '/ops/list/products', handler: (ctx) => handleOpsList(ctx, 'products') },
  { method: 'GET', path: '/ops/list/events', handler: (ctx) => handleOpsList(ctx, 'league_events') },
  { method: 'PATCH', path: '/ops/teams/:id', handler: makeEditHandler('teams') },
  { method: 'PATCH', path: '/ops/players/:id', handler: makeEditHandler('players') },
  { method: 'PATCH', path: '/ops/products/:id', handler: makeEditHandler('products') },
  { method: 'PATCH', path: '/ops/events/:id', handler: makeEditHandler('league_events') },
  { method: 'PATCH', path: '/ops/schedules/:id', handler: makeEditHandler('schedule_slots') },
  { method: 'DELETE', path: '/ops/teams/:id', handler: makeDeleteHandler('teams') },
  { method: 'DELETE', path: '/ops/players/:id', handler: makeDeleteHandler('players') },
  { method: 'DELETE', path: '/ops/products/:id', handler: makeDeleteHandler('products') },
  { method: 'DELETE', path: '/ops/events/:id', handler: makeDeleteHandler('league_events') },`
);

fs.writeFileSync(file, code);
