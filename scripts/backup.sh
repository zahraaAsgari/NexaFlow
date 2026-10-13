#!/usr/bin/env bash
#
# NexaFlow database backup script.
#
# Creates a plain-SQL logical backup of the NexaFlow PostgreSQL database
# using pg_dump. The output is a human-readable .sql file containing the
# full schema (tables, enums, foreign keys, indexes, unique constraints)
# and all row data.
#
# Safety properties:
#   - Fails immediately if pg_dump, .env, or DATABASE_URL is missing.
#   - Never prints credentials or connection strings.
#   - Writes to a temporary file first; atomically renames only on success.
#   - Never leaves a partial backup that looks like a valid one.
#   - Applies umask 077 so the dump is readable only by the owner.
#   - Uses flock to prevent concurrent executions.
#   - Never overwrites an existing backup file.
#   - Retention keeps the 7 most recent valid backups; never deletes the
#     last known-good backup when a new backup fails.
#
# Storage note:
#   The default destination (./backups/) is local and on the same host as
#   the database. For production resilience you MUST also copy backups to
#   independent storage (a different volume, off-host location, or object
#   store). This script does NOT provide that redundancy — it only creates
#   the local dump. See docs/BACKUP_SECURITY.md for the full policy.
#
# Usage:
#   ./scripts/backup.sh
#
# Environment:
#   DATABASE_URL         — read from .env (required)
#   NEXAFLOW_BACKUP_DIR — override the backup destination (optional;
#                          default: ./backups)

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

# --- Locate configuration --------------------------------------------------

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Cannot read DATABASE_URL." >&2
  exit 1
fi

DATABASE_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"

if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL is not set in $ENV_FILE." >&2
  exit 1
fi

BACKUP_DIR="${NEXAFLOW_BACKUP_DIR:-$PROJECT_DIR/backups}"

# --- Locate tooling ----------------------------------------------------------

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump is not installed or not in PATH." >&2
  exit 1
fi

# --- Validate the database is reachable --------------------------------------

if ! psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "ERROR: Cannot connect to the database. Check DATABASE_URL." >&2
  exit 1
fi

# --- Prevent concurrent runs -------------------------------------------------

LOCK_FILE="$BACKUP_DIR/.backup.lock"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "ERROR: Another backup is already running." >&2
  exit 1
fi

# --- Create the backup --------------------------------------------------------

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_NAME="nexaflow_${TIMESTAMP}.sql"
TEMP_FILE="${BACKUP_DIR}/.${BACKUP_NAME}.tmp"
FINAL_FILE="${BACKUP_DIR}/${BACKUP_NAME}"

if [[ -f "$FINAL_FILE" ]]; then
  echo "ERROR: Backup file already exists: $BACKUP_NAME" >&2
  exit 1
fi

echo "Creating backup: $BACKUP_NAME"

# Write to a temp file first. pg_dump's exit status is checked by set -e.
pg_dump \
  --no-owner \
  --no-privileges \
  --file "$TEMP_FILE" \
  "$DATABASE_URL"

# --- Validate the backup ------------------------------------------------------

if [[ ! -s "$TEMP_FILE" ]]; then
  rm -f "$TEMP_FILE"
  echo "ERROR: Backup is empty. Removing partial file." >&2
  exit 1
fi

# Check that the dump contains the expected schema markers.
TABLE_COUNT="$(grep -c 'CREATE TABLE' "$TEMP_FILE" || true)"
if [[ "$TABLE_COUNT" -lt 11 ]]; then
  rm -f "$TEMP_FILE"
  echo "ERROR: Backup contains only $TABLE_COUNT CREATE TABLE statements (expected at least 11). Removing partial file." >&2
  exit 1
fi

# Atomically promote the temp file to the final backup.
mv "$TEMP_FILE" "$FINAL_FILE"
chmod 600 "$FINAL_FILE"

BACKUP_SIZE="$(du -h "$FINAL_FILE" | cut -f1)"
echo "Backup created: $BACKUP_NAME ($BACKUP_SIZE)"

# --- Retention: keep the 7 most recent backups --------------------------------
#
# Retention runs only after a successful backup. If this backup failed,
# the previous 7 remain untouched — we never delete the last known-good
# backup to make room for a failed one.

cd "$BACKUP_DIR"

# List valid backup files sorted newest-first, skip the first 7, delete the rest.
ls -1t nexaflow_*.sql 2>/dev/null | tail -n +8 | while IFS= read -r old_backup; do
  # Safety: never delete a file that is not a nexaflow_*.sql backup.
  if [[ "$old_backup" =~ ^nexaflow_[0-9]{8}T[0-9]{6}Z\.sql$ ]]; then
    rm -f "$old_backup"
    echo "Retention: removed $old_backup"
  else
    echo "Retention: skipped unexpected file $old_backup" >&2
  fi
done

# --- Summary -------------------------------------------------------------------

REMAINING="$(ls -1 nexaflow_*.sql 2>/dev/null | wc -l)"
echo "Done. $REMAINING backup(s) in $BACKUP_DIR."
echo ""
echo "WARNING: This backup is stored locally on the same host as the database."
echo "For production resilience, copy it to independent storage."
echo "See docs/BACKUP_SECURITY.md for the full policy."
