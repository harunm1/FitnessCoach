import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { testDatabase } from "../helpers/database";

vi.mock("server-only", () => ({}));
import { claimCoachPlanRequest } from "@/lib/auth/plan-rate-limit";

const db = testDatabase();
const otherConnection = testDatabase();
const prefix = `coach-limit-${randomUUID()}`;
let sequence = 0;

function user(emailVerified = true) {
  return db.user.create({
    data: {
      name: "Coach test athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified,
    },
  });
}

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await Promise.all([db.$disconnect(), otherConnection.$disconnect()]);
});

describe("database-backed coach plan reservations", () => {
  it("admits the first request and keeps rejected retries from extending the cooldown", async () => {
    const account = await user();
    expect(account.lastCoachPlanRequestedAt).toBeNull();
    expect(await claimCoachPlanRequest(db, account.id)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const saved = await db.user.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(saved.lastCoachPlanRequestedAt).toBeInstanceOf(Date);
    for (let i = 0; i < 3; i++) {
      const retry = await claimCoachPlanRequest(db, account.id);
      expect(retry.allowed).toBe(false);
      expect(retry.retryAfterSeconds).toBeGreaterThan(0);
      expect(retry.retryAfterSeconds).toBeLessThanOrEqual(60);
      expect(retry).toHaveProperty(
        "message",
        expect.stringContaining(`${retry.retryAfterSeconds} `),
      );
    }
    const after = await db.user.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(after.lastCoachPlanRequestedAt).toEqual(
      saved.lastCoachPlanRequestedAt,
    );
    expect(after.tier).toBe(account.tier);
    expect(after.trialEndsAt).toBe(account.trialEndsAt);
  });

  it.each([false, true])(
    "admits one concurrent request, with an expired reservation: %s",
    async (expired) => {
      const account = await user();
      if (expired) {
        await db.$executeRaw(Prisma.sql`
        UPDATE "User" SET "lastCoachPlanRequestedAt" = timezone('UTC', clock_timestamp()) - interval '61 seconds'
        WHERE "id" = ${account.id}
      `);
      }
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          claimCoachPlanRequest(i % 2 ? db : otherConnection, account.id),
        ),
      );
      expect(results.filter((result) => result.allowed)).toHaveLength(1);
      expect(results.filter((result) => !result.allowed)).toHaveLength(9);
    },
  );

  it("allows another request after the persisted window expires", async () => {
    const account = await user();
    await db.$executeRaw(Prisma.sql`
      UPDATE "User" SET "lastCoachPlanRequestedAt" = timezone('UTC', clock_timestamp()) - interval '61 seconds'
      WHERE "id" = ${account.id}
    `);
    expect(await claimCoachPlanRequest(db, account.id)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("keeps users independent and does not rely on one process's memory", async () => {
    const first = await user();
    const second = await user();
    expect((await claimCoachPlanRequest(db, first.id)).allowed).toBe(true);
    expect(
      (await claimCoachPlanRequest(otherConnection, second.id)).allowed,
    ).toBe(true);
    expect(
      (await claimCoachPlanRequest(otherConnection, first.id)).allowed,
    ).toBe(false);
    expect((await claimCoachPlanRequest(db, second.id)).allowed).toBe(false);
  });

  it("does not give ADMIN an exemption from provider protection", async () => {
    const account = await user();
    await db.user.update({
      where: { id: account.id },
      data: { tier: "ADMIN" },
    });
    expect((await claimCoachPlanRequest(db, account.id)).allowed).toBe(true);
    expect((await claimCoachPlanRequest(db, account.id)).allowed).toBe(false);
  });

  it("rejects unverified and missing accounts without creating a reservation", async () => {
    const account = await user(false);
    await expect(claimCoachPlanRequest(db, account.id)).rejects.toThrow(
      "Account unavailable",
    );
    await expect(claimCoachPlanRequest(db, "missing-user")).rejects.toThrow(
      "Account unavailable",
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: account.id } }))
        .lastCoachPlanRequestedAt,
    ).toBeNull();
  });

  it("treats the owner ID as data and cannot reserve for another user", async () => {
    const victim = await user();
    await expect(claimCoachPlanRequest(db, "' OR true --")).rejects.toThrow(
      "Account unavailable",
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: victim.id } }))
        .lastCoachPlanRequestedAt,
    ).toBeNull();
  });
});
