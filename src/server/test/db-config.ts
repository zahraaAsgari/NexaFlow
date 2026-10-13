/**
 * Pure test-database configuration guard.
 *
 * Deliberately has NO imports that touch `@/db` (or anything else that creates
 * a database pool): the vitest setup file imports this module BEFORE
 * `process.env.DATABASE_URL` is redirected at the dedicated test database, so
 * importing the real client here would eagerly connect to the development
 * database and cache that pool on globalThis. Keep this module dependency-free.
 */

export type TestDatabaseConfigInput = {
  testUrl?: string | undefined;
  devUrl?: string | undefined;
};

/**
 * Fails closed unless an explicit, dedicated test database is configured.
 *
 * Never falls back to DATABASE_URL: if TEST_DATABASE_URL is unset the suite
 * must stop, and if it points at the development database the suite must stop
 * even harder — a silent fallback would let tests mutate development data.
 */
export function assertTestDatabaseConfig(
  input: TestDatabaseConfigInput,
): string {
  const { testUrl, devUrl } = input;

  if (!testUrl || testUrl.trim() === "") {
    throw new Error(
      "TEST_DATABASE_URL is unset. Database-backed tests refuse to run rather than fall back to DATABASE_URL — set TEST_DATABASE_URL to a dedicated test database, e.g. postgresql://postgres:postgres@127.0.0.1:5432/app_test_db",
    );
  }

  if (devUrl && testUrl === devUrl) {
    throw new Error(
      "TEST_DATABASE_URL must not equal DATABASE_URL: tests would run against the development database. Provide a dedicated test database instead.",
    );
  }

  return testUrl;
}

/**
 * Runtime resolution used by the harness AFTER the vitest setup has already
 * redirected DATABASE_URL at the test database.
 *
 * Only presence is checked here on purpose: once setup has run, DATABASE_URL
 * and TEST_DATABASE_URL are intentionally equal, so re-running the inequality
 * guard would reject the very configuration it validated. The inequality check
 * lives in `assertTestDatabaseConfig`, which setup calls once against the
 * ORIGINAL development URL before any redirect happens.
 */
export function requireTestDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl || testUrl.trim() === "") {
    throw new Error(
      "TEST_DATABASE_URL is unset. Database-backed tests refuse to run rather than fall back to DATABASE_URL.",
    );
  }
  return testUrl;
}
