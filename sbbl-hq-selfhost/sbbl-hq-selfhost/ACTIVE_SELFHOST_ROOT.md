# ACTIVE SELF-HOST ROOT

Run all Docker Compose commands from **this directory only**:

```
sbbl-hq-selfhost/sbbl-hq-selfhost/
```

## Quick reference

```powershell
cd "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost"

# Verify active root
docker inspect supabase-kong --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'

# Repair Kong restart loop
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

## Known root cause — Kong "No such command: docker-start"

This error means the docker-compose.yml `entrypoint:` key for Kong was
overridden (duplicate YAML key, second one wins). The second key was
`entrypoint: []`, which causes Docker to skip the custom entrypoint
script and run the image default CMD (`kong docker-start`) directly
through the Kong CLI binary — which does not recognize that subcommand.

**Fix:** Ensure the Kong service block contains exactly one `entrypoint:` key:

```yaml
entrypoint: /home/kong/kong-entrypoint.sh
```

No `command:` key and no second `entrypoint:` key on the Kong service.

The canonical git version of `docker-compose.yml` is already correct.
Pull from git and recreate Kong if the local file was manually edited.

## CORS fix (PR claude/fix-supabase-login-docker-3z8YG)

Explicit CORS configuration was added to all auth routes in
`volumes/api/kong.yml`. Pull this change and recreate Kong for it to
take effect.

## What NOT to do

- Do NOT run `docker compose down -v` (destroys DB data)
- Do NOT delete volumes/db/data
- Do NOT rotate secrets without the runbook
- Do NOT run Docker commands from the sibling `sbbl-hq-selfhost/` directory
