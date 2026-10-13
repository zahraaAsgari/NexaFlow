#!/usr/bin/env bash
#
# NexaFlow database restore script.
#
# Restores a plain-SQL backup file into an explicitly specified target
# database. The target must be a database that this script creates (or
# that already exists but is explicitly approved as empty and isolated).
#
# Safety properties:
#   - Requires an explicit backup file and an explicit target database.
#   - REFUSES to restore into the production database (app_db) or the
#     automated test database (app_test_db).
#   - Never drops, truncates, or overwrites an existing database.
#   - Uses psql (not pg_restore) because backups are plain SQL.
#   - Uses ON_ERROR_STOP=1 so any SQL error aborts the restore.
#   - Verifies schema objects after restore.
#   - Never prints credentials or restored data.
#
# Usage:
#   ./scripts/restore.sh <backup_file> <target_database>
#
# Arguments:
#   backup_file     — path to a .sql backup file created by backup.sh
#   target_database — name of the database to restore into
#                     (must NOT be the production or test database)
#
# Environment:
#   DATABASE_URL — read from .env (used to connect to the PostgreSQL server
#                   for admin operations like CREATE DATABASE)

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

# --- Parse arguments ---------------------------------------------------------

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <backup_file> <target_database>" >&2
  echo "" >&2
  echo "  backup_file      — path to a .sql backup created by backup.sh" >&2
  echo "  target_database — name of a NEW or explicitly approved empty database" >&2
  exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="$2"

# --- Locate configuration ------------------------------------------------------

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found." >&2
  exit 1
fi

DATABASE_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"

if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL is not set in $ENV_FILE." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is not installed." >&2
  exit 1
fi

# --- Validate the backup file ---------------------------------------------------

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "ERROR: Backup file is empty." >&2
  exit 1
fi

if [[ "$BACKUP_FILE" != *.sql ]]; then
  echo "ERROR: Backup file must be a .sql file (plain SQL dump)." >&2
  exit 1
fi

# --- Protect critical databases --------------------------------------------------

# Extract the database name from the URL for comparison.
SOURCE_DB="$(echo "$DATABASE_URL" | sed 's|.*/||' | sed 's|?.*||')"

PROTECTED_DBS=(
  "$SOURCE_DB"
  "app_db"
  "app_test_db"
  "postgres"
  "template0"
  "template1"
)

for protected in "${PROTECTED_DBS[@]}"; do
  if [[ "$TARGET_DB" == "$protected" ]]; then
    echo "ERROR: Refusing to restore into '$TARGET_DB' — this is a protected database." >&2
    echo "Protected databases: ${PROTECTED_DBS[*]}" >&2
    exit 1
  fi
done

# --- Check that the target database does not already exist -------------------------

# Connect to the maintenance database to check.
MAINTENANCE_URL="$(echo "$DATABASE_URL" | sed "s|/$SOURCE_DB|/postgres|")"

EXISTING_DB="$(psql "$MAINTENANCE_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='$TARGET_DB';" 2>/dev/null || echo "")"

# Build the target URL (same host/credentials, different database name).
TARGET_URL="$(echo "$DATABASE_URL" | sed "s|/$SOURCE_DB|/$TARGET_DB|")"

if [[ "$EXISTING_DB" == "1" ]]; then
  # The target already exists. Refuse unless it is confirmed empty.
  TABLE_COUNT="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" 2>/dev/null || echo "-1")"

  if [[ "$TABLE_COUNT" != "0" ]]; then
    echo "ERROR: Target database '$TARGET_DB' already exists and is not empty ($TABLE_COUNT tables)." >&2
    echo "This script will never overwrite a database with existing tables." >&2
    exit 1
  fi
  echo "Target database '$TARGET_DB' exists but is empty. Proceeding."
else
  # Create the target database.
  echo "Creating target database: $TARGET_DB"
  psql "$MAINTENANCE_URL" -c "CREATE DATABASE \"$TARGET_DB\";" >/dev/null
fi

# --- Restore ----------------------------------------------------------------------

echo "Restoring backup into: $TARGET_DB"


# ON_ERROR_STOP ensures any SQL failure aborts the restore immediately.
psql \
  --set ON_ERROR_STOP=1 \
  --quiet \
  --file "$BACKUP_FILE" \
  "$TARGET_URL"

# --- Verify schema objects -----------------------------------------------------------

# These counts are derived from the actual NexaFlow schema (verified live).
EXPECTED_TABLES=11
EXPECTED_ENUMS=5
EXPECTED_FKS=15
EXPECTED_INDEXES=37
EXPECTED_MIGRATIONS=3

verify_count() {
  local description="$1"
  local expected="$2"
  local actual="$3"

  if [[ "$actual" != "$expected" ]]; then
    echo "ERROR: $description — expected $expected, got $actual." >&2
    exit 1
  fi
  echo "  $description: $actual ✓"
}

echo "Verifying restored schema..."

ACTUAL_TABLES="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
verify_count "Tables" "$EXPECTED_TABLES" "$ACTUAL_TABLES"

ACTUAL_ENUMS="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM pg_type WHERE typtype='enum' AND typnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public');")"
verify_count "Enums" "$EXPECTED_ENUMS" "$ACTUAL_ENUMS"

ACTUAL_FKS="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace;")"
verify_count "Foreign keys" "$EXPECTED_FKS" "$ACTUAL_FKS"

ACTUAL_INDEXES="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM pg_indexes WHERE schemaname='public';")"
verify_count "Indexes" "$EXPECTED_INDEXES" "$ACTUAL_INDEXES"

ACTUAL_MIGRATIONS="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM \"drizzle\".\"__drizzle_migrations\";" 2>/dev/null || echo "0")"
verify_count "Migration entries" "$EXPECTED_MIGRATIONS" "$ACTUAL_MIGRATIONS"

# --- Verify basic queries ---------------------------------------------------------------

echo "Verifying basic queries..."

USER_COUNT="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM users;" 2>/dev/null || echo "-1")"
ORG_COUNT="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM organizations;" 2>/dev/null || echo "-1")"

if [[ "$USER_COUNT" -lt 0 ]] || [[ "$ORG_COUNT" -lt 0 ]]; then
  echo "ERROR: Basic queries against restored database failed." >&2
  exit 1
fi

echo "  users: $USER_COUNT rows"
echo "  organizations: $ORG_COUNT rows"

# --- Confirm source databases are untouched ---------------------------------------------

SOURCE_TABLES="$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
if [[ "$SOURCE_TABLES" != "$EXPECTED_TABLES" ]]; then
  echo "WARNING: Source database table count changed ($SOURCE_TABLES vs expected $EXPECTED_TABLES)." >&2
fi

echo ""
echo "Restore successful."
echo "  Backup file: $BACKUP_FILE"
echo "  Target database: $TARGET_DB"
echo "  Schema verified: $ACTUAL_TABLES tables, $ACTUAL_ENUMS enums, $ACTUAL_FKS FKs, $ACTUAL_INDEXES indexes, $ACTUAL_MIGRATIONS migrations"
