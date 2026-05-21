# ACTIVE SELF-HOST ROOT
<!-- Version: v1.2.0 | Date: 2026-05-21 | Status: Current -->

Run all Docker Compose commands from **this directory only**:

```
sbbl-hq-selfhost/sbbl-hq-selfhost/
```

## Quick reference

```powershell
cd "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost"

# Verify active root
docker inspect supabase-kong --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'

# Repair Kong restart loop or reload CORS config
Copy-Item .\docker-compose.yml ".\docker-compose.yml.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
docker compose up -d --force-recreate kong
Start-Sleep -Seconds 15
docker compose ps kong
docker compose logs --tail=60 kong
```

## Public endpoints

| Service | URL |
|---|---|
| App | https://sbbl-hq.icu |
| Supabase API | https://supabase.sbbl-hq.icu |
| Ingress | Cloudflare Tunnel → http://localhost:8000 → Kong |

## Kong CORS allowlist (active config)

Active config: `volumes/api/kong.yml` (this directory — NOT the outer `sbbl-hq-selfhost/volumes/api/kong.yml`).

All 6 explicit CORS header blocks must include the full set. See CLAUDE.md §9.3 for the canonical list.
After any kong.yml edit: `docker compose up -d --force-recreate kong` — never restart the full stack.

## Known root cause — Kong "No such command: docker-start"

This error means the `docker-compose.yml` `entrypoint:` key for Kong was
overridden (duplicate YAML key, second one wins). The second key was
`entrypoint: []`, which causes Docker to skip the custom entrypoint
script and run the image default CMD (`kong docker-start`) directly
through the Kong CLI binary — which does not recognize that subcommand.

**Fix:** Ensure the Kong service block contains exactly one `entrypoint:` key:

```yaml
entrypoint: /home/kong/kong-entrypoint.sh
```

No `command:` key and no second `entrypoint:` key on the Kong service.

## What NOT to do

- Do NOT run `docker compose down -v` (destroys DB data)
- Do NOT delete `volumes/db/data`
- Do NOT rotate secrets without the runbook (`docs/runbooks/supabase-clean-secret-rotation.md`)
- Do NOT run Docker commands from the sibling `sbbl-hq-selfhost/` directory
- Do NOT copy the outer `sbbl-hq-selfhost/volumes/api/kong.yml` over this directory's version

## Change log

| Version | Date | Change |
|---|---|---|
| v1.2.0 | 2026-05-21 | Added CORS allowlist note; PR #535 fix reference; What NOT to do expanded |
| v1.1.0 | 2026-05-16 | Added CORS fix (PR claude/fix-supabase-login-docker-3z8YG) reference |
| v1.0.0 | 2026-05-11 | Initial active-root marker |
