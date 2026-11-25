// The only history file that talks to the database (D28). Every query filters on the
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
import { groupInOrder, minutesBetween, workoutName } from "./view";

// The newest sets of one exercise shown on its page; years of three sessions a week.
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
        minutes: minutesBetween(row.startedAt, row.finishedAt as Date),
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
        orderBy: [{ loggedAt: "asc" }, { setNumber: "asc" }],
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

  return {
    id: row.id,
    name: workoutName({
      planDayName: row.planDay?.name ?? null,
      imported,
      notes: row.notes,
      isRun: distanceKm !== null,
    }),
    startedAt: row.startedAt,
    minutes: minutesBetween(row.startedAt, row.finishedAt as Date),
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
    orderBy: [{ workout: { startedAt: "desc" } }, { setNumber: "asc" }],
    take: EXERCISE_SET_LIMIT,
    select: {
      ...setFields,
      workout: { select: { id: true, startedAt: true } },
      exercise: { select: { name: true } },
    },
  });
  if (sets.length === 0) return null;

  // Already newest workout first and in set order from the query.
  const workouts = [...groupInOrder(sets, (set) => set.workout.id)].map(
    ([workoutId, grouped]) => ({
      workoutId,
      startedAt: grouped[0].workout.startedAt,
      sets: grouped.map(toSet),
    }),
  );
  return {
    id: exerciseId,
    name: sets[0].exercise.name,
    workouts,
  };
}
