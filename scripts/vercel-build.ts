// Vercel build command (vercel.json): checks VERCEL_ENV and the database URLs, then runs the steps from buildSteps (migrate, seed, build) through runSteps, stopping at the first failure.
import { execSync } from "node:child_process";
import {
  buildSteps,
  cliDatabaseUrl,
  databaseTarget,
  hostedDatabaseProblems,
  runSteps,
  vercelEnvProblem,
} from "../src/lib/deploy/release";

const env = process.env;
const steps = buildSteps(env);

const envProblem = vercelEnvProblem(env);
const problems = envProblem ? [envProblem] : hostedDatabaseProblems(env);
if (problems.length > 0) {
  problems.forEach((problem) => console.error(`Build stopped: ${problem}`));
  process.exit(1);
}

console.log(
  `VERCEL_ENV=${env.VERCEL_ENV ?? "(unset)"}: steps ${steps.join(" -> ")}`,
);

const target = cliDatabaseUrl(env);
if (steps.includes("prisma migrate deploy") && target) {
  console.log(`Migrating ${databaseTarget(target)}`);
}

// Runs one command with the inherited output; returns its exit status.
function run(command: string, stepEnv: NodeJS.ProcessEnv): number {
  console.log(`> ${command}`);
  try {
    execSync(command, { stdio: "inherit", env: stepEnv });
    return 0;
  } catch (error) {
    return (error as { status?: number | null }).status ?? 1;
  }
}

const failed = runSteps(steps, env, run);
if (failed) {
  console.error(
    `Step failed: ${failed.step} (exit ${failed.status}); later steps not run`,
  );
  process.exit(failed.status);
}
