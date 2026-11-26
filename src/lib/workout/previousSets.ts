// "Previous" in the set table (D44): for each exercise, the sets of the user's most recent
// finished workout that contained it, so a row can show what was done last time.
import type { PrismaClient } from "@/generated/prisma/client";
import { formatWeight, type WeightUnit } from "@/lib/units/convert";

export type PreviousSet = {
  setNumber: number;
  reps: number;
  weightKg: string | null;
};

// One exercise: the newest finished workout that has it, then that workout's sets. Asked per
// exercise so one done long ago (or only in an import) still has its Previous.
async function previousFor(
  db: Pick<PrismaClient, "setLog">,
  userId: string,
  exerciseId: string,
): Promise<PreviousSet[]> {
  const newest = await db.setLog.findFirst({
    where: { exerciseId, workout: { userId, finishedAt: { not: null } } },
    orderBy: { workout: { finishedAt: "desc" } },
    select: { workoutId: true },
  });
  if (!newest) return [];
  const rows = await db.setLog.findMany({
    where: { exerciseId, workoutId: newest.workoutId },
    orderBy: { setNumber: "asc" },
    select: { setNumber: true, reps: true, weightKg: true },
  });
  return rows.map((row) => ({
    setNumber: row.setNumber,
    reps: row.reps,
    weightKg: row.weightKg === null ? null : row.weightKg.toString(),
  }));
}

export async function loadPreviousSets(
  db: Pick<PrismaClient, "setLog">,
  userId: string,
  exerciseIds: string[],
): Promise<Map<string, PreviousSet[]>> {
  const found = await Promise.all(
    exerciseIds.map(
      async (id) => [id, await previousFor(db, userId, id)] as const,
    ),
  );
  return new Map(found.filter(([, sets]) => sets.length > 0));
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
