import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    /*
     * DB-backed suites isolate at the PHYSICAL database level (one dedicated
     * test database, TRUNCATEd before every test), so test files must not run
     * in parallel — a concurrent file would truncate another file's fixtures
     * mid-test. This constraint is load-bearing, not a workaround for a broken
     * harness: see src/server/test/db-harness.ts for why transaction-rollback
     * isolation is impossible for code that legitimately commits.
     */
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
    setupFiles: ["./src/server/test/vitest-server-compat.ts"],
  },
});
