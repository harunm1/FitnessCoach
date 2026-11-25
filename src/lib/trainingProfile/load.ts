// The only training-profile file that talks to the database (D34). It reads start times for
// every finished workout, imported or live, and set rows only for the last 8 weeks, so a long
// history costs one narrow column and a bounded set read.
import type { PrismaClient } from "@/generated/prisma/client";
import { deriveTrainingProfile } from "./derive";
import type { HistorySet, TrainingProfile } from "./types";
import { RECENT_WEEKS, weeksAgo } from "./windows";
import { workingWeights } from "./workingWeights";

export type ProfileDb = Pick<PrismaClient, "workout" | "setLog">;

const setSelect = {
  reps: true,
  weightKg: true,
  exerciseId: true,
  exercise: { select: { name: true, equipment: true } },
  workout: { select: { startedAt: true } },
} as const;

type SetRow = {
  reps: number;
  weightKg: unknown;
  exerciseId: string;
  exercise: { name: string; equipment: string | null };
  workout: { startedAt: Date };
};

const toHistorySet = (row: SetRow): HistorySet => ({
  exerciseId: row.exerciseId,
  exerciseName: row.exercise.name,
  equipment: row.exercise.equipment,
  reps: row.reps,
  weightKg: row.weightKg === null ? null : Number(row.weightKg),
  startedAt: row.workout.startedAt,
});

// Weighted sets of the user's finished workouts in the last 8 weeks.
const recentSetsWhere = (userId: string, now: Date) => ({
  weightKg: { not: null },
  workout: {
    userId,
    finishedAt: { not: null },
    startedAt: { gte: weeksAgo(RECENT_WEEKS, now), lte: now },
  },
});

export async function loadTrainingProfile(
  db: ProfileDb,
  userId: string,
  now = new Date(),
): Promise<TrainingProfile> {
  const [workouts, sets] = await Promise.all([
    db.workout.findMany({
      where: { userId, finishedAt: { not: null } },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    }),
    db.setLog.findMany({
      where: recentSetsWhere(userId, now),
      orderBy: { id: "asc" },
      select: setSelect,
    }),
  ]);
  return deriveTrainingProfile(
    workouts.map((row) => row.startedAt),
    (sets as SetRow[]).map(toHistorySet),
    now,
  );
}

// The working weight, in kilograms, of each exercise asked for that the user lifted in the
// last 8 weeks. The session screen starts the weight box there.
export async function loadWorkingWeightsFor(
  db: ProfileDb,
  userId: string,
  exerciseIds: string[],
  now = new Date(),
): Promise<Map<string, number>> {
  if (exerciseIds.length === 0) return new Map();
  const sets = await db.setLog.findMany({
    where: { ...recentSetsWhere(userId, now), exerciseId: { in: exerciseIds } },
    orderBy: { id: "asc" },
    select: setSelect,
  });
  return new Map(
    workingWeights((sets as SetRow[]).map(toHistorySet), now).map((lift) => [
      lift.exerciseId,
      lift.weightKg,
    ]),
  );
}
