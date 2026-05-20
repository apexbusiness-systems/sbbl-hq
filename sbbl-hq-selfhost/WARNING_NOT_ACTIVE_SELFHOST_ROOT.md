# WARNING — DO NOT RUN DOCKER COMMANDS HERE

This directory (`sbbl-hq-selfhost/`) is NOT the active Docker Compose root.

**Active root is:**
```
sbbl-hq-selfhost/sbbl-hq-selfhost/
```

Running `docker compose` from this directory will operate on stale/incomplete
configuration and may produce confusing errors (wrong volumes mounted, missing
DB init scripts, etc.).

## Why this directory exists

This is the outer wrapper that was present before the full self-hosted
configuration was established in the nested `sbbl-hq-selfhost/` subfolder.
It is retained for git history and for the SBBL-specific operational scripts
in `scripts/`.

## Verify before running any Docker command

```powershell
# Confirm active root from Docker labels
docker inspect supabase-kong --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'

# Expected output: ...sbbl-hq-selfhost/sbbl-hq-selfhost
```

If the output matches this directory, stop and consult the runbook before
making any changes.
