/**
 * Vitest setup — runs before each test file's module graph is loaded.
 *
 * Three responsibilities, in order:
 *
 *  1. Load `.env` (Next does this at runtime; vitest does not) so the original
 *     development DATABASE_URL is visible for the guard below.
 *  2. Mock the `server-only` package. That package is BUILD-TIME protection:
 *     Next's bundler refuses to emit client code that imports it, but its
 *     runtime module throws unconditionally, which would stop any server
 *     module from loading in plain Node. Mocking it here does not weaken the
 *     production boundary — `next build` still enforces it.
 *  3. Validate TEST_DATABASE_URL (dedicated, never equal to the development
 *     URL, never a silent fallback), make sure that database exists and is
 *     migrated, then REDIRECT process.env.DATABASE_URL at it.
 *
 * Step 3 is what makes every production module that imports `db` from "@/db"
 * target the test database with zero production-code changes: the real
 * singleton simply reads a different URL at pool-creation time, exactly as it
 * would in any other environment.
 */
import "dotenv/config";

import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertTestDatabaseConfig } from "./db-config";

type GlobalWithSetup = typeof globalThis & {
  __nexaflowTestSetup?: Promise<void>;
  __nexaflowOriginalDatabaseUrl?: string;
};

const g = globalThis as GlobalWithSetup;

function runSetup(): Promise<void> {
  if (g.__nexaflowTestSetup) return g.__nexaflowTestSetup;

  g.__nexaflowTestSetup = (async () => {
    // Capture BEFORE overwriting so tests can prove the dev DB was never used.
    const originalDatabaseUrl = process.env.DATABASE_URL;
    g.__nexaflowOriginalDatabaseUrl = originalDatabaseUrl;

    const testUrl = assertTestDatabaseConfig({
      testUrl: process.env.TEST_DATABASE_URL,
      devUrl: originalDatabaseUrl,
    });

    // Imported lazily: db-harness must not load "@/db" (that would create a
    // pool to the development database before the redirect happens).
    const { ensureTestDatabase } = await import("./db-harness");
    await ensureTestDatabase();

    process.env.DATABASE_URL = testUrl;
  })();

  return g.__nexaflowTestSetup;
}

await runSetup();
