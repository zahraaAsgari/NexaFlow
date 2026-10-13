import "server-only";

import path from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { requireTestDatabaseUrl } from "./db-config";

/**
 * Test-database harness.
 *
 * WHY ISOLATION IS PER-TEST RESET, NOT TRANSACTION ROLLBACK
 * ---------------------------------------------------------
 * The production functions under test (`createPasswordResetToken`,
 * `resetPasswordWithToken`, `createInvitation`, `acceptInvitation`, …) all call
 * `db.transaction()` internally, and a drizzle transaction ENDS WITH `COMMIT`.
 * Experimentally verified against this repository (see
 * `db-isolation.test.ts`): wrapping a test in an outer `BEGIN` and binding `db`
 * to that client means the nested `COMMIT` terminates the outer transaction,
 * so the harness's `ROLLBACK` is a no-op and every row persists. That is not a
 * harness bug — it is the production code doing exactly what it is designed to
 * do. Transaction-rollback isolation therefore CANNOT work for this suite.
 *
 * The correct isolation boundary is the database itself:
 *   1. a DEDICATED test database, selected only by TEST_DATABASE_URL, which is
 *      validated to never equal DATABASE_URL (fail closed, no fallback);
 *   2. every test starts from a clean slate via TRUNCATE ... RESTART IDENTITY;
 *   3. production transactions run exactly as in production and commit into
 *      that test database — which is also more faithful, because real commit
 *      semantics are exercised instead of being discarded.
 *
 * Because isolation is at the physical-database level, DB-backed test files
 * must not run in parallel; `vitest.config.ts` sets `fileParallelism: false`
 * and that constraint is explicit and load-bearing, not a workaround.
 */

/** Every table in the test schema. Order is irrelevant under CASCADE. */
const ALL_TABLES = [
  "email_change_tokens",
  "email_verification_tokens",
  "invitations",
  "password_reset_tokens",
  "sessions",
  "tasks",
  "projects",
  "clients",
  "memberships",
  "organizations",
  "users",
] as const;

/** Connects to the dedicated test database with its own short-lived pool. */
async function withTestPool<T>(
  run: (pool: Pool) => Promise<T>,
): Promise<T> {
  const url = requireTestDatabaseUrl();
  const pool = new Pool({ connectionString: url });
  try {
    return await run(pool);
  } finally {
    // No `.catch(() => undefined)` here: failing to release the pool is an
    // infrastructure failure and must surface, not be swallowed.
    await pool.end();
  }
}

/**
 * Creates the dedicated test database if it does not already exist, then
 * applies the project's real migrations so its schema matches production.
 * Idempotent, so the vitest setup can call it before every test file.
 */
export async function ensureTestDatabase(): Promise<void> {
  const testUrl = requireTestDatabaseUrl();
  const parsed = new URL(testUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");

  if (!databaseName) {
    throw new Error(
      "TEST_DATABASE_URL must include a database name, e.g. .../app_test_db",
    );
  }

  // Connect to the maintenance database to create the test database.
  const maintenanceUrl = new URL(testUrl);
  maintenanceUrl.pathname = "/postgres";
  const maintenance = new Pool({ connectionString: maintenanceUrl.toString() });
  try {
    const exists = await maintenance.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [databaseName],
    );
    if (!exists.rows[0]?.exists) {
      // Identifier comes from the URL; validated to be a simple name.
      if (!/^[a-z0-9_]+$/i.test(databaseName)) {
        throw new Error(
          `Refusing to create a database with an unexpected name: ${databaseName}`,
        );
      }
      await maintenance.query(`CREATE DATABASE ${databaseName}`);
    }
  } finally {
    await maintenance.end();
  }

  // Apply the project's real migrations (no-ops once up to date).
  const pool = new Pool({ connectionString: testUrl });
  try {
    await migrate(drizzle(pool, { schema }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } finally {
    await pool.end();
  }
}

/**
 * Wipes every table in the DEDICATED test database. This is the isolation
 * boundary for each test: the previous test's committed rows are discarded
 * deterministically, so tests cannot see or collide with each other's data.
 */
export async function resetTestDb(): Promise<void> {
  await withTestPool(async (pool) => {
    // Surfaces errors: a failed TRUNCATE means the harness cannot isolate.
    await pool.query(
      `TRUNCATE TABLE ${ALL_TABLES.join(", ")} RESTART IDENTITY CASCADE`,
    );
  });
}

/**
 * Row counts for every table, used by the isolation proofs and by post-suite
 * database inspection. Read through an independent connection.
 */
export async function readTestDbCounts(): Promise<Record<string, number>> {
  return withTestPool(async (pool) => {
    const counts: Record<string, number> = {};
    for (const table of ALL_TABLES) {
      const result = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${table}`,
      );
      counts[table] = Number(result.rows[0]?.count ?? 0);
    }
    return counts;
  });
}

/**
 * Runs one test against a clean, dedicated test database.
 *
 * Lifecycle (strict order):
 *   resetTestDb()  →  callback(real production `db`)  →  return
 *
 * There is no rollback on purpose (see the header). The NEXT test's reset is
 * what removes this test's rows, and `afterAll(resetTestDb)` in each suite
 * leaves the database empty once a file finishes.
 */
export async function withTestDb(
  callback: (db: Db) => Promise<void> | void,
): Promise<void> {
  await resetTestDb();

  // Imported lazily so the setup file can redirect DATABASE_URL before the
  // production singleton creates its pool.
  const { db } = await import("@/db");
  await callback(db);
}

/** Verifies the test database contains no rows at all. */
export async function assertTestDbEmpty(): Promise<void> {
  const counts = await readTestDbCounts();
  const nonEmpty = Object.entries(counts).filter(([, count]) => count > 0);
  if (nonEmpty.length > 0) {
    const summary = nonEmpty.map(([t, c]) => `${t}=${c}`).join(", ");
    throw new Error(`Expected an empty test database, found: ${summary}`);
  }
}
