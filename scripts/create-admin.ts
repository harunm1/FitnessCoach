import "dotenv/config";
import { parseArgs } from "node:util";
import { z } from "zod";
import { grantAdmin } from "../src/lib/auth/admin";

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, confirm: { type: "boolean" } },
  });
  const email = z.email().parse(values.email?.trim().toLowerCase());
  if (!values.confirm)
    throw new Error("Pass --confirm to grant admin access to this account.");
  const { prisma } = await import("../src/lib/prisma");
  try {
    await grantAdmin(prisma, email);
    console.log("Admin access granted to the verified account.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin setup failed.");
  process.exitCode = 1;
});
