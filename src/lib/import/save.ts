// Saves imported workouts as finished workouts and sets owned by the user (#131). They are
// marked source "hevy-import" and keep their original times, so they are never mistaken
// for sets logged live. The unique (userId, importKey) index plus skipDuplicates means a
// second upload of the same file adds no workout, even if two uploads overlap. A workout that
// is already saved is still repaired: an exercise it has no sets for (its name was unmapped at
// the first upload) is filled in on a later one; an exercise it has is never touched, so a
// third upload adds nothing (live bug L4, 25 Nov 2026).
import type { Prisma } from "@/generated/prisma/client";
import type { ImportWorkout } from "./hevy";

export const IMPORT_SOURCE = "hevy-import";

export type ImportDb = Pick<Prisma.TransactionClient, "workout" | "setLog">;

type ImportedSet = ImportWorkout["sets"][number];

export type ImportResult = {
  imported: number; // workouts saved
  alreadyImported: number; // workouts skipped because an earlier upload saved them
  sets: number; // sets saved
  skippedSets: number; // sets dropped because the user skipped their exercise
  repairedWorkouts: number; // already-saved workouts that gained missing exercises
  repairedSets: number; // sets added to those workouts (also counted in `sets`)
};

// Sets numbered 1, 2, 3 per library exercise: two file titles mapped to one exercise would
// otherwise both start at set 1 and break the (workout, exercise, set) unique key.
function setRows(
  workoutId: number,
  startedAt: Date,
  sets: ImportedSet[],
  idFor: (title: string) => string | undefined,
  skipExercises: Set<string> = new Set(),
) {
  const counts = new Map<string, number>();
  return sets.flatMap((set) => {
    const exerciseId = idFor(set.exerciseTitle) as string;
    if (skipExercises.has(exerciseId)) return [];
    const setNumber = (counts.get(exerciseId) ?? 0) + 1;
    counts.set(exerciseId, setNumber);
    return [
      {
        workoutId,
        exerciseId,
        setNumber,
        reps: set.reps,
        weightKg: set.weightKg,
        rpe: set.rpe,
        loggedAt: startedAt,
      },
    ];
  });
}

// `exerciseIds` maps an exercise title in the file to a library exercise id; a title
// missing from it is one the user chose to skip.
export async function saveImport(
  db: ImportDb,
  userId: string,
  workouts: ImportWorkout[],
  exerciseIds: Record<string, string>,
): Promise<ImportResult> {
  // Own keys only: a title like "constructor" must not find a method on Object.prototype.
  const idFor = (title: string): string | undefined =>
    Object.hasOwn(exerciseIds, title) ? exerciseIds[title] : undefined;
  const mapped = workouts.map((workout) => ({
    workout,
    sets: workout.sets.filter((set) => idFor(set.exerciseTitle)),
  }));
  const skippedSets = mapped.reduce(
    (total, { workout, sets }) => total + workout.sets.length - sets.length,
    0,
  );
  const candidates = mapped.filter(({ sets }) => sets.length > 0);
  if (candidates.length === 0) {
    return {
      imported: 0,
      alreadyImported: 0,
      sets: 0,
      skippedSets,
      repairedWorkouts: 0,
      repairedSets: 0,
    };
  }

  const created = await db.workout.createManyAndReturn({
    data: candidates.map(({ workout }) => ({
      userId,
      source: IMPORT_SOURCE,
      importKey: workout.key,
      startedAt: workout.startedAt,
      finishedAt: workout.finishedAt,
      notes: workout.title,
    })),
    skipDuplicates: true,
    select: { id: true, importKey: true },
  });

  const setsByKey = new Map(
    candidates.map(({ workout, sets }) => [workout.key, { workout, sets }]),
  );
  const rows = created.flatMap(({ id, importKey }) => {
    const found = importKey ? setsByKey.get(importKey) : undefined;
    if (!found) return [];
    return setRows(id, found.workout.startedAt, found.sets, idFor);
  });

  // Workouts a first upload saved: add only the exercises they have no sets for.
  const createdKeys = new Set(created.map(({ importKey }) => importKey));
  const earlier = candidates.filter(
    ({ workout }) => !createdKeys.has(workout.key),
  );
  const stored =
    earlier.length === 0
      ? []
      : await db.workout.findMany({
          where: {
            userId,
            importKey: { in: earlier.map(({ workout }) => workout.key) },
          },
          select: {
            id: true,
            importKey: true,
            sets: { select: { exerciseId: true } },
          },
        });
  const repairs = stored.flatMap(({ id, importKey, sets }) => {
    const found = importKey ? setsByKey.get(importKey) : undefined;
    if (!found) return [];
    const have = new Set(sets.map((set) => set.exerciseId));
    return setRows(id, found.workout.startedAt, found.sets, idFor, have);
  });
  const repairedWorkouts = new Set(repairs.map((row) => row.workoutId)).size;

  const all = [...rows, ...repairs];
  if (all.length > 0)
    await db.setLog.createMany({ data: all, skipDuplicates: true });

  return {
    imported: created.length,
    alreadyImported: candidates.length - created.length,
    sets: all.length,
    skippedSets,
    repairedWorkouts,
    repairedSets: repairs.length,
  };
}

// How many stored workouts lack an exercise the file has and the mapping covers: what a
// re-upload would repair. The preview shows it so the import button stays on for them.
export function countRepairable(
  workouts: ImportWorkout[],
  stored: { importKey: string | null; sets: { exerciseId: string }[] }[],
  mapping: Record<string, string>,
): number {
  const byKey = new Map(workouts.map((workout) => [workout.key, workout]));
  return stored.filter(({ importKey, sets }) => {
    const workout = importKey ? byKey.get(importKey) : undefined;
    if (!workout) return false;
    const have = new Set(sets.map((set) => set.exerciseId));
    return workout.sets.some(
      (set) =>
        Object.hasOwn(mapping, set.exerciseTitle) &&
        !have.has(mapping[set.exerciseTitle]),
    );
  }).length;
}
