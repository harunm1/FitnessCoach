import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { testDatabaseURL } from "../tests/helpers/database-url";

// Never fall back to DATABASE_URL: test migrations must target a dedicated DB.
const result = spawnSync(
  process.execPath,
  [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testDatabaseURL() },
  },
);
process.exitCode = result.status ?? 1;
