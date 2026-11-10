import type { PrismaClient } from "@/generated/prisma/client";

// Operator-only bootstrap; never expose this function through an app action/API.
export async function grantAdmin(database: PrismaClient, email: string) {
  const result = await database.user.updateMany({
    where: {
      email,
      emailVerified: true,
      accounts: { some: { providerId: "credential", password: { not: null } } },
    },
    data: { tier: "ADMIN" },
  });
  if (result.count !== 1)
    throw new Error(
      "Register and verify a password account with this email first.",
    );
}
