async function handleDeleteCartItem({ req, admin, params }: HandlerCtx) {
  await ensureMutation(req, { req, admin, params } as any);
  const userId = requireAuth(req);
  const itemId = params.itemId;
  if (!itemId) throw new Error('Missing itemId');

  // Verify ownership: get the item to find its cart, check if cart belongs to user
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
