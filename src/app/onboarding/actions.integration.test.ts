// Integration test (#79): the onboarding Server Action saves a profile and one active plan
// for the seeded demo user in a real, migrated PostgreSQL database.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveQuizProfile } from "./actions";

const demoEmail = "demo@fitnesscoach.local";
const idle = { status: "idle", message: "" } as const;

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

function activePlans(userId: string) {
  return prisma.plan.findMany({ where: { userId, active: true } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

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
    const [firstPlan] = await activePlans(userId);

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
