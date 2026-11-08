import { describe, expect, it, vi } from "vitest";
import { buildHybridWeek, type HybridProfile } from "./hybridWeek";
import type { PrismaClient } from "@/generated/prisma/client";
import { saveWeek, weekToPlanData } from "./saveWeek";
import type { CategorisedExercise } from "./defaultPlan";

const library: CategorisedExercise[] = [
  "quadriceps",
  "chest",
  "middle back",
  "shoulders",
  "triceps",
  "hamstrings",
  "glutes",
  "abdominals",
  "lats",
  "biceps",
].map((m) => ({
  id: m.replace(" ", "_"),
  category: "strength",
  equipment: "body only",
  primaryMuscles: [m],
  secondaryMuscles: [],
}));

const profile: HybridProfile = {
  daysPerWeek: 5,
  goal: "GENERAL_FITNESS",
  trainingMode: "BOTH",
  equipment: [],
  avoidMuscles: [],
  activityLevel: "ACTIVE",
  lastWeekKm: 20,
  easyPaceSecPerKm: 360,
};

type DayInput = {
  dayIndex: number;
  kind: string;
  exercises?: { create: { order: number }[] };
  run?: { create: { type: string; distanceKm: number } };
};

describe("weekToPlanData", () => {
  const week = buildHybridWeek(profile, library);
  const data = weekToPlanData("user-1", week, "DEFAULT");
  const days = (data.days as { create: DayInput[] }).create;

  it("makes one active plan for the user with every day in order", () => {
    expect(data).toMatchObject({
      userId: "user-1",
      name: week.name,
      source: "DEFAULT",
      active: true,
    });
    expect(days.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it("gives strength days ordered exercises and run days one run", () => {
    expect(days.map((d) => d.kind)).toEqual([
      "STRENGTH",
      "RUN",
      "STRENGTH",
      "RUN",
      "STRENGTH",
    ]);
    for (const d of days) {
      if (d.kind === "RUN") {
        expect(d.exercises).toBeUndefined();
        expect(d.run?.create.distanceKm).toBeGreaterThan(0);
      } else {
        expect(d.run).toBeUndefined();
        expect(d.exercises?.create.map((e) => e.order)).toEqual(
          d.exercises?.create.map((_, i) => i),
        );
      }
    }
    expect(days.at(-2)?.run?.create.type).toBe("LONG");
  });
});

describe("saveWeek", () => {
  // Under READ COMMITTED two concurrent saves could each deactivate the old plan and
  // both insert an active one; locking the user's row first makes them run in turn.
  function fakePrisma(failCreate = false) {
    const calls: string[] = [];
    const tx = {
      $queryRaw: vi.fn(async (sql: TemplateStringsArray) => {
        calls.push(`lock:${sql.join("?").replace(/\s+/g, " ").trim()}`);
        return [];
      }),
      plan: {
        updateMany: vi.fn(async () => {
          calls.push("deactivate");
          return { count: 1 };
        }),
        create: vi.fn(async () => {
          calls.push("create");
          if (failCreate) throw new Error("insert failed");
          return { id: 7 };
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { prisma: prisma as unknown as PrismaClient, calls, tx };
  }

  it("locks the user row, then deactivates, then creates, in one transaction", async () => {
    const { prisma, calls, tx } = fakePrisma();
    const week = buildHybridWeek(profile, library);
    await expect(saveWeek(prisma, "u1", week, "DEFAULT")).resolves.toEqual({
      planId: 7,
    });
    expect(calls).toEqual([
      'lock:SELECT id FROM "User" WHERE id = ? FOR UPDATE',
      "deactivate",
      "create",
    ]);
    // Only this user's row is locked and only this user's plans are touched.
    expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual(["u1"]);
    expect(tx.plan.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", active: true },
      data: { active: false },
    });
    expect(tx.plan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u1", active: true }),
      }),
    );
  });

  it("propagates an insert failure out of the transaction", async () => {
    const { prisma } = fakePrisma(true);
    const week = buildHybridWeek(profile, library);
    await expect(saveWeek(prisma, "u1", week, "DEFAULT")).rejects.toThrow(
      "insert failed",
    );
  });
});
