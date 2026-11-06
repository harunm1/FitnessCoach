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
 * Production and preview deployments apply committed migrations before building, each
 * to its own Neon branch (Production- and Preview-scoped DATABASE_URL_UNPOOLED), so a
 * pull request that adds a migration is previewed against a migrated schema without
 * touching production. Local development and CI (no VERCEL_ENV) only build.
 * VERCEL_ENV is set at build time (Vercel docs, 5 Nov 2026).
 */
const MIGRATING_ENVS = new Set(["production", "preview"]);

export function buildSteps(env: Env): string[] {
  return MIGRATING_ENVS.has(env.VERCEL_ENV ?? "")
    ? ["prisma migrate deploy", "next build"]
    : ["next build"];
}
