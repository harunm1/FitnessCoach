// Runs the dedupe data migration (#76) on duplicates and checks what it keeps, closes and deletes, inside a transaction that is rolled back.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { testDatabase } from "../helpers/database";

const MIGRATIONS = "prisma/migrations";
const DEDUPE = `${MIGRATIONS}/20261110220112_keep_one_active_plan_and_open_workout/migration.sql`;
const UNIQUES = `${MIGRATIONS}/20261110220243_one_active_plan_one_open_workout/migration.sql`;
const ROLLBACK = "roll back the dedupe test";
const TRANSACTION_TIMEOUT_MS = 15_000;
const HOUR_MS = 3_600_000;
const LOGGED_REPS = 8;
const LOGGED_DURATION_SECONDS = 1200;
// How long ago each fixture row was created, oldest first.
const WITHOUT_PLAN_AGE_HOURS = 6;
const OLDER_PLAN_AGE_HOURS = 48;
const NEWER_PLAN_AGE_HOURS = 24;
const EMPTY_AGE_HOURS = 5;
const WITH_SET_AGE_HOURS = 4;
const WITH_TIME_AGE_HOURS = 3;
const WITH_NOTES_AGE_HOURS = 2;
const NEWEST_AGE_HOURS = 1;

const db = testDatabase();
const prefix = `dedupe-${randomUUID()}`;
const exerciseId = `${prefix}-squat`;

beforeAll(async () => {
  await db.exercise.create({
    data: {
      id: exerciseId,
      name: exerciseId,
      level: "BEGINNER",
      category: "strength",
      primaryMuscles: [],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    },
  });
});

afterAll(async () => {
  await db.exercise.deleteMany({ where: { id: exerciseId } });
  await db.$disconnect();
});

// The statements of a migration file, without comment lines, one per array entry.
function statements(path: string) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function run(
  tx: Prisma.TransactionClient,
  path: string,
  keep: (statement: string) => boolean = () => true,
) {
  await statements(path)
    .filter(keep)
    .reduce(
      (previous, statement) =>
        previous.then(() => tx.$executeRawUnsafe(statement)),
      Promise.resolve(0),
    );
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR_MS);
}

// Builds the duplicates the bug could leave, runs the dedupe, builds the unique
// indexes, and returns what is left. The caller's transaction is then rolled back.
async function dedupeOnDuplicates(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe(`DROP INDEX "Plan_one_active_per_user"`);
  await tx.$executeRawUnsafe(`DROP INDEX "Workout_one_open_per_plan"`);
  const user = await tx.user.create({
    data: { name: "Dedupe Athlete", email: `${prefix}@example.test` },
  });
  const older = await tx.plan.create({
    data: {
      userId: user.id,
      name: "Older",
      source: "DEFAULT",
      createdAt: hoursAgo(OLDER_PLAN_AGE_HOURS),
    },
  });
  const newer = await tx.plan.create({
    data: {
      userId: user.id,
      name: "Newer",
      source: "DEFAULT",
      createdAt: hoursAgo(NEWER_PLAN_AGE_HOURS),
    },
  });
  const open = (planId: number | null, startedAt: Date, extra = {}) =>
    tx.workout.create({
      data: { userId: user.id, planId, startedAt, ...extra },
    });
  const empty = await open(newer.id, hoursAgo(EMPTY_AGE_HOURS));
  const withSet = await open(newer.id, hoursAgo(WITH_SET_AGE_HOURS));
  await tx.setLog.create({
    data: {
      workoutId: withSet.id,
      exerciseId,
      setNumber: 1,
      reps: LOGGED_REPS,
    },
  });
  const withTime = await open(newer.id, hoursAgo(WITH_TIME_AGE_HOURS), {
    durationSeconds: LOGGED_DURATION_SECONDS,
  });
  const withNotes = await open(newer.id, hoursAgo(WITH_NOTES_AGE_HOURS), {
    notes: "Knee felt off",
  });
  const newest = await open(newer.id, hoursAgo(NEWEST_AGE_HOURS));
  const withoutPlan = await open(null, hoursAgo(WITHOUT_PLAN_AGE_HOURS));

  await run(tx, DEDUPE);
  // Only the two unique indexes were dropped; the plain ones in that file still exist.
  await run(tx, UNIQUES, (statement) =>
    statement.startsWith("CREATE UNIQUE INDEX"),
  );

  const plans = await tx.plan.findMany({
    where: { userId: user.id },
    select: { id: true, active: true },
    orderBy: { id: "asc" },
  });
  const workouts = await tx.workout.findMany({
    where: { userId: user.id },
    select: { id: true, startedAt: true, finishedAt: true },
  });
  const byId = new Map(workouts.map((w) => [w.id, w]));
  // False for a deleted row: it must still exist to count as closed.
  const closedAtStart = (id: number) => {
    const w = byId.get(id);
    if (!w?.finishedAt) return false;
    return w.finishedAt.getTime() === w.startedAt.getTime();
  };
  return {
    activePlanIds: plans.filter((p) => p.active).map((p) => p.id),
    expectedActive: [newer.id],
    olderPlanId: older.id,
    newestOpen: byId.get(newest.id)?.finishedAt === null,
    emptyDeleted: !byId.has(empty.id),
    withSetClosed: closedAtStart(withSet.id),
    setKept:
      (await tx.setLog.count({ where: { workoutId: withSet.id } })) === 1,
    withTimeClosed: closedAtStart(withTime.id),
    withNotesClosed: closedAtStart(withNotes.id),
    withoutPlanOpen: byId.get(withoutPlan.id)?.finishedAt === null,
  };
}

describe("migration 20261110220112_keep_one_active_plan_and_open_workout", () => {
  it("keeps the newest active plan and open workout, closes logged duplicates and deletes empty ones", async () => {
    // Arrange, Act: everything runs in one transaction that is then rolled back.
    let result: Awaited<ReturnType<typeof dedupeOnDuplicates>> | undefined;
    const rolledBack = db.$transaction(
      async (tx) => {
        result = await dedupeOnDuplicates(tx);
        throw new Error(ROLLBACK);
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );

    // Assert
    await expect(rolledBack).rejects.toThrow(ROLLBACK);
    expect(result).toEqual({
      activePlanIds: result?.expectedActive,
      expectedActive: result?.expectedActive,
      olderPlanId: result?.olderPlanId,
      newestOpen: true,
      emptyDeleted: true,
      withSetClosed: true,
      setKept: true,
      withTimeClosed: true,
      withNotesClosed: true,
      withoutPlanOpen: true,
    });
  });
});
