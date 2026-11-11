// Release rules for the hosted preview (#57, docs/ARCHITECTURE.md D19): which URL the
// Prisma CLI uses, which steps a Vercel build runs, and what it checks first.

type Env = Record<string, string | undefined>;

// Production and preview deployments migrate; VERCEL_ENV is set at build and run time
// (Vercel system environment variables, checked 10 Nov 2026).
const MIGRATING_ENVS = new Set(["production", "preview"]);
const VERCEL_ENVS = new Set(["production", "preview", "development"]);

function isHostedBuild(env: Env): boolean {
  return MIGRATING_ENVS.has(env.VERCEL_ENV ?? "");
}

/**
 * VERCEL=1 and VERCEL_ENV are system environment variables (Vercel docs, checked 11 Nov
 * 2026). A Vercel build that sees VERCEL but no known VERCEL_ENV would skip migrations
 * without a word, so it stops instead and names the project setting to turn on.
 * Off Vercel (local, CI) VERCEL is unset and nothing is checked.
 */
export function vercelEnvProblem(env: Env): string | undefined {
  if (!env.VERCEL || VERCEL_ENVS.has(env.VERCEL_ENV ?? "")) return undefined;
  return 'VERCEL is set but VERCEL_ENV is not production, preview or development; turn on "Enable access to System Environment Variables" in the Vercel project (README, Deploy step 5)';
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

function parseUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

/** "host/database" for a log line; never the user name or password. */
export function databaseTarget(url: string): string {
  const parsed = parseUrl(url);
  return parsed ? `${parsed.host}${parsed.pathname}` : "an unreadable URL";
}

// Neon's pooled host carries "-pooler"; the direct host for the same branch does not.
function isPooledHost(url: URL): boolean {
  return url.hostname.includes("-pooler");
}

// The pooled and direct Neon strings for one branch differ only by "-pooler" in the host.
function sameDatabase(pooled: URL, direct: URL): boolean {
  const target = (url: URL) => `${url.host}${url.pathname}`;
  return target(pooled).replace("-pooler", "") === target(direct);
}

const DEPLOY_STEP = "(README, Deploy step 5)";

// Problems with two set URLs: unreadable, the pooled string pasted as the direct one,
// or two different databases.
function urlPairProblems(
  pooled: string,
  direct: string,
  where: string,
): string[] {
  const pooledUrl = parseUrl(pooled);
  const directUrl = parseUrl(direct);
  const problems: string[] = [];
  if (!pooledUrl) {
    problems.push(
      `DATABASE_URL is not a readable URL ${where}; copy the pooled Neon string again ${DEPLOY_STEP}`,
    );
  }
  if (!directUrl) {
    problems.push(
      `DATABASE_URL_UNPOOLED is not a readable URL ${where}; copy the direct Neon string again ${DEPLOY_STEP}`,
    );
  }
  if (!pooledUrl || !directUrl) return problems;
  if (isPooledHost(directUrl)) {
    return [
      `DATABASE_URL_UNPOOLED (${databaseTarget(direct)}) is a pooled string ${where}; set the direct Neon string, with connection pooling off ${DEPLOY_STEP}`,
    ];
  }
  if (!sameDatabase(pooledUrl, directUrl)) {
    return [
      `DATABASE_URL (${databaseTarget(pooled)}) and DATABASE_URL_UNPOOLED (${databaseTarget(direct)}) point at different databases`,
    ];
  }
  return [];
}

/**
 * What a hosted build must not start with: a missing pooled URL (the app would fail on
 * its first request), a missing direct URL (migrations would go through the pooler), an
 * unreadable URL, the pooled string set as the direct one, or two URLs on different
 * databases (a preview could migrate production). Each problem names the variable and
 * never the credentials.
 */
export function hostedDatabaseProblems(env: Env): string[] {
  if (!isHostedBuild(env)) return [];
  const where = `for VERCEL_ENV=${env.VERCEL_ENV}`;
  const problems: string[] = [];
  if (!env.DATABASE_URL) {
    problems.push(
      `DATABASE_URL is not set ${where}; set the pooled Neon string ${DEPLOY_STEP}`,
    );
  }
  if (!env.DATABASE_URL_UNPOOLED) {
    problems.push(
      `DATABASE_URL_UNPOOLED is not set ${where}; set the direct Neon string ${DEPLOY_STEP}`,
    );
  }
  if (env.DATABASE_URL && env.DATABASE_URL_UNPOOLED) {
    problems.push(
      ...urlPairProblems(env.DATABASE_URL, env.DATABASE_URL_UNPOOLED, where),
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
