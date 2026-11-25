// Read-only look at the demo user's latest rows, for the live demo (#162):
//   npx tsx --env-file=.env scripts/demo-db-peek.ts demo@example.com
// The presenter logs a set or uploads a photo in the app, runs this again, and the new
// row shows up with its time and (for a photo) its R2 key. SELECT only: see queries.ts.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseArgs } from "./demo-peek/args";
import { describeFailure } from "./demo-peek/failure";
import { formatPeek } from "./demo-peek/format";
import { NO_SUCH_USER, peekDemoUser } from "./demo-peek/queries";

// node and the script name come first in argv.
const ARGV_START = 2;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(ARGV_START), process.env);
  if ("usage" in args) {
    console.error(args.usage);
    process.exitCode = 1;
    return;
  }
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: args.url }),
  });
  try {
    const result = await peekDemoUser(db, args.email);
    if (result === NO_SUCH_USER) {
      console.error(formatPeek(result));
      process.exitCode = 1;
      return;
    }
    console.log(formatPeek(result, args.databaseName));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Name and code only: a connection error message can carry the host or the URL.
  console.error(describeFailure(error));
  process.exitCode = 1;
});
