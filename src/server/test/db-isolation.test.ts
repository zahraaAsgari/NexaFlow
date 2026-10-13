import "server-only";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { assertTestDatabaseConfig } from "@/server/test/db-config";
import {
  assertTestDbEmpty,
  readTestDbCounts,
  resetTestDb,
  withTestDb,
} from "@/server/test/db-harness";

/**
 * ISOLATION PROOFS — these make the harness itself trustworthy. No application
 * security claim in the other suites counts until every case here passes.
 *
 * The suite also EXPERIMENTALLY DOCUMENTS the root cause of the earlier
 * contamination: a nested drizzle `db.transaction()` ends with COMMIT, which
 * terminates any outer transaction, so wrapping tests in BEGIN/ROLLBACK can
 * never isolate code that legitimately commits.
 */

const TEST_URL = process.env.TEST_DATABASE_URL ?? "";

/** A connection that is completely independent of the shared `db` singleton. */
async function independentConnection(): Promise<Pool> {
  return new Pool({ connectionString: TEST_URL });
}

async function countRows(pool: Pool, sql: string): Promise<number> {
  const result = await pool.query<{ count: string }>(sql);
  return Number(result.rows[0]?.count ?? 0);
}

afterAll(async () => {
  // Leave the dedicated test database empty once this file finishes.
  await resetTestDb();
});

describe("test-database isolation proofs", () => {
  it("A: a row written during a test is visible inside that test", async () => {
    await withTestDb(async (tx) => {
      await tx
        .insert(users)
        .values({ email: "isolation-a@nexaflow.dev", name: "A", passwordHash: "x" });

      const pool = await independentConnection();
      try {
        const count = await countRows(
          pool,
          "SELECT count(*) FROM users WHERE email = 'isolation-a@nexaflow.dev'",
        );
        expect(count).toBe(1);
      } finally {
        await pool.end();
      }
    });
  });

  it("B: the previous test's row is ABSENT in the next test (independent connection)", async () => {
    await withTestDb(async () => {
      const pool = await independentConnection();
      try {
        const count = await countRows(
          pool,
          "SELECT count(*) FROM users WHERE email = 'isolation-a@nexaflow.dev'",
        );
        expect(count).toBe(0);
      } finally {
        await pool.end();
      }
    });
  });

  it("C: a test that throws does not contaminate the next test", async () => {
    // Reproduce a failing test body: write a row, then throw. The error must
    // propagate exactly as vitest would see it.
    await expect(
      withTestDb(async (tx) => {
        await tx.insert(users).values({
          email: "isolation-thrown@nexaflow.dev",
          name: "C",
          passwordHash: "x",
        });
        throw new Error("deliberate test failure");
      }),
    ).rejects.toThrow("deliberate test failure");
  });

  it("C2: the row written by the throwing test is gone in the next test", async () => {
    await withTestDb(async () => {
      const pool = await independentConnection();
      try {
        const count = await countRows(
          pool,
          "SELECT count(*) FROM users WHERE email = 'isolation-thrown@nexaflow.dev'",
        );
        expect(count).toBe(0);
      } finally {
        await pool.end();
      }
    });
  });

  it("D: repeated execution is stable — a fresh test sees an empty database", async () => {
    await withTestDb(async () => {
      const counts = await readTestDbCounts();
      const nonEmpty = Object.entries(counts).filter(([, c]) => c > 0);
      expect(nonEmpty).toEqual([]);
    });
  });

  it("ROOT CAUSE: a nested db.transaction() COMMITs, terminating any outer transaction", async () => {
    // This test deliberately reproduces the contamination mechanism. It is the
    // reason this harness uses per-test reset instead of BEGIN/ROLLBACK.
    await withTestDb(async () => {
      const outer = await independentConnection();
      try {
        const client = await outer.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            "INSERT INTO organizations (name, slug) VALUES ('root-cause','root-cause')",
          );

          // A drizzle transaction on the same client — exactly what every
          // production data function does internally.
          const { drizzle } = await import("drizzle-orm/node-postgres");
          const schemaModule = await import("@/db/schema");
          const nested = drizzle(client, { schema: schemaModule });

          await nested.transaction(async (tx) => {
            await tx
              .insert(users)
              .values({ email: "root-cause@nexaflow.dev", name: "R", passwordHash: "x" });
          });

          // If the outer transaction is still open, this returns false.
          const status = await client.query<{ no_tx: boolean }>(
            "SELECT txid_current_if_assigned() IS NULL AS no_tx",
          );

          // The nested COMMIT ended the outer transaction...
          expect(status.rows[0]?.no_tx).toBe(true);

          // ...so this ROLLBACK is a no-op and cannot remove anything.
          await client.query("ROLLBACK");
        } finally {
          client.release();
        }
      } finally {
        await outer.end();
      }

      // Independent connection proves the rows survived the ROLLBACK.
      const verify = await independentConnection();
      try {
        const orgCount = await countRows(
          verify,
          "SELECT count(*) FROM organizations WHERE slug = 'root-cause'",
        );
        const userCount = await countRows(
          verify,
          "SELECT count(*) FROM users WHERE email = 'root-cause@nexaflow.dev'",
        );
        expect(orgCount).toBe(1);
        expect(userCount).toBe(1);
      } finally {
        await verify.end();
      }
    });
  });

  it("E: TEST_DATABASE_URL missing fails clearly — never falls back to the dev database", () => {
    expect(() =>
      assertTestDatabaseConfig({ testUrl: undefined, devUrl: "postgres://dev" }),
    ).toThrow(/TEST_DATABASE_URL is unset/);
  });

  it("E2: TEST_DATABASE_URL equal to DATABASE_URL is refused", () => {
    expect(() =>
      assertTestDatabaseConfig({
        testUrl: "postgres://dev",
        devUrl: "postgres://dev",
      }),
    ).toThrow(/must not equal DATABASE_URL/);
  });

  it("E3: the production singleton is pointed at the TEST database, not the development one", async () => {
    const g = globalThis as typeof globalThis & {
      __nexaflowOriginalDatabaseUrl?: string;
    };
    const original = g.__nexaflowOriginalDatabaseUrl;

    expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
    expect(original).toBeTruthy();
    expect(process.env.DATABASE_URL).not.toBe(original);
  });

  it("E4: the DEVELOPMENT database is untouched by test writes", async () => {
    await withTestDb(async (tx) => {
      await tx.insert(users).values({
        email: "dev-safety@nexaflow.dev",
        name: "D",
        passwordHash: "x",
      });
    });

    const g = globalThis as typeof globalThis & {
      __nexaflowOriginalDatabaseUrl?: string;
    };
    const original = g.__nexaflowOriginalDatabaseUrl;
    expect(original).toBeTruthy();

    const dev = new Pool({ connectionString: original });
    try {
      const count = await countRows(
        dev,
        "SELECT count(*) FROM users WHERE email = 'dev-safety@nexaflow.dev'",
      );
      expect(count).toBe(0);
    } finally {
      await dev.end();
    }
  });

  it("F: the test database ends this suite empty", async () => {
    await resetTestDb();
    await assertTestDbEmpty();
  });
});
