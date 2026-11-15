import type { Tier } from "@/generated/prisma/enums";
import { resolveAccess, type AccountTier } from "./access-policy";

export const COACH_TIERS: readonly Tier[] = ["TRIAL", "PRO", "ADMIN"];
export const PLAN_TIERS: readonly Tier[] = ["FREE", "TRIAL", "PRO", "ADMIN"];

export function effectiveTier(user: AccountTier, now = new Date()): Tier {
  return resolveAccess(user, now).effectiveTier;
}

// Use the effective tier, after checking current trial and billing expiry.
export function canUseCoachChat(tier: Tier): boolean {
  return COACH_TIERS.includes(tier);
}
