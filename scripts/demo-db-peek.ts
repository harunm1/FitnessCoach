// Read-only look at the demo user's latest rows, for the live demo (#162):
//   npx tsx --env-file=.env scripts/demo-db-peek.ts demo@example.com
// The presenter logs a set or uploads a photo in the app, runs this again, and the new
// row shows up with its time and (for a photo) its R2 key. SELECT only: see queries.ts.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { formatPeek } from "./demo-peek/format";
import { peekDemoUser } from "./demo-peek/queries";

async function main(): Promise<void> {
  const email = process.argv[2] ?? process.env.DEMO_PEEK_EMAIL;
  const url = process.env.DATABASE_URL;
  if (!email || !url) {
    console.error(
      "Usage: npx tsx --env-file=.env scripts/demo-db-peek.ts <email>\n" +
        "Needs DATABASE_URL (from .env or the environment).",
    );
    process.exitCode = 1;
    return;
  }
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    console.log(formatPeek(await peekDemoUser(db, email)));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  // The message only: a connection error can carry the connection string.
  console.error(
    "Peek failed:",
    error instanceof Error ? error.message.split("\n")[0] : "unknown error",
  );
  process.exitCode = 1;
});
