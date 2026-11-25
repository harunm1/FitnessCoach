// Integration test for the workout history (D28) against a real PostgreSQL: each
// lookup returns only the signed-in user's finished workouts, so another user's
// workout or exercise reads as missing (the pages answer 404), and an open workout
// is not history yet.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});

import {
  loadExerciseHistory,
  loadHistoryPage,
  loadWorkoutDetail,
} from "@/lib/history/load";
import { prisma as db } from "@/lib/prisma";

const prefix = `history-${randomUUID()}`;
const exerciseId = `${prefix}-bench`;
let sequence = 0;

beforeAll(async () => {
  await db.exercise.create({
    data: {
      id: exerciseId,
      name: "History Bench",
      level: "BEGINNER",
      category: "strength",
      equipment: "barbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    },
  });
});

// Users go first: their workouts and sets are deleted with them.
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.exercise.deleteMany({ where: { id: exerciseId } });
  await db.$disconnect();
});

function athlete() {
  return db.user.create({
    data: {
      name: "History athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified: true,
    },
  });
}

function workout(userId: string, startedAt: string, finished = true) {
  const start = new Date(startedAt);
  return db.workout.create({
    data: {
      userId,
      startedAt: start,
      finishedAt: finished ? new Date(start.getTime() + 45 * 60000) : null,
      notes: "Felt strong",
      sets: {
        create: [
          { exerciseId, setNumber: 1, reps: 5, weightKg: 60, rpe: 8 },
          { exerciseId, setNumber: 2, reps: 5, weightKg: 62.5 },
        ],
      },
    },
  });
}

describe("workout history on PostgreSQL", () => {
  it("opens a workout for its owner and reads as missing for anyone else", async () => {
    const owner = await athlete();
    const other = await athlete();
    const mine = await workout(owner.id, "2026-11-08T17:00:00Z");

    const detail = await loadWorkoutDetail(owner.id, mine.id);
    expect(detail).toMatchObject({
      id: mine.id,
      minutes: 45,
      notes: "Felt strong",
      exercises: [
        {
          id: exerciseId,
          sets: [
            { setNumber: 1, reps: 5, weightKg: 60, rpe: 8 },
            { setNumber: 2, reps: 5, weightKg: 62.5, rpe: null },
          ],
        },
      ],
    });
    expect(await loadWorkoutDetail(other.id, mine.id)).toBeNull();
    expect(await loadExerciseHistory(other.id, exerciseId)).toBeNull();
    expect((await loadHistoryPage(other.id, 1)).rows).toEqual([]);
  });

  it("lists finished workouts newest first with their set counts, not open ones", async () => {
    const user = await athlete();
    const older = await workout(user.id, "2026-11-01T17:00:00Z");
    const newer = await workout(user.id, "2026-11-08T17:00:00Z");
    const open = await workout(user.id, "2026-11-09T17:00:00Z", false);

    const page = await loadHistoryPage(user.id, 1);
    expect(page.rows.map((row) => row.id)).toEqual([newer.id, older.id]);
    expect(page.rows[0]).toMatchObject({ sets: 2, minutes: 45 });
    expect(page.hasNext).toBe(false);
    expect(await loadWorkoutDetail(user.id, open.id)).toBeNull();

    const exercise = await loadExerciseHistory(user.id, exerciseId);
    expect(exercise?.workouts.map((entry) => entry.workoutId)).toEqual([
      newer.id,
      older.id,
    ]);
  });
});
