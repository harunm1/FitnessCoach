import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import { passwordSchema } from "../src/lib/auth/validation";

export const DEMO_USERS = [
  { email: "demo-free@fitnesscoach.local", name: "Free Demo", tier: "FREE" },
  { email: "demo-trial@fitnesscoach.local", name: "Trial Demo", tier: "TRIAL" },
  { email: "demo-pro@fitnesscoach.local", name: "Pro Demo", tier: "PRO" },
  { email: "demo-admin@fitnesscoach.local", name: "Admin Demo", tier: "ADMIN" },
] as const;

type DemoSeedOptions = {
  password?: string;
  databaseURL?: string;
  environment?: string;
  now?: Date;
};

class DemoAccountConflict extends Error {}

// These verified logins and the synthetic PRO record are local development fixtures.
export async function seedLocalDemoUsers(
  database: PrismaClient,
  options: DemoSeedOptions,
) {
  if (!options.password) return [];
  let localDatabase = false;
  try {
    const url = new URL(options.databaseURL ?? "");
    localDatabase =
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    // Report configuration without printing a connection string or password.
  }
  if (
    process.env.NODE_ENV === "production" ||
    options.environment === "production" ||
    !localDatabase
  ) {
    throw new Error(
      "DEMO_PASSWORD is only supported outside production on a localhost PostgreSQL database.",
    );
  }
  if (!passwordSchema.safeParse(options.password).success) {
    throw new Error("DEMO_PASSWORD must contain 12–128 characters.");
  }

  const passwordHash = await hashPassword(options.password);
  const now = options.now ?? new Date();
  const day = 24 * 60 * 60 * 1000;

  return database
    .$transaction(async (tx) => {
      const users = [];
      for (const demo of DEMO_USERS) {
        const existing = await tx.user.findUnique({
          where: { email: demo.email },
          include: {
            accounts: { where: { providerId: "credential" } },
          },
        });
        if (existing) {
          if (
            !existing.emailVerified ||
            !existing.accounts.some((a) => a.password)
          ) {
            throw new DemoAccountConflict(
              `The reserved demo address ${demo.email} already has an account without verified credentials. It was not changed.`,
            );
          }
          // Rerunning the seed must not reset passwords, trials, payments or progress.
          users.push({ email: existing.email, tier: existing.tier });
          continue;
        }

        const id = randomUUID();
        const user = await tx.user.create({
          data: {
            id,
            ...demo,
            emailVerified: true,
            trialEndsAt:
              demo.tier === "TRIAL" ? new Date(now.getTime() + 7 * day) : null,
            accounts: {
              create: {
                accountId: id,
                providerId: "credential",
                password: passwordHash,
              },
            },
            profile: {
              create: {
                goal: "MUSCLE",
                level: "BEGINNER",
                daysPerWeek: 3,
                equipment: ["barbell", "dumbbell", "body only"],
              },
            },
            ...(demo.tier === "PRO" && {
              billing: {
                create: {
                  stripeCustomerId: `cus_local_demo_${id}`,
                  stripeSubscriptionId: `sub_local_demo_${id}`,
                  status: "active",
                  paidUntil: new Date(now.getTime() + 30 * day),
                  lastSyncedAt: now,
                },
              },
            }),
          },
        });
        users.push({ email: user.email, tier: user.tier });
      }
      return users;
    })
    .catch((error: unknown) => {
      if (error instanceof DemoAccountConflict) throw error;
      throw new Error(
        "Could not create local demo accounts. Apply the committed migrations and check the database connection.",
      );
    });
}
