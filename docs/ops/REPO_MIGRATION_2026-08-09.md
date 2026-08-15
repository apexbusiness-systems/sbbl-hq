# Repository Migration — `apexbusiness-systems/sbbl-hq` → `sbblhqapp/sbblhq`

**Date:** 2026-08-09
**Canonical remote:** `https://github.com/sbblhqapp/sbblhq`
**Archived remote:** `https://github.com/apexbusiness-systems/sbbl-hq`

---

## 1. What moved, what did not

| Surface | Status after migration |
|---|---|
| Git history + branches | **Moved.** Imported into `sbblhqapp/sbblhq`; `main` carries all history through PR #584. |
| Pull requests | **NOT moved.** The new repo has zero PRs. Pre-migration PR permalinks intentionally still point at the archived repo — rewriting them would produce 404s. |
| Issues / wiki | **NOT moved.** Same reasoning as PRs. |
| GitHub Actions secrets | **Recreated.** Secrets are never carried by a repo import; all 17 were written fresh (see §3). |
| Cloudflare account, Worker, zone, custom domains | **Unchanged.** The migration is GitHub-side only. |
| Supabase project | **Unchanged** (`ezanilxygnpucwkwpsoc`). |

### Cloudflare is deliberately untouched

The Worker `sbbl-hq-worker` lives in the SBBL Cloudflare account under the
`sbbl-hq.icu` zone, and both custom domains (`sbbl-hq.icu`, `www.sbbl-hq.icu`)
resolve to it. None of that is keyed to the GitHub repository, so **no
`wrangler.jsonc` change was required or made**.

Account and zone identifiers are held in the `CLOUDFLARE_ACCOUNT_ID` /
`CLOUDFLARE_ZONE_ID` Actions secrets — never inline them in docs or code.

Per the hard rule in `wrangler.jsonc`, the Worker name MUST remain
`sbbl-hq-worker` — the custom domains and every runtime secret are bound to that
name. A repo migration is not a reason to rename it.

---

## 2. Local git remote layout

`origin` now points at the new repo; the old remote is retained read-only as
`legacy-origin` so historical refs stay resolvable:

```bash
git remote -v
# legacy-origin  https://github.com/apexbusiness-systems/sbbl-hq.git
# origin         https://github.com/sbblhqapp/sbblhq.git
```

To reproduce on another workstation:

```bash
git remote rename origin legacy-origin
git remote add origin https://github.com/sbblhqapp/sbblhq.git
git fetch origin main
```

---

## 3. GitHub Actions secrets on the new repo

A repo import copies **no** secrets. `.github/workflows/deploy.yml` reads all of
the below; without them the deploy fails at "Push runtime secrets to Cloudflare
Worker" (`SUPABASE_SERVICE_ROLE_KEY` is a hard-required secret).

The following 17 secrets were provisioned on `sbblhqapp/sbblhq`:

| Secret | Consumed by |
|---|---|
| `CLOUDFLARE_API_TOKEN_WORKERS` | `wrangler deploy`, `wrangler versions secret put` |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler deploy` |
| `CLOUDFLARE_ZONE_ID` | Cloudflare ops scripts (`ops/cloudflare/*`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker runtime (**required** — deploy fails if absent) |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Vite build |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Vite build |
| `VITE_TURNSTILE_SITE_KEY` | Vite build |
| `VITE_TURNSTILE_SECRET_KEY` | Worker runtime (`OPTIONAL_TURNSTILE_SECRET_KEY`) |
| `RESEND_API_KEY` | Worker runtime — transactional email |
| `GROQ_API_KEY` | Worker runtime — POTG / roster vision parsing |
| `OMNIHUB_SYNC_URL` | Worker runtime — OmniBridge outbound (`CLAUDE.md` §9.3) |
| `STRIPE_SECRET_KEY` | Worker runtime — **live** key |
| `STRIPE_WEBHOOK_SECRET` | Worker runtime |
| `SENTRY_DSN` | Error reporting |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI migration pushes |

### Known gap — OmniBridge HMAC secrets

`OMNIHUB_SIGNING_SECRET` and `OMNIHUB_VERIFY_KEY` are **not** in the operator ENV
file and were therefore **not** set as GitHub secrets.

This does not break anything today: `deploy.yml` classifies them as optional and
skips empty values (`put_optional_secret`), and `wrangler versions secret put`
only overwrites the named secret — so the values already live on
`sbbl-hq-worker` are preserved across deploys.

**However**, if the Worker's secrets are ever wiped or the Worker is recreated,
inbound `/webhooks/omnihub` HMAC verification (`CLAUDE.md` §9.4) will fail with
no GitHub-side source of truth to restore from. Add both to the repo secrets
when the values are next rotated.

---

## 4. Operator scripts

`scripts/lib/sbbl-env.ts` is now the single credential loader for every script in
`scripts/`. Two behaviours there are load-bearing:

1. **Markdown de-escaping.** The operator ENV file is Markdown, so underscores
   arrive escaped (`SUPABASE\_URL=`, `sk\_live\_…`). Every prior script matched
   on the unescaped form and therefore *always* exited with "Failed to parse
   credentials" before touching the database. Fixed in this migration.
2. **`SBBL_ENV_FILE` outranks ambient `process.env`.** An explicitly-named
   credential file is a deliberate operator choice. Without this, a workstation
   with an unrelated `SUPABASE_URL` exported silently retargets these scripts at
   the wrong Supabase project — which is exactly what happened during this
   migration: the first run resolved to an unrelated project instead of the SBBL
   one, and was caught only because that schema had no `admin_email_grants`
   table.

**Never hardcode credentials in a script, a doc, or a migration.** Everything
comes from the environment or the operator ENV file, which is not in the repo.

Usage:

```bash
SBBL_ENV_FILE="/path/to/SBBL-HQ -ENV.md" npx tsx scripts/grant-regular-admin.ts someone@example.com
SBBL_ENV_FILE="/path/to/SBBL-HQ -ENV.md" npx tsx scripts/verify-deployment.ts  someone@example.com
```

`scripts/archive/deploy_cad_pr.js` now defaults to `sbblhqapp/sbblhq` and accepts
a `GH_REPO` override for operating against the archived repo.

---

## 5. Post-migration checklist

- [x] Git history imported to `sbblhqapp/sbblhq`
- [x] Local `origin` repointed; old remote kept as `legacy-origin`
- [x] 17 Actions secrets provisioned on the new repo
- [x] Cloudflare account / Worker / zone verified unchanged and live
- [x] Repo-slug references in scripts and docs updated
- [ ] `OMNIHUB_SIGNING_SECRET` + `OMNIHUB_VERIFY_KEY` added at next rotation (§3)
- [ ] Branch protection rules re-created on `main` (not carried by import)
- [ ] Confirm the first `Deploy` run on the new repo goes green end-to-end
