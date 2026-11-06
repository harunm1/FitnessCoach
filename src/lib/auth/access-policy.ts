import type { Tier } from "@/generated/prisma/enums";

export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type Permission =
  "quiz" | "default-plan" | "tracking" | "coach" | "manage-content";

export type AccountTier = { tier: Tier; trialEndsAt: Date | null };

// Recompute on every protected request. Expiry never depends on a scheduled job.
export function resolveAccess(account: AccountTier, now = new Date()) {
  const activeTrial =
    account.tier === "TRIAL" &&
    account.trialEndsAt !== null &&
    account.trialEndsAt.getTime() > now.getTime();
  const effectiveTier: Tier =
    account.tier === "TRIAL" && !activeTrial ? "FREE" : account.tier;
  const permissions: Permission[] = ["quiz", "default-plan", "tracking"];
  if (["TRIAL", "PRO", "ADMIN"].includes(effectiveTier))
    permissions.push("coach");
  if (effectiveTier === "ADMIN") permissions.push("manage-content");

  return {
    effectiveTier,
    activeTrial,
    canStartTrial: account.tier === "FREE" && account.trialEndsAt === null,
    trialEndsAt: account.trialEndsAt,
    permissions,
  };
}

export type AccountAccess = ReturnType<typeof resolveAccess>;
