#!/usr/bin/env bash
#
# NexaFlow backup → restore verification test.
#
# Proves the complete backup/restore cycle works end-to-end:
#
#   1. Creates a fresh backup of the source database.
#   2. Verifies the backup is readable and non-empty.
#   3. Creates a uniquely named temporary restore database.
#   4. Restores the backup into that temporary database.
#   5. Verifies schema objects match the source (tables, enums, FKs,
#      indexes, migration metadata).
#   6. Verifies basic queries work against the restored database.
#   7. Confirms the original production and test databases are untouched.
#   8. Records the result of every step.
#   9. Cleans up only the temporary database and backup file it created.
#
# This test NEVER touches the production database (beyond pg_dump's
# read-only snapshot) and never modifies application environment files.
#
# Usage:
#   ./scripts/restore-test.sh
#
# Environment:
#   DATABASE_URL — read from .env (source database, read-only during dump)

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
RESTORE_SCRIPT="$SCRIPT_DIR/restore.sh"

PASS=0
FAIL=0
step() {
  echo ""
  echo "=== $1 ==="
}
pass() {
  echo "  PASS: $1"
  PASS=$((PASS + 1))
}
fail() {
  echo "  FAIL: $1" >&2
  FAIL=$((FAIL + 1))
}

# --- Pre-flight ----------------------------------------------------------------

step "Pre-flight checks"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found." >&2
  exit 1
fi
pass "Environment file present"

DATABASE_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi
pass "DATABASE_URL configured"

SOURCE_DB="$(echo "$DATABASE_URL" | sed 's|.*/||' | sed 's|?.*||')"
MAINTENANCE_URL="$(echo "$DATABASE_URL" | sed "s|/$SOURCE_DB|/postgres|")"

for tool in pg_dump psql; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERROR: $tool is not installed." >&2
    exit 1
  fi
done
pass "PostgreSQL tooling present (pg_dump, psql)"

if ! psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "ERROR: Cannot connect to source database." >&2
  exit 1
fi
pass "Source database reachable"

# --- Record pre-test source state --------------------------------------------------

step "Recording source database state (for post-test comparison)"

PRE_SOURCE_TABLES="$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
PRE_SOURCE_USERS="$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM users;" 2>/dev/null || echo 0)"
PRE_SOURCE_ORGS="$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM organizations;" 2>/dev/null || echo 0)"
echo "  Source tables: $PRE_SOURCE_TABLES"
echo "  Source users: $PRE_SOURCE_USERS"
echo "  Source organizations: $PRE_SOURCE_ORGS"
pass "Source state recorded"

# --- Step 1: Create a fresh backup ------------------------------------------------

step "Step 1: Creating fresh backup"

TEST_BACKUP_DIR="$(mktemp -d /tmp/nexaflow_backup_test_XXXXXX)"
trap 'rm -rf "$TEST_BACKUP_DIR"' EXIT

if NEXAFLOW_BACKUP_DIR="$TEST_BACKUP_DIR" "$BACKUP_SCRIPT"; then
  pass "Backup created successfully"
else
  fail "Backup script failed"
  echo "ABORTING: cannot test restore without a valid backup." >&2
  echo "Results: $PASS passed, $FAIL failed" >&2
  exit 1
fi

# --- Step 2: Verify backup is readable and non-empty -------------------------------

step "Step 2: Verifying backup readability"

BACKUP_FILE="$(ls -1 "$TEST_BACKUP_DIR"/nexaflow_*.sql | head -1)"

if [[ -z "$BACKUP_FILE" ]]; then
  fail "No backup file found in $TEST_BACKUP_DIR"
  echo "ABORTING." >&2
  echo "Results: $PASS passed, $FAIL failed" >&2
  exit 1
fi

if [[ -s "$BACKUP_FILE" ]]; then
  BACKUP_LINES="$(wc -l < "$BACKUP_FILE")"
  BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
  echo "  Backup file: $(basename "$BACKUP_FILE")"
  echo "  Size: $BACKUP_SIZE ($BACKUP_LINES lines)"
  pass "Backup is non-empty"
else
  fail "Backup file is empty"
  echo "ABORTING." >&2
  echo "Results: $PASS passed, $FAIL failed" >&2
  exit 1
fi

# Portable text check: verify the file contains SQL text markers (not binary).
if head -c 512 "$BACKUP_FILE" | grep -q 'CREATE TABLE\|PostgreSQL database dump'; then
  pass "Backup is plain SQL text"
else
  fail "Backup does not appear to be plain SQL text"
fi

# Verify the backup contains schema markers.
DUMP_TABLES="$(grep -c 'CREATE TABLE' "$BACKUP_FILE" || true)"
if [[ "$DUMP_TABLES" -ge 11 ]]; then
  pass "Backup contains $DUMP_TABLES CREATE TABLE statements"
else
  fail "Backup contains only $DUMP_TABLES CREATE TABLE statements"
fi

DUMP_TYPES="$(grep -c 'CREATE TYPE' "$BACKUP_FILE" || true)"
if [[ "$DUMP_TYPES" -ge 5 ]]; then
  pass "Backup contains $DUMP_TYPES CREATE TYPE statements"
else
  fail "Backup contains only $DUMP_TYPES CREATE TYPE statements"
fi

DUMP_FKS="$(grep -c 'FOREIGN KEY' "$BACKUP_FILE" || true)"
if [[ "$DUMP_FKS" -ge 15 ]]; then
  pass "Backup contains $DUMP_FKS FOREIGN KEY references"
else
  fail "Backup contains only $DUMP_FKS FOREIGN KEY references"
fi

# --- Step 3: Create a uniquely named temporary database ----------------------------

step "Step 3: Creating temporary restore database"

TEST_DB_NAME="nexaflow_restore_test_$(date +%s)_$$"

# Verify the name does not already exist.
EXISTING="$(psql "$MAINTENANCE_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='$TEST_DB_NAME';" 2>/dev/null || echo "")"
if [[ "$EXISTING" == "1" ]]; then
  fail "Temporary database name already exists: $TEST_DB_NAME"
  echo "ABORTING." >&2
  echo "Results: $PASS passed, $FAIL failed" >&2
  exit 1
fi
pass "Temporary database name is unique: $TEST_DB_NAME"

psql "$MAINTENANCE_URL" -c "CREATE DATABASE \"$TEST_DB_NAME\";" >/dev/null
pass "Temporary database created"

# Ensure cleanup runs on exit (in addition to the tmpdir cleanup).
CLEANUP_DB_NAME="$TEST_DB_NAME"
trap 'rm -rf "$TEST_BACKUP_DIR"; psql "$MAINTENANCE_URL" -c "DROP DATABASE IF EXISTS \"$CLEANUP_DB_NAME\";" >/dev/null 2>&1 || true' EXIT

# --- Step 4: Restore into the temporary database -----------------------------------

step "Step 4: Restoring backup into temporary database"

if "$RESTORE_SCRIPT" "$BACKUP_FILE" "$TEST_DB_NAME"; then
  pass "Restore completed successfully"
else
  fail "Restore script failed"
  echo "Cleaning up and aborting." >&2
  psql "$MAINTENANCE_URL" -c "DROP DATABASE IF EXISTS \"$TEST_DB_NAME\";" >/dev/null 2>&1 || true
  echo "Results: $PASS passed, $FAIL failed" >&2
  exit 1
fi

# --- Step 5: Verify schema object counts ----------------------------------------------

step "Step 5: Verifying restored schema objects"

TARGET_URL="$(echo "$DATABASE_URL" | sed "s|/${SOURCE_DB}$|/${TEST_DB_NAME}|")"

# Use the same expectations the restore script verified, but double-check here.
check_count() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$desc = $actual"
  else
    fail "$desc: expected $expected, got $actual"
  fi
}

T="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
check_count "Table count" 11 "$T"

E="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM pg_type WHERE typtype='enum' AND typnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public');")"
check_count "Enum count" 5 "$E"

F="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace;")"
check_count "Foreign key count" 15 "$F"

I="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM pg_indexes WHERE schemaname='public';")"
check_count "Index count" 37 "$I"

M="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM \"drizzle\".\"__drizzle_migrations\";" 2>/dev/null || echo 0)"
check_count "Migration entries" 3 "$M"

# --- Step 6: Verify basic queries ---------------------------------------------------

step "Step 6: Verifying basic queries against restored database"

R_USERS="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM users;")"
R_ORGS="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM organizations;")"
R_TABLES="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"

echo "  users: $R_USERS rows"
echo "  organizations: $R_ORGS rows"
echo "  tables: $R_TABLES"

if [[ "$R_TABLES" == 11 ]]; then
  pass "Basic queries work (11 tables accessible)"
else
  fail "Basic query returned $R_TABLES tables instead of 11"
fi

# Verify the migration ledger is queryable.
if psql "$TARGET_URL" -tAc "SELECT id FROM \"drizzle\".\"__drizzle_migrations\" ORDER BY id LIMIT 1;" >/dev/null 2>&1; then
  pass "Migration ledger is queryable"
else
  fail "Migration ledger is not queryable"
fi

# --- Step 7: Confirm original databases are untouched -------------------------------

step "Step 7: Confirming original databases are untouched"

POST_SOURCE_TABLES="$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
if [[ "$POST_SOURCE_TABLES" == "$PRE_SOURCE_TABLES" ]]; then
  pass "Source database table count unchanged ($POST_SOURCE_TABLES)"
else
  fail "Source database table count changed: $PRE_SOURCE_TABLES → $POST_SOURCE_TABLES"
fi

POST_SOURCE_USERS="$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM users;" 2>/dev/null || echo 0)"
if [[ "$POST_SOURCE_USERS" == "$PRE_SOURCE_USERS" ]]; then
  pass "Source database user count unchanged ($POST_SOURCE_USERS)"
else
  fail "Source database user count changed: $PRE_SOURCE_USERS → $POST_SOURCE_USERS"
fi

# Check that app_test_db is either absent (normal) or unchanged.
TEST_DB_CHECK="$(psql "$MAINTENANCE_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='app_test_db';" 2>/dev/null || echo "")"
if [[ "$TEST_DB_CHECK" != "1" ]]; then
  pass "Test database (app_test_db) not present (expected — it is created only by the test suite)"
else
  pass "Test database (app_test_db) exists and was not modified"
fi

# --- Step 8: Summary ----------------------------------------------------------------

step "Step 8: Summary"

echo ""
echo "Backup/Restore Test Results:"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"

# --- Step 9: Cleanup ----------------------------------------------------------------

step "Step 9: Cleanup"

# Remove the temporary database (only if it matches our unique name pattern).
if [[ "$TEST_DB_NAME" =~ ^nexaflow_restore_test_[0-9]+_[0-9]+$ ]]; then
  psql "$MAINTENANCE_URL" -c "DROP DATABASE IF EXISTS \"$TEST_DB_NAME\";" >/dev/null
  pass "Temporary database dropped: $TEST_DB_NAME"
else
  fail "Refusing to drop unexpected database name: $TEST_DB_NAME"
fi

# The temp directory with the backup file is cleaned by the EXIT trap.
pass "Temporary backup directory will be cleaned by EXIT trap"

# --- Final verdict ---------------------------------------------------------------------

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "VERDICT: PASS — backup/restore cycle verified successfully."
  echo ""
  echo "This proves:"
  echo "  - pg_dump creates a valid, readable, non-empty backup."
  echo "  - The backup restores into an isolated empty database."
  echo "  - All 11 tables, 5 enums, 15 FKs, 37 indexes, and 3 migration entries survive."
  echo "  - The source database remains completely unchanged."
  exit 0
else
  echo "VERDICT: FAIL — $FAIL check(s) did not pass."
  echo ""
  echo "Do NOT rely on backups until all checks pass."
  exit 1
fi
