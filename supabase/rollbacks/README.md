# Supabase rollback scripts

Paired 1:1 with forward migrations under `supabase/migrations/`.

## Naming convention

A forward migration at `supabase/migrations/20260417230000_foo.sql`
has a paired rollback at
`supabase/rollbacks/20260417230000_rollback.sql`.

## Authoring rules

1. **Idempotent.** Use `DROP ... IF EXISTS`, `DELETE` guarded by
   `WHERE`, and `ALTER ... IF EXISTS` wherever PostgreSQL supports it.
2. **Reverse-ordered.** Drop views before tables; drop triggers before
   functions; delete data before dropping constraints.
3. **No destructive assumptions.** A rollback must not assume all
   forward steps succeeded. It must be safe to apply partially.
4. **Paired review.** Every PR that adds a forward migration MUST
   include its rollback file in the same commit.

## Runbook

```bash
# Apply a specific rollback
psql "$SUPABASE_DB_URL" -f supabase/rollbacks/<timestamp>_rollback.sql

# Then revert the application code
git revert <commit-sha>
npx wrangler deploy
```

See `docs/architecture/STREAM_INDEPENDENCE_CONTRACT.md` for the full
rollback protocol on the stream refactor series.
