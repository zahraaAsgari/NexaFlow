# Backup Security Policy

## What backups contain

A NexaFlow backup is a **plain SQL text file** produced by `pg_dump`. It contains the complete database: every table, every enum, every foreign key, every index, and **all row data**. This means every backup file includes:

| Data | Sensitivity | Why it matters |
|---|---|---|
| `users.password_hash` | **Critical** | scrypt password hashes. If leaked, an attacker can attempt offline cracking. |
| `sessions.token_hash` | **Critical** | SHA-256 session token hashes. If leaked alongside a known token pattern, active sessions could be impersonated. |
| `password_reset_tokens.token_hash` | **Critical** | Password reset token hashes. If leaked before expiry, an attacker could reset a user's password. |
| `email_verification_tokens.token_hash` | **Critical** | Email verification token hashes. |
| `email_change_tokens.token_hash` | **Critical** | Email change token hashes. |
| `invitations.token_hash` | **Critical** | Invitation token hashes. |
| `users.email` | **PII** | User email addresses. Subject to privacy regulations. |
| `invitations.email` | **PII** | Invited member email addresses. |
| `email_change_tokens.new_email` | **PII** | Pending email change targets. |
| `organizations.name`, `organizations.slug` | **Business data** | Organization identity. |
| `clients.name`, `clients.email`, `clients.company` | **Business data + PII** | Client relationship data. |
| `projects.name`, `projects.description` | **Business data** | Project content. |
| `tasks.title`, `tasks.status`, `tasks.priority`, `tasks.due_date` | **Business data** | Task details. |
| `memberships.role` | **Access control** | Who has owner/admin/member access to which organization. |

**A backup file must be treated with the same security as the production database itself.**

## File permissions

- Backup scripts run with `umask 077`.
- Every backup file is `chmod 600` (readable/writable by the owner only).
- The backup directory is `chmod 700` (accessible by the owner only).
- Only the system account that runs the backup script and authorized operators should have access.

## Storage requirements

### What the backup script provides

The `scripts/backup.sh` script writes to a local `backups/` directory (configurable via `NEXAFLOW_BACKUP_DIR`). This is **on the same host** as the PostgreSQL server.

### What it does NOT provide (you must do separately)

| Requirement | Status | Action required |
|---|---|---|
| Off-host copy | **NOT IMPLEMENTED** | Copy backup files to a separate volume, server, or object store. A single-host failure destroys both the database and its backups. |
| Encryption at rest | **NOT IMPLEMENTED** | If your storage requires encryption, pipe through `openssl enc -aes-256-cbc` or use encrypted storage. |
| Automated scheduling | **NOT IMPLEMENTED** | Set up a cron job or scheduled task to run `scripts/backup.sh` daily. |
| Backup failure alerting | **NOT IMPLEMENTED** | Monitor the exit code and output of the backup script. A non-zero exit means the backup failed. |
| Access logging | **NOT IMPLEMENTED** | If your storage supports it, enable access logs on the backup directory. |

## Retention policy

- **Keep 7 daily backups** (one week).
- The backup script automatically deletes older backups **only after** a successful new backup.
- If a new backup fails, all existing backups remain untouched.
- The script never deletes the last remaining backup to make room for a failed one.

## What must NEVER happen

- Backup files must **never** be committed to Git.
- Backup files must **never** be stored in a publicly accessible location.
- Backup files must **never** be shared via unencrypted channels.
- Backup files must **never** be emailed or attached to tickets.
- Backup files must **never** be included in Docker images or deployment artifacts.
- Credentials must **never** be printed in logs or terminal output.

## .gitignore protection

The project's `.gitignore` excludes:
```
.env
.env.*
!.env.example
backups/
```

This prevents accidental commits of both secrets and backup dumps.

## Credential separation

The backup script reads `DATABASE_URL` from `.env` and passes it directly to `pg_dump` as a command-line argument. It never echoes, logs, or stores the connection string. The restore script follows the same pattern.

For production, consider creating a dedicated PostgreSQL role with `READ` access only (not superuser) specifically for backup operations, separate from the application's role.

## Disaster recovery expectations

If the production database is lost:

1. Obtain the most recent backup file from your off-host storage.
2. Run `scripts/restore.sh <backup_file> <new_database_name>` on a PostgreSQL server.
3. Verify the restore output (tables, enums, FKs, indexes, migrations).
4. Point `DATABASE_URL` to the restored database.
5. Restart the application.

**Recovery Time Objective (proposed):** 4 hours.
**Recovery Point Objective (proposed):** 24 hours (one daily backup).
