// Integration test for the coach's tools (D43) against a real PostgreSQL: the prompt built for
// one user holds that user's import count and weight trend, and nothing of another user who
// has more imports, a different lift and other weigh-ins. Invented data only.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabase } from "../helpers/database";
import { buildCoachSystemPrompt } from "@/lib/coach/chat";
import { coachContextFor } from "@/lib/coach/conversation";

const db = testDatabase();
const prefix = `coach-tools-${randomUUID()}`;
const NOW = new Date("2026-11-26T17:00:00Z");
const DAY_MS = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

const ownerLift = `${prefix}-owner-bench`;
const otherLift = `${prefix}-other-sled`;
let ownerId = "";
let otherId = "";

async function athlete(label: string) {
  const user = await db.user.create({
    data: {
      name: `Coach tools ${label}`,
      email: `${prefix}-${label}@example.test`,
      emailVerified: true,
      weightUnit: "KG",
    },
  });
  await db.profile.create({
    data: {
      userId: user.id,
      goal: "MUSCLE",
      level: "INTERMEDIATE",
      daysPerWeek: 3,
      equipment: ["barbell"],
    },
  });
  return user.id;
}

async function workout(
  userId: string,
  exerciseId: string,
  daysAgo: number,
  source: string,
  weightKg: number,
) {
  await db.workout.create({
    data: {
      userId,
      source,
      importKey: source === "hevy-import" ? `${prefix}-${randomUUID()}` : null,
      startedAt: ago(daysAgo),
      finishedAt: ago(daysAgo),
      activeSince: null,
      sets: {
        create: [{ exerciseId, setNumber: 1, reps: 5, weightKg }],
      },
    },
  });
}

beforeAll(async () => {
  await db.exercise.createMany({
    data: [
      [ownerLift, `${prefix} Owner Bench`],
      [otherLift, `${prefix} Other Sled Push`],
    ].map(([id, name]) => ({
      id,
      name,
      level: "BEGINNER",
      category: "strength",
      equipment: "barbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    })),
  });
  ownerId = await athlete("owner");
  otherId = await athlete("other");

  // Owner: two imported workouts and one logged in the app; weight 84.2 to 81 kg.
  await workout(ownerId, ownerLift, 20, "hevy-import", 80);
  await workout(ownerId, ownerLift, 13, "hevy-import", 80);
  await workout(ownerId, ownerLift, 6, "live", 82.5);
  await db.bodyWeight.createMany({
    data: [
      { userId: ownerId, date: new Date("2026-09-01"), weightKg: 84.2 },
      { userId: ownerId, date: new Date("2026-11-24"), weightKg: 81 },
    ],
  });

  // Other: five imported workouts with a lift the owner never did, and much heavier weigh-ins.
  await Promise.all(
    [3, 5, 9, 11, 15].map((days) =>
      workout(otherId, otherLift, days, "hevy-import", 140),
    ),
  );
  await db.bodyWeight.createMany({
    data: [
      { userId: otherId, date: new Date("2026-10-01"), weightKg: 131.5 },
      { userId: otherId, date: new Date("2026-11-25"), weightKg: 127.25 },
    ],
  });
});

// Users go first: workouts, sets, weigh-ins and profiles are deleted with them.
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.exercise.deleteMany({
    where: { id: { in: [ownerLift, otherLift] } },
  });
  await db.$disconnect();
});

describe("coach tools against PostgreSQL (D43)", () => {
  it("builds the owner's prompt from the owner's rows only", async () => {
    const context = await coachContextFor(db, ownerId, NOW);
    if (!context) throw new Error("the owner has a profile");
    const prompt = buildCoachSystemPrompt(context);

    expect(prompt).toContain(
      "- Finished workouts: 3 (2 imported from Hevy, 1 logged in the app), 0.8 a week.",
    );
    expect(prompt).toMatch(/- Imported from Hevy, all time: 2 workouts, /);
    expect(prompt).toContain(
      "- Change: -3.2 kg over 84 days, -0.27 kg a week.",
    );
    expect(prompt).toContain(`${prefix} Owner Bench 82.5 kg x 5`);

    expect(prompt).not.toContain("Other Sled Push");
    expect(prompt).not.toMatch(/\b(140|131\.5|127\.25)\b/);
    expect(prompt).not.toContain("5 workouts");
  });

  it("builds the other user's prompt without the owner's rows", async () => {
    const context = await coachContextFor(db, otherId, NOW);
    if (!context) throw new Error("the other user has a profile");
    const prompt = buildCoachSystemPrompt(context);

    expect(prompt).toMatch(/- Imported from Hevy, all time: 5 workouts, /);
    expect(prompt).not.toContain("Owner Bench");
    expect(prompt).not.toMatch(/\b(84\.2|82\.5)\b/);
  });
});
