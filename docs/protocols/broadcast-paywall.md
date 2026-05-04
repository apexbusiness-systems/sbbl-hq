# Broadcast & Paywall — Operating Protocol

**Companion to:** [`docs/architecture/BROADCAST_PAYWALL_SYSTEM.md`](../architecture/BROADCAST_PAYWALL_SYSTEM.md)
**Hard rules:** [`CLAUDE.md` §6](../../CLAUDE.md)
**Status:** Production · v1.0.0

This protocol is for **agents and engineers working on the broadcast and
paywall system day-to-day.** It is the action-oriented shortcut for the
architecture doc — read this first, then dive into the architecture doc
when you need depth.

---

## Quick reference: which surface owns what

| Surface | Owns | Touch only when… |
|---|---|---|
| `get_active_broadcast()` RPC | All non-admin viewer access decisions, server-side stream_url gating | Adding a new access signal (e.g. trial state, geo-block) |
| `redeem_ppv_invite()` RPC | Code validation, invite consumption, entitlement creation | Adding a new code type or expiry rule |
| `complete_fan_onboarding()` RPC | Fan profile creation (display_name only) | NEVER add bio or avatar to fan path |
| `create_stream_entitlement()` RPC | Per-user stream grant rows | Adding a new entitlement source (subscription, refund) |
| `admin_sync_broadcast_to_sessions()` RPC | stream_sessions + stream_sources upserts | Changing the admin Go Live flow |
| `Live.tsx` broadcastQuery | Polling oracle for non-admin viewers | Switching from polling to Realtime |
| `PaywallGate.tsx` | Code redemption UI + purchase entry point | New paywall modes (trial, geo-block) |
| `Onboarding.tsx` (fan branch) | Display-name-only fan registration | New fan-required field (NEVER bio/avatar) |
| `Login.tsx` | `?intent=` + `?redirect=` preservation | New auth provider |

---

## Common task playbooks

### Add a new access reason to `get_active_broadcast`

Example: granting access during a free-trial window.

1. Add the new signal computation in the function body before
   `v_can_watch := ...`:
   ```sql
   v_in_free_trial := public.is_in_free_trial(v_user_id);
   v_can_watch := v_is_subscribed OR v_has_entitlement OR v_in_free_trial;
   ```
2. Add the signal to the return object so the frontend can show context:
   ```sql
   'in_free_trial', v_in_free_trial,
   ```
3. Update the access decision matrix in
   `docs/architecture/BROADCAST_PAYWALL_SYSTEM.md` §3.
4. Add an acceptance test row to §8.
5. Update the TypeScript shape in `Live.tsx` `broadcastQuery.queryFn`.

### Add a new error code to `redeem_ppv_invite`

Example: rate-limit per IP.

1. Add the error branch in the SQL function:
   ```sql
   IF (SELECT count(*) FROM ppv_invites WHERE ip_address = v_ip
       AND used_at > now() - interval '1 hour') > 5
   THEN
     RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
   END IF;
   ```
2. Add the error code to `CODE_ERRORS` in `PaywallGate.tsx`:
   ```ts
   const CODE_ERRORS: Record<string, string> = {
     ...,
     rate_limited: 'Too many attempts. Try again in an hour.',
   };
   ```
3. Add a test scenario.

### Change the admin Go Live behavior

**DO NOT** modify `handleGoLive` order without updating CLAUDE.md §6.6
and the architecture doc §5. The current order is:

1. Primary write (`goLive` / `updateStreamConfig` + `setStreamLive`)
2. Sync write (`admin_sync_broadcast_to_sessions`) — non-fatal

Reversing this order would mean a sync failure could leave admins unable
to broadcast. Making the sync fatal would mean a transient sync error
prevents the broadcast itself.

### Add a new fan-onboarding field

If the field is one of: `display_name`, `full_name`, `preferred_league`
→ add it to `complete_fan_onboarding` RPC + Onboarding.tsx fan branch.

If the field is anything else (especially bio/avatar/jersey/etc)
→ **STOP**. The fan flow deliberately avoids these. Open an architecture
discussion first. The decision tree is intentional: fans are anonymous
viewers; collecting more reduces conversion and adds GDPR/CASL surface.

---

## Forbidden patterns (will block in code review)

```ts
// ❌ Reading stream URL directly bypasses server-side gating
const { data } = await supabase.from('stream_admin_config')
  .select('collection_id').single();

// ❌ Inserting 'purchased' into entitlement_status — silently rejected
INSERT INTO stream_entitlements (..., status, ...) VALUES (..., 'purchased', ...);

// ❌ Casting ppv_invites.game_id to uuid without try/except
SELECT public.create_stream_entitlement(v_invite.game_id::uuid, ...);

// ❌ Positional args to can_user_view_stream — wrong overload binds
public.can_user_view_stream(v_user_id, v_game_id);  -- args reversed!

// ❌ Setting bio or avatar_url for a fan
INSERT INTO profiles (..., bio, avatar_url, ...) WHERE primary_role_intent = 'fan';

// ❌ Calling saveOnboarding() from a fan code path
await saveOnboarding({ primaryRoleIntent: 'fan', bio: '', avatarFile: null });

// ❌ Skipping the admin sync call after Go Live
await goLive(...);  // no admin_sync_broadcast_to_sessions follow-up

// ❌ Hardcoding redirectTo without preserving intent
redirectTo: 'https://sbbl-hq.icu/auth/v1/callback'  // intent lost on round-trip
```

---

## Required patterns

```ts
// ✅ Single oracle for all non-admin access decisions
const { data: broadcast } = await supabase.rpc('get_active_broadcast');

// ✅ Status check on entitlements
INSERT INTO stream_entitlements (..., status, ...) VALUES (..., 'active', ...);

// ✅ Safe game_id cast in PL/pgSQL
DECLARE
  v_game_uuid uuid;
  v_is_uuid_game_id boolean := false;
BEGIN
  v_game_uuid := v_invite.game_id::uuid;
  v_is_uuid_game_id := true;
EXCEPTION WHEN others THEN
  v_is_uuid_game_id := false;
END;

// ✅ Named args for overloaded functions
public.can_user_view_stream(
  p_game_id => v_game_id::text,
  p_user_id => v_user_id
);

// ✅ Fan onboarding via dedicated RPC
await supabase.rpc('complete_fan_onboarding', {
  p_display_name: name,
  p_full_name: null,
  p_preferred_league: null,
});

// ✅ Admin Go Live two-step
await goLive({...});
await supabase.rpc('admin_sync_broadcast_to_sessions', {
  p_game_id, p_stream_url, p_is_going_live: true,
});

// ✅ OAuth preserves intent
const callbackParams = new URLSearchParams();
if (intentParam) callbackParams.set('intent', intentParam);
if (redirectTo) callbackParams.set('redirect', redirectTo);
const postLogin = `${window.location.origin}/login?${callbackParams.toString()}`;
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: postLogin },
});
```

---

## Smoke test (manual, ~5 min)

Run before merging any change to this system.

1. **Anon path:** Open `/live` in incognito. Should see PaywallGate Mode A
   ("Register to Watch") if a broadcast is live, otherwise "No Active Broadcast".
2. **Register:** Click Register → land on `/onboarding?intent=fan&redirect=/live`
   → land on `/login?redirect=...` after URL preserves intent → sign up →
   confirm email → sign in → land on `/onboarding?intent=fan&redirect=/live`.
3. **Fan form:** Verify ONLY display_name, full_name, preferred_league fields
   are visible. NO bio, NO avatar, NO jersey. Submit → land on `/live`.
4. **PaywallGate Mode B:** Verify code panel + purchase button visible.
5. **Code redemption:** Have admin generate a comp code. Enter it → see
   "Access granted!" → player renders within ~1 second.
6. **Premium subscriber:** Set `subscription_ends_at = now() + interval '30 days'`
   for the test user → reload `/live` → player renders immediately, no paywall.
7. **Admin Go Live:** Sign in as super_admin → open AdminStreamOverlay →
   enter URL → click Go Live → verify broadcast goes live for non-admin
   users within 15s.
8. **Admin End Stream:** Click End Stream → verify viewers see "No Active
   Broadcast" within 15s.

---

## Escalation

If a smoke test fails, **do not paper over it.** Each failure mode in the
above list maps to a real production incident pattern. Specifically:

- Step 1 fails → check RLS policies on `stream_sessions` / `stream_sources`
  (regression of bug A1/A2)
- Step 3 shows bio/avatar → fan branch broke (regression of B4)
- Step 5 fails with "code doesn't exist" for valid code → check
  `redeem_ppv_invite` argument handling (regression of audit bug #2)
- Step 7 shows broadcast for admin but not viewers → check
  `admin_sync_broadcast_to_sessions` is being called (regression of A4/A5)

When in doubt, read [`BROADCAST_PAYWALL_SYSTEM.md`](../architecture/BROADCAST_PAYWALL_SYSTEM.md)
end-to-end before making any change.
