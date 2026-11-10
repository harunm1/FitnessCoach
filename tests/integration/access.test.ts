import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { activateTrial } from "@/lib/auth/trial";
import { grantAdmin } from "@/lib/auth/admin";
import { resolveAccess, TRIAL_DURATION_MS } from "@/lib/auth/access-policy";
import type { Tier } from "@/generated/prisma/enums";
import { testDatabase } from "../helpers/database";

const db = testDatabase();
const prefix = `access-${randomUUID()}`;
let sequence = 0;
async function user(
  tier: Tier = "FREE",
  trialEndsAt: Date | null = null,
  emailVerified = true,
) {
  return db.user.create({
    data: {
      name: "Access Athlete",
      email: `${prefix}-${sequence++}@example.test`,
      tier,
      trialEndsAt,
      emailVerified,
    },
  });
}

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.$disconnect();
});

describe("trial activation with PostgreSQL", () => {
  it("starts exactly seven days from the user's activation", async () => {
    const account = await user();
    const before = Date.now();
    expect(await activateTrial(db, account.id)).toBe(true);
    const after = Date.now();
    const saved = await db.user.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(saved.tier).toBe("TRIAL");
    expect(saved.trialEndsAt!.getTime()).toBeGreaterThanOrEqual(
      before + TRIAL_DURATION_MS,
    );
    expect(saved.trialEndsAt!.getTime()).toBeLessThanOrEqual(
      after + TRIAL_DURATION_MS,
    );
    expect(resolveAccess(saved).permissions).toContain("coach");
  });

  it("allows only one concurrent activation and never extends the expiry", async () => {
    const account = await user();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => activateTrial(db, account.id)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const original = await db.user.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(await activateTrial(db, account.id)).toBe(false);
    const saved = await db.user.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(saved.trialEndsAt).toEqual(original.trialEndsAt);
  });

  it.each(["TRIAL", "PRO", "ADMIN"] as const)(
    "does not overwrite an existing %s tier",
    async (tier) => {
      const account = await user(tier);
      expect(await activateTrial(db, account.id)).toBe(false);
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: account.id } })).tier,
      ).toBe(tier);
    },
  );

  it("denies an expired trial and preserves its use marker after downgrade", async () => {
    const past = new Date(Date.now() - 1000);
    const account = await user("TRIAL", past);
    expect(resolveAccess(account).effectiveTier).toBe("FREE");
    expect(await activateTrial(db, account.id)).toBe(false);
    await db.user.update({ where: { id: account.id }, data: { tier: "FREE" } });
    expect(await activateTrial(db, account.id)).toBe(false);
  });

  it("does not start for an unverified or missing account or touch another user", async () => {
    const unverified = await user("FREE", null, false);
    const other = await user();
    expect(await activateTrial(db, unverified.id)).toBe(false);
    expect(await activateTrial(db, "missing-user")).toBe(false);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: other.id } })).tier,
    ).toBe("FREE");
  });
});

describe("operator admin bootstrap", () => {
  it("rejects unverified and seeded accounts without credentials", async () => {
    const unverified = await user("FREE", null, false);
    const noCredential = await user();
    for (const account of [unverified, noCredential]) {
      await expect(grantAdmin(db, account.email)).rejects.toThrow(
        "Register and verify",
      );
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: account.id } })).tier,
      ).toBe("FREE");
    }
  });

  it("promotes only the selected verified credential account and is repeatable", async () => {
    const account = await user();
    const other = await user();
    await db.account.create({
      data: {
        accountId: account.id,
        providerId: "credential",
        userId: account.id,
        password: "test-fixture-not-a-login-hash",
      },
    });
    await grantAdmin(db, account.email);
    await grantAdmin(db, account.email);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: account.id } })).tier,
    ).toBe("ADMIN");
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: other.id } })).tier,
    ).toBe("FREE");
  });
});
