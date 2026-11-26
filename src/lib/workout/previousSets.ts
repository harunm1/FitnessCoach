// "Previous" in the set table (D44): for each exercise, the sets of the user's most recent
// finished workout that contained it, so a row can show what was done last time.
import type { PrismaClient } from "@/generated/prisma/client";
import { formatWeight, type WeightUnit } from "@/lib/units/convert";

export type PreviousSet = {
  setNumber: number;
  reps: number;
  weightKg: string | null;
};

type PreviousRow = PreviousSet & { exerciseId: string; workoutId: number };

// More than any one exercise has in a few workouts; the read stays bounded.
const ROW_LIMIT = 400;

// The first workout met per exercise (newest first) supplies all of that exercise's sets.
export function newestWorkoutSets(
  rows: PreviousRow[],
): Map<string, PreviousSet[]> {
  const workoutOf = new Map<string, number>();
  return rows.reduce((byExercise, row) => {
    const chosen = workoutOf.get(row.exerciseId) ?? row.workoutId;
    workoutOf.set(row.exerciseId, chosen);
    if (chosen !== row.workoutId) return byExercise;
    const { setNumber, reps, weightKg } = row;
    return byExercise.set(row.exerciseId, [
      ...(byExercise.get(row.exerciseId) ?? []),
      { setNumber, reps, weightKg },
    ]);
  }, new Map<string, PreviousSet[]>());
}

export async function loadPreviousSets(
  db: Pick<PrismaClient, "setLog">,
  userId: string,
  exerciseIds: string[],
): Promise<Map<string, PreviousSet[]>> {
  if (exerciseIds.length === 0) return new Map();
  const rows = await db.setLog.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      workout: { userId, finishedAt: { not: null } },
    },
    orderBy: [{ workout: { finishedAt: "desc" } }, { setNumber: "asc" }],
    take: ROW_LIMIT,
    select: {
      workoutId: true,
      exerciseId: true,
      setNumber: true,
      reps: true,
      weightKg: true,
    },
  });
  return newestWorkoutSets(
    rows.map((row) => ({
      ...row,
      weightKg: row.weightKg === null ? null : row.weightKg.toString(),
    })),
  );
}

// "60 kg x 8", "8 reps" for a bodyweight set, "-" when there was no such set.
export function formatPrevious(
  previous: PreviousSet | undefined,
  unit: WeightUnit,
): string {
  if (!previous) return "-";
  return previous.weightKg === null
    ? `${previous.reps} reps`
    : `${formatWeight(Number(previous.weightKg), unit)} × ${previous.reps}`;
}
