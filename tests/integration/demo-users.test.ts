import { afterAll, afterEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { DEMO_USERS, seedLocalDemoUsers } from "../../prisma/demo-users";
import { createAuth } from "@/lib/auth/core";
import { resolveAccess } from "@/lib/auth/access-policy";
import { testDatabase } from "../helpers/database";
import { testDatabaseURL } from "../helpers/database-url";

const db = testDatabase();
const password = "Local-fixture-password-for-test-123!";
const emails = DEMO_USERS.map((user) => user.email);
const settings = () => ({
  password,
  databaseURL: testDatabaseURL(),
  environment: "test",
  now: new Date(),
});

afterEach(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } });
});
afterAll(async () => db.$disconnect());

describe("verified local demo logins", () => {
  it("creates all four tiers with working credentials and a local-only PRO entitlement", async () => {
    const options = settings();
    expect(await seedLocalDemoUsers(db, options)).toHaveLength(4);
    const auth = createAuth(
      db,
      {
        baseURL: "http://localhost:3000",
        secret: "demo-seed-integration-secret-at-least-32-characters",
      },
      async () => {},
    );
    for (const demo of DEMO_USERS) {
      const user = await db.user.findUniqueOrThrow({
        where: { email: demo.email },
        include: { accounts: true, billing: true },
      });
      expect(user).toMatchObject({ emailVerified: true, tier: demo.tier });
      const credential = user.accounts.find(
        (account) => account.providerId === "credential",
      )!;
      expect(credential.password).not.toBe(password);
      expect(
        await verifyPassword({ password, hash: credential.password! }),
      ).toBe(true);
      const response = await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({ email: demo.email, password }),
        }),
      );
      expect(response.status).toBe(200);
      expect(resolveAccess(user).effectiveTier).toBe(demo.tier);
      if (demo.tier === "TRIAL") {
        expect(user.trialEndsAt).toEqual(
          new Date(options.now.getTime() + 7 * 86400000),
        );
      }
      if (demo.tier === "PRO") {
        expect(user.billing?.stripeCustomerId).toMatch(/^cus_local_demo_/);
        expect(user.billing?.paidUntil).toEqual(
          new Date(options.now.getTime() + 30 * 86400000),
        );
      }
    }
  });

  it("preserves passwords, expired trial markers, billing deadlines and progress on reruns", async () => {
    const options = settings();
    await seedLocalDemoUsers(db, options);
    const trial = await db.user.findUniqueOrThrow({
      where: { email: DEMO_USERS[1].email },
      include: { accounts: true },
    });
    const originalBilling = await db.billingAccount.findFirstOrThrow({
      where: { user: { email: DEMO_USERS[2].email } },
    });
    const expiredAt = new Date(Date.now() - 86400000);
    const changedHash = await hashPassword("Changed-demo-password-for-test!");
    await db.user.update({
      where: { id: trial.id },
      data: { tier: "FREE", trialEndsAt: expiredAt },
    });
    await db.account.update({
      where: { id: trial.accounts[0].id },
      data: { password: changedHash },
    });
    const plan = await db.plan.create({
      data: { userId: trial.id, name: "Keep this plan", source: "DEFAULT" },
    });
    const workout = await db.workout.create({
      data: { userId: trial.id, planId: plan.id, notes: "Keep this workout" },
    });
    await seedLocalDemoUsers(db, {
      ...options,
      now: new Date(options.now.getTime() + 100 * 86400000),
    });
    expect(await db.user.count({ where: { email: { in: emails } } })).toBe(4);
    expect(
      await db.user.findUniqueOrThrow({ where: { id: trial.id } }),
    ).toMatchObject({ tier: "FREE", trialEndsAt: expiredAt });
    expect(
      (
        await db.account.findUniqueOrThrow({
          where: { id: trial.accounts[0].id },
        })
      ).password,
    ).toBe(changedHash);
    expect(await db.workout.findUnique({ where: { id: workout.id } })).toEqual(
      workout,
    );
    expect(
      await db.billingAccount.findUnique({
        where: { userId: originalBilling.userId },
      }),
    ).toEqual(originalBilling);
  });

  it("does not take over an existing unverified account or partially create fixtures", async () => {
    const original = await db.user.create({
      data: { name: "Existing account", email: DEMO_USERS[3].email },
    });
    await expect(seedLocalDemoUsers(db, settings())).rejects.toThrow(
      "already has an account without verified credentials",
    );
    expect(await db.user.count({ where: { email: { in: emails } } })).toBe(1);
    expect(await db.user.findUnique({ where: { id: original.id } })).toEqual(
      original,
    );
    expect(await db.account.count({ where: { userId: original.id } })).toBe(0);
  });
});
