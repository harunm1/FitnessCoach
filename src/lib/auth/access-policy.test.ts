import { describe, expect, it } from "vitest";
import { resolveAccess } from "./access-policy";

const now = new Date("2026-11-03T12:00:00Z");

describe("account permissions", () => {
  it("lets a new FREE account start a trial without coach or admin access", () => {
    expect(
      resolveAccess({ tier: "FREE", trialEndsAt: null }, now),
    ).toMatchObject({
      effectiveTier: "FREE",
      canStartTrial: true,
      permissions: ["quiz", "default-plan", "tracking"],
    });
  });

  it.each([
    ["before expiry", new Date(now.getTime() + 1), "TRIAL", true],
    ["at expiry", now, "FREE", false],
    ["after expiry", new Date(now.getTime() - 1), "FREE", false],
    ["without an expiry", null, "FREE", false],
    ["with an invalid expiry", new Date(NaN), "FREE", false],
  ] as const)(
    "handles a trial %s",
    (_label, trialEndsAt, effectiveTier, coach) => {
      const access = resolveAccess({ tier: "TRIAL", trialEndsAt }, now);
      expect(access.effectiveTier).toBe(effectiveTier);
      expect(access.permissions.includes("coach")).toBe(coach);
      expect(access.permissions).not.toContain("manage-content");
      expect(access.canStartTrial).toBe(false);
    },
  );

  it("does not offer another trial after downgrade to FREE", () => {
    expect(
      resolveAccess({ tier: "FREE", trialEndsAt: now }, now).canStartTrial,
    ).toBe(false);
  });

  it("keeps paid PRO access regardless of an old trial date", () => {
    const access = resolveAccess(
      {
        tier: "PRO",
        trialEndsAt: now,
        billing: {
          status: "active",
          paidUntil: new Date(now.getTime() + 1000),
        },
      },
      now,
    );
    expect(access.effectiveTier).toBe("PRO");
    expect(access.permissions).toContain("coach");
    expect(access.permissions).not.toContain("manage-content");
    expect(access.canStartTrial).toBe(false);
  });

  it("gives ADMIN coach and content access without a trial", () => {
    const access = resolveAccess({ tier: "ADMIN", trialEndsAt: null }, now);
    expect(access.permissions).toContain("coach");
    expect(access.permissions).toContain("manage-content");
    expect(access.canStartTrial).toBe(false);
  });
});

it.each([
  null,
  { status: "active", paidUntil: now },
  { status: "past_due", paidUntil: new Date(now.getTime() + 1000) },
])("denies unverified or expired paid access", (billing) => {
  expect(
    resolveAccess({ tier: "PRO", trialEndsAt: null, billing }, now)
      .effectiveTier,
  ).toBe("FREE");
  expect(
    resolveAccess(
      { tier: "PRO", trialEndsAt: new Date(now.getTime() + 1000), billing },
      now,
    ).effectiveTier,
  ).toBe("TRIAL");
});
