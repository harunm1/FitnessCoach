// The only history file that talks to the database (D29). Every query filters on the
// signed-in user's id, so another user's workout or exercise reads as missing (null),
// and the pages answer 404 for it.
import "server-only";
import { prisma } from "@/lib/prisma";
import { IMPORT_SOURCE } from "@/lib/import/save";
import { PAGE_SIZE } from "./params";
import type {
  ExerciseHistory,
  HistoryPage,
  HistorySet,
  WorkoutDetail,
} from "./types";
import { workoutMinutes } from "@/lib/workout/duration";
import {
  groupInOrder,
  totalVolumeKg,
  weightRecords,
  workoutName,
} from "./view";

// The newest sets of one exercise read for its page; years of three sessions a week.
// Past it, the last (possibly cut) workout is dropped, unless it is the only one, and
// the page says older sets are not shown.
export const EXERCISE_SET_LIMIT = 500;

const finishedBy = (userId: string) => ({
  userId,
  finishedAt: { not: null },
});

const setFields = { setNumber: true, reps: true, weightKg: true, rpe: true };

type Decimalish = { toString(): string } | null;
const toNumber = (value: Decimalish) =>
  value === null ? null : Number(value.toString());

function toSet(set: {
  setNumber: number;
  reps: number;
  weightKg: Decimalish;
  rpe: number | null;
}): HistorySet {
  return {
    setNumber: set.setNumber,
    reps: set.reps,
    weightKg: toNumber(set.weightKg),
    rpe: set.rpe,
  };
}

export async function loadHistoryPage(
  userId: string,
  page: number,
): Promise<HistoryPage> {
  const rows = await prisma.workout.findMany({
    where: finishedBy(userId),
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    // One extra row says whether a next page exists, without a count query.
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      startedAt: true,
      finishedAt: true,
      source: true,
      notes: true,
      distanceKm: true,
      durationSeconds: true,
      planDay: { select: { name: true } },
      _count: { select: { sets: true } },
    },
  });
  return {
    hasNext: rows.length > PAGE_SIZE,
    rows: rows.slice(0, PAGE_SIZE).map((row) => {
      const imported = row.source === IMPORT_SOURCE;
      return {
        id: row.id,
        name: workoutName({
          planDayName: row.planDay?.name ?? null,
          imported,
          notes: row.notes,
          isRun: row.distanceKm !== null,
        }),
        startedAt: row.startedAt,
        // The query only returns finished workouts.
        minutes: workoutMinutes(row),
        sets: row._count.sets,
        imported,
      };
    }),
  };
}

export async function loadWorkoutDetail(
  userId: string,
  workoutId: number,
): Promise<WorkoutDetail | null> {
  const row = await prisma.workout.findFirst({
    where: { id: workoutId, ...finishedBy(userId) },
    select: {
      id: true,
      startedAt: true,
      finishedAt: true,
      source: true,
      notes: true,
      distanceKm: true,
      durationSeconds: true,
      planDay: { select: { name: true } },
      run: { select: { rpe: true } },
      sets: {
        // Imported sets share one loggedAt; the row id keeps the file's order.
        orderBy: [{ loggedAt: "asc" }, { setNumber: "asc" }, { id: "asc" }],
        select: {
          ...setFields,
          exercise: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!row) return null;

  const imported = row.source === IMPORT_SOURCE;
  const distanceKm = toNumber(row.distanceKm);
  // Exercises in the order their first set was logged; sets in set order.
  const exercises = [...groupInOrder(row.sets, (set) => set.exercise.id)].map(
    ([id, sets]) => ({
      id,
      name: sets[0].exercise.name,
      sets: sets.map(toSet).sort((a, b) => a.setNumber - b.setNumber),
    }),
  );

  // The heaviest weight this user lifted in each of these exercises before this workout.
  const earlier = await prisma.setLog.groupBy({
    by: ["exerciseId"],
    where: {
      exerciseId: { in: exercises.map((exercise) => exercise.id) },
      workout: {
        userId,
        finishedAt: { not: null },
        startedAt: { lt: row.startedAt },
      },
    },
    _max: { weightKg: true },
  });
  const earlierBestKg = Object.fromEntries(
    earlier.map((entry) => [
      entry.exerciseId,
      toNumber(entry._max.weightKg) ?? 0,
    ]),
  );

  return {
    id: row.id,
    name: workoutName({
      planDayName: row.planDay?.name ?? null,
      imported,
      notes: row.notes,
      isRun: distanceKm !== null,
    }),
    startedAt: row.startedAt,
    minutes: workoutMinutes(row),
    volumeKg: totalVolumeKg(exercises),
    recordExerciseIds: weightRecords(exercises, earlierBestKg),
    imported,
    notes: imported ? null : row.notes,
    run:
      distanceKm !== null && row.durationSeconds !== null
        ? {
            distanceKm,
            seconds: row.durationSeconds,
            rpe: row.run?.rpe ?? null,
          }
        : null,
    exercises,
  };
}

export async function loadExerciseHistory(
  userId: string,
  exerciseId: string,
): Promise<ExerciseHistory | null> {
  const sets = await prisma.setLog.findMany({
    where: { exerciseId, workout: finishedBy(userId) },
    orderBy: [
      { workout: { startedAt: "desc" } },
      { workoutId: "desc" },
      { setNumber: "asc" },
      { id: "asc" },
    ],
    // One extra row says whether older sets exist.
    take: EXERCISE_SET_LIMIT + 1,
    select: {
      ...setFields,
      workout: { select: { id: true, startedAt: true } },
      exercise: { select: { name: true } },
    },
  });
  if (sets.length === 0) return null;

  // Already newest workout first and in set order from the query.
  const olderHidden = sets.length > EXERCISE_SET_LIMIT;
  const shown = sets.slice(0, EXERCISE_SET_LIMIT);
  const grouped = [...groupInOrder(shown, (set) => set.workout.id)];
  // The last workout read may be cut by the limit; drop it unless it is the only one.
  const complete =
    olderHidden && grouped.length > 1 ? grouped.slice(0, -1) : grouped;
  const workouts = complete.map(([workoutId, workoutSets]) => ({
    workoutId,
    startedAt: workoutSets[0].workout.startedAt,
    sets: workoutSets.map(toSet),
  }));
  return {
    id: exerciseId,
    name: sets[0].exercise.name,
    olderHidden,
    workouts,
  };
}
