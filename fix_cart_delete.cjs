const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, 'src', 'worker', 'index.ts');
let workerCode = fs.readFileSync(workerPath, 'utf8');

const cartItemDeleteHandler = `
async function handleDeleteCartItem({ req, admin }: HandlerCtx) {
  await ensureMutation(req, { req, env: {} as Env, admin, params: {} });
  const userId = requireAuth(req);
  const itemId = new URL(req.url).pathname.split('/').pop()!;

  // Verify ownership before deleting
  const { data: item } = await admin.from('cart_items')
    .select('id, cart_id, carts(user_id)')
    .eq('id', itemId)
    .maybeSingle();

  if (!item) return json({ ok: false, error: 'not_found' }, 404);
  const cartUserId = (item as Record<string, unknown>).carts as { user_id: string } | null;
  if (cartUserId?.user_id !== userId) return json({ ok: false, error: 'forbidden' }, 403);

  const { error } = await admin.from('cart_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
  return json({ ok: true, deleted: itemId });
}
`;

workerCode = workerCode.replace(
  /async function handleGetCart/,
  cartItemDeleteHandler + '\nasync function handleGetCart'
);

workerCode = workerCode.replace(
  /\{ method: 'DELETE', path: '\/api\/cart\/items\/:itemId', handler: \(ctx\) => handleMutationAck\(\{ \.\.\.ctx, params: \{ route: 'cart-item-delete', \.\.\.ctx\.params \} \}\) \},/,
  `{ method: 'DELETE', path: '/api/cart/items/:itemId', handler: handleDeleteCartItem },`
);

fs.writeFileSync(workerPath, workerCode);
