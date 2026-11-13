import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { testMigrationEnv } from "../src/lib/deploy/release";
import { testDatabaseURL } from "../tests/helpers/database-url";

// Never fall back to DATABASE_URL: test migrations must target a dedicated DB, even
// with a hosted VERCEL_ENV or a Neon direct URL in the shell (testMigrationEnv, D19).
const result = spawnSync(
  process.execPath,
  [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
  {
    stdio: "inherit",
    env: testMigrationEnv(process.env, testDatabaseURL()),
  },
);
process.exitCode = result.status ?? 1;
