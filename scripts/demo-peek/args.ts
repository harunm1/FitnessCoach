// Reads the email and the database URL for scripts/demo-db-peek.ts (#162). Only the
// database name of the URL is passed on, so the printout can say which database it read.
export type PeekArgs = { email: string; url: string; databaseName: string };
export type PeekUsage = { usage: string };

const USAGE =
  "Usage: npx tsx --env-file=.env scripts/demo-db-peek.ts <email>\n" +
  "Needs DATABASE_URL (from the environment file or the shell).";

function databaseNameOf(url: string): string {
  try {
    // The path is "/name"; drop the leading slash.
    return new URL(url).pathname.slice(1) || "(default)";
  } catch {
    return "(unknown)";
  }
}

export function parseArgs(
  argv: string[],
  env: Record<string, string | undefined>,
): PeekArgs | PeekUsage {
  const email = argv[0] ?? env.DEMO_PEEK_EMAIL;
  const url = env.DATABASE_URL;
  if (!email || !url) return { usage: USAGE };
  return { email, url, databaseName: databaseNameOf(url) };
}
