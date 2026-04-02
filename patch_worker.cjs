const fs = require('fs');

let content = fs.readFileSync('src/worker/index.ts', 'utf8');

// Replace handleMutationAck stub for cart delete
const cartDeleteStub = `async function handleMutationAck(ctx: HandlerCtx) {`;
const cartDeleteLogic = `
async function handleDeleteCartItem({ req, admin, params }: HandlerCtx) {
  await ensureMutation(req, { req, admin, params } as any);
  const userId = requireAuth(req);
  const itemId = params.itemId;
  if (!itemId) throw new Error('Missing itemId');

  const { data: item } = await admin.from('cart_items')
    .select('id, cart_id')
    .eq('id', itemId)
    .maybeSingle();

  if (!item) {
    return json({ ok: true, deleted: false, reason: 'not_found' });
  }

  const { data: cart } = await admin.from('carts')
    .select('id, user_id, status')
    .eq('id', item.cart_id)
    .maybeSingle();

  if (!cart || cart.user_id !== userId) {
    throw new Error('Forbidden: Cart item ownership verification failed');
  }

  if (cart.status !== 'open') {
     throw new Error('Forbidden: Cannot modify closed cart');
  }

  const { error } = await admin.from('cart_items')
    .delete()
    .eq('id', itemId);

  if (error) throw new Error(error.message);

  return json({ ok: true, deleted: true, itemId });
}

async function handleMutationAck(ctx: HandlerCtx) {`;
content = content.replace(cartDeleteStub, cartDeleteLogic);

content = content.replace(
  `{ method: 'DELETE', path: '/api/cart/items/:itemId', handler: (ctx) => handleMutationAck({ ...ctx, params: { route: 'cart-item-delete', ...ctx.params } }) },`,
  `{ method: 'DELETE', path: '/api/cart/items/:itemId', handler: handleDeleteCartItem },`
);

const newHandlers = fs.readFileSync('new_handlers.ts', 'utf8');
const handlePublicConfigIndex = content.indexOf('async function handlePublicConfig');
content = content.slice(0, handlePublicConfigIndex) + newHandlers + '\n' + content.slice(handlePublicConfigIndex);

const routesToAdd = `
  { method: 'GET', path: '/api/public/schedule', handler: handlePublicSchedule },
  { method: 'GET', path: '/api/public/potg', handler: handlePublicPotg },
  { method: 'GET', path: '/ops/list/teams', handler: handleOpsListTeams },
  { method: 'GET', path: '/ops/list/players', handler: handleOpsListPlayers },
  { method: 'GET', path: '/ops/list/products', handler: handleOpsListProducts },
  { method: 'GET', path: '/ops/list/events', handler: handleOpsListEvents },
  { method: 'PATCH', path: '/ops/teams/:id', handler: handleOpsPatchTeams },
  { method: 'PATCH', path: '/ops/players/:id', handler: handleOpsPatchPlayers },
  { method: 'PATCH', path: '/ops/products/:id', handler: handleOpsPatchProducts },
  { method: 'PATCH', path: '/ops/events/:id', handler: handleOpsPatchEvents },
  { method: 'PATCH', path: '/ops/schedules/:id', handler: handleOpsPatchSchedules },
  { method: 'DELETE', path: '/ops/teams/:id', handler: handleOpsDeleteTeams },
  { method: 'DELETE', path: '/ops/players/:id', handler: handleOpsDeletePlayers },
  { method: 'DELETE', path: '/ops/products/:id', handler: handleOpsDeleteProducts },
  { method: 'DELETE', path: '/ops/events/:id', handler: handleOpsDeleteEvents },
`;

const routesIndex = content.indexOf(`{ method: 'GET', path: '/api/teams', handler: handleTeamsList },`);
content = content.slice(0, routesIndex) + routesToAdd + '\n  ' + content.slice(routesIndex);

fs.writeFileSync('src/worker/index.ts', content);
