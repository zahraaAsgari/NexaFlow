# Deployment Guide

## Prerequisites

| Requirement | Detail |
|---|---|
| Node.js | v22 or later |
| PostgreSQL | v15 or later |
| npm | with `package-lock.json` present |
| `pg_dump`, `psql` | PostgreSQL client tools (for backup/restore) |

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (e.g., `postgres://user:pass@host:5432/dbname`) |
| `RESEND_API_KEY` | For email flows | Resend API key. If unset, email flows degrade to manual-link fallback. |
| `EMAIL_FROM` | For email flows | Verified sender address in Resend. |
| `APP_URL` | For email flows | Canonical public HTTPS URL (e.g., `https://app.yourdomain.com`). Must be `https://` in production. |
| `TEST_DATABASE_URL` | For tests only | Separate database for the automated test suite. Must differ from `DATABASE_URL`. |

## Deploy procedure

### 1. Install dependencies

```bash
npm ci
```

### 2. Run database migrations

**IMPORTANT:** Always take a backup before running migrations.

```bash
./scripts/backup.sh
npm run db:migrate
```

### 3. Build the application

```bash
npm run build
```

### 4. Verify the build

```bash
npm run typecheck
npm run lint
npm run test:run
```

All must pass before proceeding.

### 5. Start the production server

```bash
npm run start
```

### 6. Verify health

```bash
curl -f http://localhost:3000/api/health
```

Expected response: `{"ok":true}` with HTTP 200.

If this returns 500, the database is unreachable. Check `DATABASE_URL` and PostgreSQL status.

## Health check

The application exposes a single health endpoint:

- **Route:** `GET /api/health`
- **Response:** `{"ok":true}` (200) or `{"ok":false}` (500)
- **Behavior:** Executes `SELECT 1` against the database via Drizzle. Returns 500 if the query fails.

This endpoint distinguishes database unavailability (500) from application health (200). Use it for uptime monitoring and load balancer health checks.

## Backup procedure

Run `scripts/backup.sh` daily. The script:

1. Reads `DATABASE_URL` from `.env`
2. Runs `pg_dump` to create a timestamped plain-SQL dump
3. Applies `chmod 600` permissions
4. Retains the 7 most recent backups
5. Refuses to run if `pg_dump` is missing, the database is unreachable, or another backup is in progress

See `docs/BACKUP_SECURITY.md` for the full security policy.

## Restore procedure

Run `scripts/restore.sh <backup_file> <target_database>`:

1. Validates the backup file exists and is non-empty
2. Refuses to restore into the production or test database
3. Creates the target database (or verifies it is empty if it already exists)
4. Restores via `psql` with `ON_ERROR_STOP=1`
5. Verifies schema objects (tables, enums, FKs, indexes, migrations)
6. Reports success or failure

## Rollback limitations

NexaFlow uses **forward-only migrations** through Drizzle Kit. There are no automatic rollback migrations.

To recover from a failed migration:

1. The backup taken before the migration is the only recovery path.
2. Restore the backup into a new database.
3. Point `DATABASE_URL` at the restored database.
4. Fix the migration or revert the schema change.
5. Re-deploy.

**Always backup before migrating.** This is non-negotiable.

## Manual steps still required

The following steps require hosting-provider or infrastructure configuration that cannot be automated from the repository:

| Step | Description |
|---|---|
| Off-host backup storage | Copy backup files to a separate volume, server, or object store. The backup script only writes locally. |
| Backup encryption | If required, pipe through `openssl` or use encrypted storage. |
| Backup scheduling | Set up a cron job or scheduled task to run `scripts/backup.sh` daily. |
| Backup failure alerting | Monitor the backup script's exit code and output. |
| TLS/HTTPS termination | Configure a reverse proxy or CDN for HTTPS. `APP_URL` must be `https://` in production. |
| PostgreSQL provisioning | Provision and secure the PostgreSQL instance. The application does not manage its own server. |
| Log aggregation | Ship server logs to a central location for diagnosis. |
| Uptime monitoring | Monitor `/api/health` externally. |

## Verification checklist after deployment

```bash
# Application responds
curl -f http://localhost:3000/api/health

# Login page renders
curl -f http://localhost:3000/login

# Protected routes redirect to login
curl -sI http://localhost:3000/dashboard | grep "307"

# Security headers present
curl -sI http://localhost:3000/login | grep -i "content-security-policy"
curl -sI http://localhost:3000/login | grep -i "x-frame-options"
curl -sI http://localhost:3000/login | grep -i "strict-transport-security"
```
