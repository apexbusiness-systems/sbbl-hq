# Hot Standby Replica Setup

Guide for configuring a PostgreSQL streaming replication hot standby for the
SBBL-HQ self-hosted Supabase deployment.

## Prerequisites

- Primary server running with `wal_level = replica` (already set in
  `volumes/db/conf/postgresql.conf`)
- `max_wal_senders = 5` and `max_replication_slots = 5` configured
- `archive_mode = on` configured
- Network connectivity between primary and replica on port 5432

## 1. Create Replication User (on primary)

Connect to the primary database and create a dedicated replication user:

```sql
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'REPLACE_WITH_REPLICATION_PASSWORD';
```

## 2. Update pg_hba.conf (on primary)

Add the replica host to the allowlist. Edit `pg_hba.conf` on the primary:

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    replication     replicator      10.0.0.0/8              scram-sha-256
host    replication     replicator      172.16.0.0/12           scram-sha-256
host    replication     replicator      192.168.0.0/16          scram-sha-256

# If the replica has a known static IP, prefer a /32 allowlist:
# host  replication     replicator      203.0.113.50/32         scram-sha-256
```

Reload the primary after editing:

```bash
docker exec supabase-db psql -U supabase_admin -c "SELECT pg_reload_conf();"
```

## 3. Create a Replication Slot (on primary)

```sql
SELECT pg_create_physical_replication_slot('replica_1');
```

Verify:

```sql
SELECT slot_name, active FROM pg_replication_slots;
```

## 4. Base Backup (on replica)

Stop the replica PostgreSQL instance if running, then take a base backup from
the primary:

```bash
pg_basebackup \
    --host=PRIMARY_HOST \
    --port=5432 \
    --username=replicator \
    --pgdata=/var/lib/postgresql/data \
    --wal-method=stream \
    --slot=replica_1 \
    --checkpoint=fast \
    --progress \
    --verbose
```

For a dockerized replica, run from within the container or mount the data
directory appropriately.

## 5. Configure the Replica

Create `/var/lib/postgresql/data/postgresql.auto.conf` on the replica (or
append to it):

```
primary_conninfo = 'host=PRIMARY_HOST port=5432 user=replicator password=REPLACE_WITH_REPLICATION_PASSWORD application_name=replica_1'
primary_slot_name = 'replica_1'
```

Create the standby signal file:

```bash
touch /var/lib/postgresql/data/standby.signal
```

Ensure `hot_standby = on` is set in `postgresql.conf` (already configured).

## 6. Start the Replica

```bash
# If running in docker
docker start supabase-db-replica

# Or restart the PostgreSQL service
pg_ctl start -D /var/lib/postgresql/data
```

## 7. Verify Replication

On the **primary**:

```sql
SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn
FROM pg_stat_replication;
```

On the **replica**:

```sql
SELECT pg_is_in_recovery();
-- Should return: t

SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();
```

Check replication lag:

```sql
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

## 8. Promotion Procedure

When you need to promote the replica to primary (e.g., during failover):

### Automatic promotion

```bash
# From within the replica container
docker exec supabase-db-replica pg_ctl promote -D /var/lib/postgresql/data
```

Or via SQL (PostgreSQL 12+):

```sql
SELECT pg_promote();
```

### Post-promotion checklist

1. Verify the replica is no longer in recovery:
   ```sql
   SELECT pg_is_in_recovery();
   -- Should return: f
   ```

2. Update application connection strings (`DB_HOST`, `SUPABASE_URL`, etc.) to
   point to the new primary.

3. Update DNS records if applicable.

4. Remove `standby.signal` if it was not automatically removed.

5. Drop the old replication slot on the new primary (no longer needed):
   ```sql
   SELECT pg_drop_replication_slot('replica_1');
   ```

6. Set up a new replica from the promoted server if high availability is still
   required.

## Monitoring

Key metrics to watch:

- **Replication lag**: `pg_stat_replication.replay_lsn` vs `sent_lsn`
- **WAL accumulation**: if the replica falls behind, WAL files accumulate on
  the primary
- **Slot activity**: `pg_replication_slots.active` should be `t`

Example monitoring query (run on primary):

```sql
SELECT
    application_name,
    client_addr,
    state,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_lag_bytes,
    pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) AS send_lag_bytes
FROM pg_stat_replication;
```
