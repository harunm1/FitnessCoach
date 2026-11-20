import { describe, expect, it } from "vitest";
import { canUseCoachChat, effectiveTier, PLAN_TIERS } from "./tier";

const now = new Date("2026-11-12T12:00:00Z");

describe("coach tier policy", () => {
  it.each([
    ["FREE", false],
    ["TRIAL", true],
    ["PRO", true],
    ["ADMIN", true],
  ] as const)("checks chat access for effective %s", (tier, allowed) => {
    expect(canUseCoachChat(tier)).toBe(allowed);
    expect(PLAN_TIERS).toContain(tier);
  });

  it.each([
    [new Date(now.getTime() + 1), "TRIAL"],
    [now, "FREE"],
    [new Date(now.getTime() - 1), "FREE"],
    [null, "FREE"],
    [new Date(NaN), "FREE"],
  ] as const)("rechecks trial expiry", (trialEndsAt, tier) => {
    const actual = effectiveTier({ tier: "TRIAL", trialEndsAt }, now);
    expect(actual).toBe(tier);
    expect(canUseCoachChat(actual)).toBe(tier === "TRIAL");
  });

  it.each([
    ["active", new Date(now.getTime() + 1), "PRO"],
    ["active", now, "FREE"],
    ["active", new Date(now.getTime() - 1), "FREE"],
    ["past_due", new Date(now.getTime() + 1000), "FREE"],
    [null, null, "FREE"],
  ] as const)(
    "checks paid access for %s billing",
    (status, paidUntil, tier) => {
      expect(
        effectiveTier(
          { tier: "PRO", trialEndsAt: null, billing: { status, paidUntil } },
          now,
        ),
      ).toBe(tier);
    },
  );

  it("does not trust a PRO label without billing evidence", () => {
    expect(effectiveTier({ tier: "PRO", trialEndsAt: null }, now)).toBe("FREE");
    expect(effectiveTier({ tier: "ADMIN", trialEndsAt: null }, now)).toBe(
      "ADMIN",
    );
  });

  it("retains the remaining trial if paid access ends", () => {
    expect(
      effectiveTier(
        { tier: "PRO", trialEndsAt: new Date(now.getTime() + 1000) },
        now,
      ),
    ).toBe("TRIAL");
  });
});
