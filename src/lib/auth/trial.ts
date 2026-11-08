import type { PrismaClient } from "@/generated/prisma/client";
import { TRIAL_DURATION_MS } from "./access-policy";

// Only call with an ID obtained from a verified server session, never form input.
export async function activateTrial(database: PrismaClient, userId: string) {
  const trialEndsAt = new Date(Date.now() + TRIAL_DURATION_MS);
  // A single conditional write prevents concurrent clicks from restarting or
  // extending a trial. Keep the date after expiry as the one-time-use marker.
  const result = await database.user.updateMany({
    where: { id: userId, emailVerified: true, tier: "FREE", trialEndsAt: null },
    data: { tier: "TRIAL", trialEndsAt },
  });
  return result.count === 1;
}
