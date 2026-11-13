// The quiz action with a training mode (#85): both or running saves RUN days, strength stays as before.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabase } from "../helpers/database";

const db = testDatabase();
// The action imports the app's own client; point it at the test database.
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const DEMO_EMAIL = "demo@fitnesscoach.local";
const PREFIX = "fc85-";
const LIBRARY = [
  ["bench", "chest", "triceps"],
  ["squat", "quadriceps", "glutes"],
  ["row", "middle back", "biceps"],
  ["curl", "biceps", "forearms"],
  ["press", "shoulders", "triceps"],
  ["deadlift", "hamstrings", "glutes"],
] as const;

function quizForm(trainingMode?: string, daysPerWeek = "4") {
  const form = new FormData();
  form.set("goal", "GENERAL_FITNESS");
  form.set("level", "BEGINNER");
  form.set("daysPerWeek", daysPerWeek);
  form.append("equipment", "barbell");
  form.set("injuries", "");
  if (trainingMode) form.set("trainingMode", trainingMode);
  return form;
}

async function savedDays() {
  const user = await db.user.findUniqueOrThrow({
    where: { email: DEMO_EMAIL },
  });
  const plan = await db.plan.findFirstOrThrow({
    where: { userId: user.id, active: true },
    include: { days: { include: { run: true }, orderBy: { dayIndex: "asc" } } },
  });
  return plan.days;
}

async function submit(trainingMode?: string, daysPerWeek = "4") {
  const { saveQuizProfile } = await import("@/app/onboarding/actions");
  return saveQuizProfile(
    { status: "idle", message: "" },
    quizForm(trainingMode, daysPerWeek),
  );
}

beforeAll(async () => {
  await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { name: "Demo", email: DEMO_EMAIL, emailVerified: true },
  });
  for (const [slug, primary, secondary] of LIBRARY) {
    await db.exercise.create({
      data: {
        id: `${PREFIX}${slug}`,
        name: slug,
        level: "BEGINNER",
        equipment: "barbell",
        category: "strength",
        primaryMuscles: [primary],
        secondaryMuscles: [secondary],
        instructions: [],
        images: [],
        cues: [],
        commonMistakes: [],
      },
    });
  }
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: DEMO_EMAIL } });
  await db.exercise.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await db.$disconnect();
});

describe("saveQuizProfile with a training mode", () => {
  it("saves at least one RUN day for a both-mode quiz, with its PlanRun", async () => {
    const result = await submit("BOTH");

    expect(result.status).toBe("success");
    const days = await savedDays();
    const runs = days.filter((day) => day.kind === "RUN");
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs.every((day) => day.run !== null)).toBe(true);
    expect(days.some((day) => day.kind === "STRENGTH")).toBe(true);
  });

  it("saves RUN days and strength support for a running-only quiz", async () => {
    const result = await submit("RUNNING");

    expect(result.status).toBe("success");
    const days = await savedDays();
    // Four days running-only: two strength days for injury prevention, two runs.
    expect(days.filter((day) => day.kind === "RUN")).toHaveLength(2);
    expect(days.filter((day) => day.kind === "STRENGTH")).toHaveLength(2);
  });

  it("stores the training mode on the profile", async () => {
    await submit("BOTH");
    const user = await db.user.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
    });

    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: user.id } }))
        .trainingMode,
    ).toBe("BOTH");
  });

  it("saves a single run day for a running-only quiz of one day", async () => {
    const result = await submit("RUNNING", "1");

    expect(result.status).toBe("success");
    const days = await savedDays();
    expect(days.map((day) => day.kind)).toEqual(["RUN"]);
  });

  it("leaves the profile unchanged when the plan cannot be saved", async () => {
    await submit("GYM");
    const user = await db.user.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
    });
    const { saveWeek } = await import("@/lib/coach/saveWeek");
    const brokenWeek = {
      name: "broken",
      days: [
        {
          kind: "STRENGTH" as const,
          name: "Day",
          exercises: [
            {
              exerciseId: "no-such-exercise",
              sets: 3,
              reps: 10,
              restSeconds: 60,
            },
          ],
        },
      ],
    };

    await expect(
      saveWeek(db, user.id, brokenWeek, "DEFAULT", async (tx) => {
        await tx.profile.update({
          where: { userId: user.id },
          data: { trainingMode: "RUNNING" },
        });
      }),
    ).rejects.toThrow();

    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: user.id } }))
        .trainingMode,
    ).toBe("GYM");
  });

  it("keeps a strength-only quiz exactly as before: only strength days", async () => {
    const result = await submit("GYM");

    expect(result.status).toBe("success");
    const days = await savedDays();
    expect(days).toHaveLength(4);
    expect(days.every((day) => day.kind === "STRENGTH")).toBe(true);
    expect(days.map((day) => day.name)).toEqual([
      "Push",
      "Pull",
      "Legs",
      "Push",
    ]);
  });

  it("treats a quiz with no training mode answer as strength", async () => {
    const result = await submit(undefined);

    expect(result.status).toBe("success");
    expect((await savedDays()).every((day) => day.kind === "STRENGTH")).toBe(
      true,
    );
  });

  it("keeps exactly one active plan after repeated submissions", async () => {
    await submit("BOTH");
    await submit("RUNNING");
    const user = await db.user.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
    });

    expect(
      await db.plan.count({ where: { userId: user.id, active: true } }),
    ).toBe(1);
  });
});
