// Release rules for the hosted preview (#57, docs/ARCHITECTURE.md D19): which URL the
// Prisma CLI uses, which steps a Vercel build runs, and what it checks first.

type Env = Record<string, string | undefined>;

// Production and preview deployments migrate; VERCEL_ENV is set at build and run time
// (Vercel system environment variables, checked 10 Nov 2026).
const MIGRATING_ENVS = new Set(["production", "preview"]);

function isHostedBuild(env: Env): boolean {
  return MIGRATING_ENVS.has(env.VERCEL_ENV ?? "");
}

/**
 * VERCEL and VERCEL_ENV are both system environment variables (Vercel docs, checked
 * 13 Nov 2026), so a project with that setting off shows neither, and a build would
 * skip migrations without a word. scripts/vercel-build.ts runs only as the Vercel build
 * command and in CI, which sets VERCEL_ENV=preview, so it stops whenever VERCEL_ENV is
 * not one that migrates and names the setting. Local builds use `npm run build`.
 */
export function vercelEnvProblem(env: Env): string | undefined {
  if (isHostedBuild(env)) return undefined;
  return 'VERCEL_ENV is not production or preview; turn on "Enable access to System Environment Variables" in the Vercel project (README, Deploy step 5), or build locally with npm run build';
}

/**
 * The Prisma CLI needs a direct connection for schema changes; the app uses the pooled
 * one (Neon's Prisma guide, checked 5 Nov 2026). The direct URL counts only on a hosted
 * build: locally, scripts/migrate-test.ts points the CLI at the test database through
 * testMigrationEnv, and a Neon string left in the shell or .env must not redirect it.
 */
export function cliDatabaseUrl(env: Env): string | undefined {
  if (isHostedBuild(env) && env.DATABASE_URL_UNPOOLED) {
    return env.DATABASE_URL_UNPOOLED;
  }
  return env.DATABASE_URL;
}

/**
 * The environment for `npm run db:migrate:test`: DATABASE_URL is the test database and
 * the hosted-build variables are blanked, so cliDatabaseUrl returns the test database
 * whatever the shell holds. Blank, not deleted: dotenv (prisma.config.ts) fills only
 * keys that are absent, so a value in .env cannot come back. Returns a copy of the
 * same type, so process.env can be passed to spawnSync.
 */
export function testMigrationEnv<E extends Env>(
  env: E,
  testDatabaseUrl: string,
): E {
  return {
    ...env,
    VERCEL: "",
    VERCEL_ENV: "",
    DATABASE_URL: testDatabaseUrl,
    DATABASE_URL_UNPOOLED: "",
  };
}

function parseUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

/**
 * "host/database" for a log line; never the user name or password. An unencoded "/" in
 * a password makes the parser read the user part as the host and leaves the rest, with
 * its "@", in the path, so such a URL is reported as unreadable.
 */
export function databaseTarget(url: string): string {
  const parsed = parseUrl(url);
  if (!parsed || parsed.pathname.includes("@")) return "an unreadable URL";
  return `${parsed.host}${parsed.pathname}`;
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
