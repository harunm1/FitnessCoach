// Integration tests (npm run test:integration): Server Actions against a migrated, seeded PostgreSQL (#79).
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.integration.test.ts"],
    // The tests share one database, so files run one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
