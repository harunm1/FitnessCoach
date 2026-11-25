// Saves imported workouts as finished workouts and sets owned by the user (#131). They are
// marked source "hevy-import" and keep their original times, so they are never mistaken
// for sets logged live. The unique (userId, importKey) index plus skipDuplicates means a
// second upload of the same file adds nothing, even if two uploads overlap.
import type { Prisma } from "@/generated/prisma/client";
import type { ImportWorkout } from "./hevy";

export const IMPORT_SOURCE = "hevy-import";

export type ImportDb = Pick<Prisma.TransactionClient, "workout" | "setLog">;

export type ImportResult = {
  imported: number; // workouts saved
  alreadyImported: number; // workouts skipped because an earlier upload saved them
  sets: number; // sets saved
  skippedSets: number; // sets dropped because the user skipped their exercise
};

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
    return { imported: 0, alreadyImported: 0, sets: 0, skippedSets };
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
    // Numbered again per library exercise: two file titles mapped to one exercise would
    // otherwise both start at set 1 and break the (workout, exercise, set) unique key.
    const counts = new Map<string, number>();
    return (found?.sets ?? []).map((set) => {
      const exerciseId = idFor(set.exerciseTitle) as string;
      const setNumber = (counts.get(exerciseId) ?? 0) + 1;
      counts.set(exerciseId, setNumber);
      return {
        workoutId: id,
        exerciseId,
        setNumber,
        reps: set.reps,
        weightKg: set.weightKg,
        rpe: set.rpe,
        loggedAt: found?.workout.startedAt as Date,
      };
    });
  });
  if (rows.length > 0) await db.setLog.createMany({ data: rows });

  return {
    imported: created.length,
    alreadyImported: candidates.length - created.length,
    sets: rows.length,
    skippedSets,
  };
}
