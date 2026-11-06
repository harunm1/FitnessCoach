// Release rules for the hosted preview (#57, docs/ARCHITECTURE.md D15): which URL the
// Prisma CLI uses, and which steps a Vercel build runs.

type Env = Record<string, string | undefined>;

/**
 * The Prisma CLI needs a direct connection for schema changes; the app uses the pooled
 * one (Neon's Prisma guide, checked 5 Nov 2026). Locally only DATABASE_URL is set.
 */
export function cliDatabaseUrl(env: Env): string | undefined {
  return env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
}

/**
 * Production deployments apply committed migrations before building. Preview
 * deployments of pull requests only build, so an unmerged migration never reaches
 * the shared database. VERCEL_ENV is set at build time (Vercel docs, 5 Nov 2026).
 */
export function buildSteps(env: Env): string[] {
  return env.VERCEL_ENV === "production"
    ? ["prisma migrate deploy", "next build"]
    : ["next build"];
}
