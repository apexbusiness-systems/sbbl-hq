# SBBL HQ Quick-Start Templates
<!-- Version: v2.0.0 | Date: 2026-05-20 -->

## Template 1: New Public API Endpoint

```ts
// src/worker/index.ts — add to route table:
{ method: "GET", path: "/api/public/my-new-surface", handler: handleMyNewSurface },

// src/worker/routes/public.ts — add handler:
export async function handleMyNewSurface(req: Request, env: Env): Promise<Response> {
  const admin = getAdminClient(env);
  const { data, error } = await admin
    .from('my_table')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });

  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), {
    status: 500, headers: { 'Content-Type': 'application/json' }
  });

  return new Response(JSON.stringify({ ok: true, data }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=30, max-age=15',
    }
  });
}

// src/lib/api/public.ts — add client wrapper:
export async function fetchMyNewSurface(): Promise<MyType[]> {
  const res = await apiFetch('/api/public/my-new-surface');
  const { ok, data } = await res.json();
  if (!ok) return [];
  return data ?? [];
}

// src/pages/MyPage.tsx — wire via useQuery:
const { data = [] } = useQuery({
  queryKey: ['my-new-surface'],
  queryFn: fetchMyNewSurface,
});
// NEVER: if (!data.length) return mockData;  // ← BANNED
// ALWAYS: render explicit empty state when data is []
```

---

## Template 2: New Protected Route

```ts
// src/worker/index.ts
{ method: "POST", path: "/api/my-protected", handler: handleMyProtected },

// Handler:
export async function handleMyProtected(req: Request, env: Env): Promise<Response> {
  const { userId, roles } = await requireAuth(req);  // throws 401 if missing
  const admin = getAdminClient(env);

  // Role check example
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  if (!isAdmin) return new Response('Forbidden', { status: 403 });

  // ... business logic
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

## Template 3: New Migration

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql
-- NEVER edit this file after it merges. Create a new migration to change it.

-- 1. Create table with audit columns
CREATE TABLE public.my_table (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  name          text NOT NULL,
  league_id     uuid REFERENCES public.leagues(id)
);

-- 2. Trigger for updated_at (MANDATORY)
CREATE TRIGGER touch_my_table_updated_at
  BEFORE UPDATE ON public.my_table
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Enable RLS (MANDATORY — also auto-enforced by DDL trigger)
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "admin_all" ON public.my_table FOR ALL
  USING (public.get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "public_read" ON public.my_table FOR SELECT
  USING (true);

-- 5. Performance index
CREATE INDEX idx_my_table_league_id_created ON public.my_table(league_id, created_at DESC);
```

---

## Template 4: New Supabase RPC

```sql
-- In a new migration file:
CREATE OR REPLACE FUNCTION public.my_new_rpc(
  p_user_id  uuid,
  p_league_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- MANDATORY: prevents schema injection
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- validate
  IF p_user_id IS NULL OR p_league_id IS NULL THEN
    RAISE EXCEPTION 'Invalid arguments';
  END IF;

  -- business logic
  SELECT jsonb_build_object('id', id, 'name', name)
  INTO v_result
  FROM public.my_table
  WHERE league_id = p_league_id
  LIMIT 1;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_new_rpc(uuid, uuid) TO authenticated;
```

---

## Template 5: Live Player Addition (safe pattern)

```tsx
// src/components/LiveStreamPlayer.tsx — adding a new timer effect

useEffect(() => {
  // ✅ CORRECT: capture handle
  const timerId = setTimeout(() => {
    doSomething();
  }, 3000);

  // ✅ MANDATORY: always clear on unmount
  return () => {
    clearTimeout(timerId);
  };
}, [dependency]);

// ✅ CORRECT: wrapper layout (never add 'relative' here)
<div className="absolute inset-0 flex flex-col z-0">
  {/* player content */}
</div>
```

---

## Template 6: OmniBridge Inbound Action Handler

```ts
// src/worker/index.ts — adding new action to omnihub handler
// WARNING: Adding to the allowlist requires OWNER APPROVAL

// Pattern for an allowlisted action handler:
async function handleDisableStream(packet: SyncPacket, env: Env): Promise<void> {
  const admin = getAdminClient(env);
  const { gameId } = packet.payload;

  // Validate payload
  if (!gameId || typeof gameId !== 'string') {
    throw new Error('invalid_payload: gameId required');
  }

  // Execute action
  const { error } = await admin
    .from('stream_admin_config')
    .update({ is_live: false })
    .eq('game_id', gameId);

  if (error) throw new Error(`disable_stream_failed: ${error.message}`);

  // log_admin_action is called by the outer handler (omnihub-bridge)
}
```

---

## Template 7: Stripe PPV Purchase Flow

```ts
// Worker: handleStreamPurchase
const { gameId } = params;
const { userId } = await requireAuth(req);
const { priceId } = await req.json();

// Create Stripe checkout session
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${env.VITE_PUBLIC_BASE_URL}/live/${gameId}?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${env.VITE_PUBLIC_BASE_URL}/live/${gameId}`,
  metadata: { userId, gameId, type: 'ppv' },
});

return Response.json({ ok: true, url: session.url });

// Stripe webhook handler (supabase/functions/stripe-webhook/index.ts):
// → checkout.session.completed → mark_order_paid()
// → create_stream_entitlement(..., status='active')  ← ALWAYS 'active', NEVER 'purchased'
```

---

## Template 8: Broadcast Go Live (Admin)

```ts
// Admin panel: handleGoLive()

// Step 1: Update primary config
const { error } = await supabase
  .from('stream_admin_config')
  .upsert({ is_live: true, collection_id: streamUrl, updated_at: new Date().toISOString() });

if (error) throw error;

// Step 2: MANDATORY sync to viewer tables (non-fatal)
try {
  await supabase.rpc('admin_sync_broadcast_to_sessions');
} catch (syncError) {
  console.error('Sync warning (non-fatal):', syncError);
  // Do NOT rollback the go-live action for a sync failure
}

// ✅ Result: stream_sessions + stream_sources populated
//           get_active_broadcast() will now return stream_url for registered fans
```
