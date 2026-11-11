// Release rules for the hosted preview (#57, docs/ARCHITECTURE.md D15): which URL the
// Prisma CLI uses, which steps a Vercel build runs, and what it checks first.

type Env = Record<string, string | undefined>;

// Production and preview deployments migrate; VERCEL_ENV is set at build and run time
// (Vercel system environment variables, checked 10 Nov 2026).
const MIGRATING_ENVS = new Set(["production", "preview"]);

function isHostedBuild(env: Env): boolean {
  return MIGRATING_ENVS.has(env.VERCEL_ENV ?? "");
}

/**
 * The Prisma CLI needs a direct connection for schema changes; the app uses the pooled
 * one (Neon's Prisma guide, checked 5 Nov 2026). The direct URL counts only on a hosted
 * build: locally, scripts/migrate-test.ts points the CLI at the test database through
 * DATABASE_URL, and a Neon string left in the shell or .env must not redirect it.
 */
export function cliDatabaseUrl(env: Env): string | undefined {
  if (isHostedBuild(env) && env.DATABASE_URL_UNPOOLED) {
    return env.DATABASE_URL_UNPOOLED;
  }
  return env.DATABASE_URL;
}

/** "host/database" for a log line; never the user name or password. */
export function databaseTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "an unreadable URL";
  }
}

// The pooled and direct Neon strings for one branch differ only by "-pooler" in the host.
function sameDatabase(pooled: string, direct: string): boolean {
  return (
    databaseTarget(pooled).replace("-pooler", "") === databaseTarget(direct)
  );
}

/**
 * What a hosted build must not start with: a missing pooled URL (the app would fail on
 * its first request), a missing direct URL (migrations would go through the pooler), or
 * two URLs on different databases (a preview could migrate production). Each problem
 * names the variable and never the credentials.
 */
export function hostedDatabaseProblems(env: Env): string[] {
  if (!isHostedBuild(env)) return [];
  const where = `for VERCEL_ENV=${env.VERCEL_ENV}`;
  const problems: string[] = [];
  if (!env.DATABASE_URL) {
    problems.push(
      `DATABASE_URL is not set ${where}; set the pooled Neon string (README, Deploy step 5)`,
    );
  }
  if (!env.DATABASE_URL_UNPOOLED) {
    problems.push(
      `DATABASE_URL_UNPOOLED is not set ${where}; set the direct Neon string (README, Deploy step 5)`,
    );
  }
  if (
    env.DATABASE_URL &&
    env.DATABASE_URL_UNPOOLED &&
    !sameDatabase(env.DATABASE_URL, env.DATABASE_URL_UNPOOLED)
  ) {
    problems.push(
      `DATABASE_URL (${databaseTarget(env.DATABASE_URL)}) and DATABASE_URL_UNPOOLED (${databaseTarget(env.DATABASE_URL_UNPOOLED)}) point at different databases`,
    );
  }
  return problems;
}

/**
 * Production and preview deployments apply committed migrations before building, each
 * to its own Neon branch (Production- and Preview-scoped variables), so a pull request
 * that adds a migration is previewed against a migrated schema. hostedDatabaseProblems
 * checks the two URLs agree before anything runs. Without VERCEL_ENV (local
 * development) it only builds; CI sets VERCEL_ENV=preview to run the hosted path.
 */
export function buildSteps(env: Env): string[] {
  return isHostedBuild(env)
    ? ["prisma migrate deploy", "next build"]
    : ["next build"];
}
