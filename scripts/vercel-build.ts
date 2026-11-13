// Vercel build command (vercel.json): checks VERCEL_ENV and the database URLs, then runs the steps from buildSteps, stopping at the first failure.
import { execSync } from "node:child_process";
import {
  buildSteps,
  cliDatabaseUrl,
  databaseTarget,
  hostedDatabaseProblems,
  vercelEnvProblem,
} from "../src/lib/deploy/release";

const env = process.env;
const steps = buildSteps(env);
const migrates = steps.includes("prisma migrate deploy");

const envProblem = vercelEnvProblem(env);
const problems = envProblem ? [envProblem] : hostedDatabaseProblems(env);
if (problems.length > 0) {
  problems.forEach((problem) => console.error(`Build stopped: ${problem}`));
  process.exit(1);
}

console.log(
  `VERCEL_ENV=${env.VERCEL_ENV ?? "(unset)"}: migrations ${migrates ? "run first" : "skipped"}`,
);

const target = cliDatabaseUrl(env);
if (migrates && target) console.log(`Migrating ${databaseTarget(target)}`);

steps.forEach((step) => {
  console.log(`> ${step}`);
  try {
    execSync(`npx --no-install ${step}`, { stdio: "inherit" });
  } catch (error) {
    const status = (error as { status?: number | null }).status;
    console.error(
      `Step failed: ${step} (exit ${status ?? "signal"}); later steps not run`,
    );
    process.exit(status ?? 1);
  }
});
