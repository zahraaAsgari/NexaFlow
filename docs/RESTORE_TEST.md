# Restore Test Procedure

## Overview

The restore test proves that a backup can actually be restored into a working database. It is the only way to know a backup is valid — an unverified backup is worthless.

The test is **completely isolated**: it creates its own temporary database, restores into it, verifies the schema, then deletes the temporary database. The production database is only read (by `pg_dump`) and never modified.

## Running the test

```bash
./scripts/restore-test.sh
```

The script exits with code 0 on success and 1 on failure. It prints a step-by-step log of every check.

## What the test verifies

| Step | Check | Expected |
|---|---|---|
| 1 | Backup is created by `backup.sh` | Non-empty `.sql` file in a temp directory |
| 2 | Backup is readable plain SQL | `file` reports ASCII/text; contains `CREATE TABLE`, `CREATE TYPE`, `FOREIGN KEY` |
| 3 | Temporary database is created | Unique name like `nexaflow_restore_test_1764952800_12345` |
| 4 | Backup is restored via `psql` with `ON_ERROR_STOP=1` | No SQL errors |
| 5a | Table count in restored DB | 11 |
| 5b | Enum count in restored DB | 5 |
| 5c | Foreign key count in restored DB | 15 |
| 5d | Index count in restored DB | 37 |
| 5e | Migration ledger entries | 3 |
| 6 | Basic queries work (`SELECT count(*) FROM users`) | Returns without error |
| 7 | Source database untouched | Table and row counts unchanged from pre-test |
| 9 | Temporary database is dropped | Clean exit |

## Safety guarantees

The test **never**:
- Modifies the production database (`app_db`)
- Modifies the test database (`app_test_db`)
- Changes any `.env` file or environment variable
- Leaves behind temporary databases (cleaned up via EXIT trap)
- Leaves behind backup files in the project directory (created in a temp directory)
- Prints credentials or connection strings

## What to do if the test fails

If any check fails:

1. **Do not deploy or open beta access.**
2. Read the step-by-step output to identify which check failed.
3. Check PostgreSQL connectivity: `psql "$DATABASE_URL" -c 'SELECT 1'`
4. Check disk space on the backup destination.
5. Check PostgreSQL logs for errors during the restore.
6. Fix the root cause and re-run the test.
7. Only proceed when the test passes with zero failures.

## Object counts reference

These counts are verified against the actual live schema. If you add a table, enum, FK, or index, update the expected counts in both `scripts/restore.sh` and `scripts/restore-test.sh`:

| Object type | Count |
|---|---|
| Tables | 11 |
| Enums | 5 |
| Foreign keys | 15 |
| Indexes | 37 |
| Migration entries | 3 |

## Running against a different source database

The test reads `DATABASE_URL` from `.env`. To test against a different database (e.g., a staging copy), temporarily point `DATABASE_URL` at that database, run the test, then restore the original value. **Never do this in production.**
