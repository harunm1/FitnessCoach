// Integration test (#79): the onboarding Server Action saves a profile and one active plan
// for the seeded demo user in the migrated, seeded _test PostgreSQL database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { testDatabaseURL } from "../helpers/database-url";

const demoEmail = "demo@fitnesscoach.local";
const idle = { status: "idle", message: "" } as const;

let prisma: PrismaClient;
let saveQuizProfile: typeof import("@/app/onboarding/actions").saveQuizProfile;

beforeAll(async () => {
  // The action uses the app's client, which reads DATABASE_URL when first imported.
  // Point it at the guarded _test database before that import, never the dev one.
  process.env.DATABASE_URL = testDatabaseURL();
  ({ prisma } = await import("@/lib/prisma"));
  ({ saveQuizProfile } = await import("@/app/onboarding/actions"));
});

afterAll(async () => {
  await prisma?.$disconnect();
});

function quizForm(answers: {
  goal: string;
  level: string;
  daysPerWeek: number;
  equipment: string[];
}) {
  const form = new FormData();
  form.set("goal", answers.goal);
  form.set("level", answers.level);
  form.set("daysPerWeek", String(answers.daysPerWeek));
  for (const item of answers.equipment) form.append("equipment", item);
  form.set("injuries", "");
  return form;
}

describe("saveQuizProfile against PostgreSQL", () => {
  it("saves the demo user's profile and replaces the active plan on a second save", async () => {
    const { id: userId } = await prisma.user.findUniqueOrThrow({
      where: { email: demoEmail },
      select: { id: true },
    });

    // Different answers per save, so what is stored can only come from the second one.
    const first = await saveQuizProfile(
      idle,
      quizForm({
        goal: "MUSCLE",
        level: "BEGINNER",
        daysPerWeek: 3,
        equipment: ["body only"],
      }),
    );
    expect(first.status).toBe("success");
    const [firstPlan] = await prisma.plan.findMany({
      where: { userId, active: true },
    });

    const second = await saveQuizProfile(
      idle,
      quizForm({
        goal: "STRENGTH",
        level: "INTERMEDIATE",
        daysPerWeek: 4,
        equipment: ["dumbbell", "body only"],
      }),
    );
    expect(second.status).toBe("success");

    const profile = await prisma.profile.findUniqueOrThrow({
      where: { userId },
    });
    expect(profile).toMatchObject({
      goal: "STRENGTH",
      level: "INTERMEDIATE",
      daysPerWeek: 4,
      equipment: ["dumbbell", "body only"],
      injuries: null,
    });

    const active = await prisma.plan.findMany({
      where: { userId, active: true },
      include: { days: { include: { exercises: true } } },
    });
    expect(active).toHaveLength(1);
    expect(active[0]?.id).not.toBe(firstPlan?.id);
    expect(active[0]?.source).toBe("DEFAULT");
    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: firstPlan!.id } }),
    ).resolves.toMatchObject({ active: false });

    expect(active[0]?.days).toHaveLength(4);
    for (const day of active[0]?.days ?? []) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(2);
    }
  });
});
