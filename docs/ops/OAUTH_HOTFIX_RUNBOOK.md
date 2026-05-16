# OAuth Hotfix Runbook — Google Sign-In on SBBL HQ

Audience: on-call operator. Use this when Google sign-in is broken in
production or staging, or when re-enabling Google after a Cloud-side
mis-configuration is corrected.

The repo cannot solve a Google-side mis-configuration on its own. What the
repo can (and does) do:

1. Hide the **Google sign-in** button by default, so users never click into a
   dead end.
2. Surface a clear error message when Google bounces a user back with
   `org_internal`.
3. Keep email + password sign-in working with no dependency on the OAuth
   client.

The button is gated by a single capability flag, `GOOGLE_OAUTH_ENABLED`, set
in the Cloudflare Worker environment. Default is `false`. Set to `"true"`
**only after** every check below passes.

---

## Stage 1 — Verify Supabase auth provider

1. Open the Supabase dashboard for the project the Worker is bound to:
   `wrangler secret list` (look at `SUPABASE_URL`). The frontend uses the URL
   served by `/api/public-config`, so this is the *true* project.
2. Go to **Authentication → Providers → Google**.
3. Confirm the provider is **enabled**.
4. Confirm the **Client ID** and **Client Secret** match the values in Google
   Cloud (Stage 2). A mismatch here returns `invalid_client` from Supabase,
   not from Google.
5. Copy the **Callback URL (for OAuth)** from this page. It looks like:

   ```
   https://<self-hosted-supabase-public-url>/auth/v1/callback
   ```

   This **exact** URL — including scheme, host, path, and `/callback` — must
   be present in the Google Cloud OAuth client's "Authorized redirect URIs"
   list (Stage 2).

6. Under **Site URL / Additional Redirect URLs**, confirm both
   `https://sbbl-hq.icu` and `https://www.sbbl-hq.icu` are listed. Supabase
   rejects `redirectTo` values that aren't on this allowlist with
   `redirect_to_not_allowed`, which the frontend cannot distinguish from
   `org_internal`.

## Stage 2 — Verify Google Cloud OAuth client + consent screen

1. Open Google Cloud Console for the project that owns the OAuth client.
2. Go to **APIs & Services → OAuth consent screen**.
   - **Publishing status** must be **In production**, not **Testing** /
     `Internal`. An `Internal` / `org_internal` consent screen is the most
     common cause of the production breakage this runbook addresses — only
     accounts inside the same Google Workspace can sign in.
   - If the app is currently `Internal`:
     - If the project has a Workspace org, switch **User type** to
       **External** and click **Publish app**. Verification may be required
       depending on scopes.
     - If you cannot publish right now, add affected user emails under
       **Test users** so they can sign in until the app is published. This
       is a temporary patch; do not flip `GOOGLE_OAUTH_ENABLED=true` in
       production until the app is published or the entire user base is
       on the test-user list (almost never the right answer in prod).
3. Go to **APIs & Services → Credentials → OAuth 2.0 Client IDs** and open
   the client used by Supabase.
   - **Application type** must be **Web application**.
   - **Authorized JavaScript origins** must include
     `https://sbbl-hq.icu`, `https://www.sbbl-hq.icu`, and the Supabase
     project domain.
   - **Authorized redirect URIs** must include the Supabase callback URL
     copied in Stage 1 step 5 (`https://<self-hosted-supabase-public-url>/auth/v1/callback`).
     A missing entry returns `redirect_uri_mismatch` from Google.
   - Confirm the Client ID + Client Secret match what Supabase has.

## Stage 3 — Flip the capability flag

Only after Stages 1 + 2 pass:

```sh
# Production
npx wrangler deploy   # picks up GOOGLE_OAUTH_ENABLED from wrangler.jsonc

# To change the flag without redeploying code, edit wrangler.jsonc:
#   "vars": { ..., "GOOGLE_OAUTH_ENABLED": "true" }
# and re-deploy, OR set it as a secret:
npx wrangler secret put GOOGLE_OAUTH_ENABLED   # then enter: true
```

Note: `GOOGLE_OAUTH_ENABLED` is a plain var, not a secret. Setting it as a
secret also works (secrets override vars of the same name).

Staging override:

```sh
npx wrangler deploy --env staging
```

Verification:

```sh
curl -sS https://sbbl-hq.icu/api/public-config | jq .googleOAuthEnabled
# Expect: true
```

## Stage 4 — Verify the user-facing UX

1. Open https://sbbl-hq.icu/login in a private window.
2. Confirm the "Continue with Google" pill renders.
3. Click it. A Google chooser must appear (not a Google error page).
4. Pick an account outside your Google Workspace. The chooser must continue
   to Supabase and bring you back signed in. If it returns to `/login` with
   `?error=...&error_description=org_internal...`, **Stage 2 step 2 was not
   actually completed**: the consent screen is still Internal. Revert the
   flag to `"false"` immediately and resume at Stage 2.

## Stage 5 — Rollback

If anything breaks after the flag flip:

```sh
# Edit wrangler.jsonc back to:
#   "GOOGLE_OAUTH_ENABLED": "false"
npx wrangler deploy
```

This hides the Google button and shows the "Google sign-in is temporarily
unavailable" copy. Email + password authentication is unaffected and remains
the recommended path during the outage.

---

## What the repo cannot do for you

- The repo cannot publish your Google Cloud consent screen.
- The repo cannot flip Google's `Internal` user-type to `External`.
- The repo cannot add the Supabase callback URL to your OAuth client's
  allowlist.
- The repo cannot rotate the Google client secret if it leaked.

All four are operator actions in Google Cloud / Supabase dashboards. The
repo only controls whether the SBBL HQ UI advertises Google as a working
sign-in path; it never lies about that capability to end users.
