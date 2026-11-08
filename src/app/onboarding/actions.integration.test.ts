// Integration test (#79): the onboarding Server Action saves a profile and one active plan
// for the seeded demo user in a real, migrated PostgreSQL database.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveQuizProfile } from "./actions";

const demoEmail = "demo@fitnesscoach.local";

function quizForm() {
  const form = new FormData();
  form.set("goal", "STRENGTH");
  form.set("level", "INTERMEDIATE");
  form.set("daysPerWeek", "4");
  form.append("equipment", "dumbbell");
  form.append("equipment", "body only");
  form.set("injuries", "");
  return form;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("saveQuizProfile against PostgreSQL", () => {
  it("saves the demo user's profile and exactly one active plan", async () => {
    // Run twice: the second save must replace the active plan, not add a second one.
    await saveQuizProfile({ status: "idle", message: "" }, quizForm());
    const result = await saveQuizProfile(
      { status: "idle", message: "" },
      quizForm(),
    );

    expect(result.status).toBe("success");
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: demoEmail },
      include: {
        profile: true,
        plans: {
          where: { active: true },
          include: { days: { include: { exercises: true } } },
        },
      },
    });
    expect(user.profile).toMatchObject({
      goal: "STRENGTH",
      level: "INTERMEDIATE",
      daysPerWeek: 4,
      equipment: ["dumbbell", "body only"],
      injuries: null,
    });
    expect(user.plans).toHaveLength(1);
    expect(user.plans[0]?.source).toBe("DEFAULT");
    expect(user.plans[0]?.days).toHaveLength(4);
    for (const day of user.plans[0]?.days ?? []) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(2);
    }
  });
});
