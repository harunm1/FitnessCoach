import "server-only";
import { prisma } from "@/lib/prisma";
import { inMonth, monthOf, monthSearchWindow } from "./month";
import type { MonthlyReportInput, ReportSet } from "./summary";

const toKg = (value: { toString(): string } | null) =>
  value === null ? null : Number(value.toString());

// The heaviest weight per exercise before the month, from the sets of the padding days in the
// window and from everything earlier. Only this user's sets.
async function priorBests(
  userId: string,
  exerciseIds: string[],
  windowStart: Date,
  paddingBefore: { exerciseId: string; weightKg: number }[],
): Promise<Record<string, number>> {
  const earlier =
    exerciseIds.length === 0
      ? []
      : await prisma.setLog.groupBy({
          by: ["exerciseId"],
          where: {
            exerciseId: { in: exerciseIds },
            weightKg: { not: null },
            workout: { userId, startedAt: { lt: windowStart } },
          },
          _max: { weightKg: true },
        });
  const candidates = [
    ...earlier.flatMap((row) => {
      const kg = toKg(row._max.weightKg);
      return kg === null ? [] : [{ exerciseId: row.exerciseId, weightKg: kg }];
    }),
    ...paddingBefore,
  ];
  return candidates.reduce<Record<string, number>>(
    (best, { exerciseId, weightKg }) => ({
      ...best,
      [exerciseId]: Math.max(best[exerciseId] ?? weightKg, weightKg),
    }),
    {},
  );
}

// Everything the monthly report needs for one user and one Toronto month (D34).
export async function loadMonthlyReportInput(
  userId: string,
  month: string,
): Promise<MonthlyReportInput> {
  const { from, to } = monthSearchWindow(month);
  const [workouts, found] = await Promise.all([
    prisma.workout.findMany({
      where: {
        userId,
        finishedAt: { not: null },
        startedAt: { gte: from, lt: to },
      },
      select: { startedAt: true },
    }),
    prisma.setLog.findMany({
      where: { workout: { userId, startedAt: { gte: from, lt: to } } },
      select: {
        reps: true,
        weightKg: true,
        exercise: { select: { id: true, name: true, primaryMuscles: true } },
        workout: { select: { startedAt: true } },
      },
    }),
  ]);

  const sets: ReportSet[] = found
    .filter((set) => inMonth(set.workout.startedAt, month))
    .map((set) => ({
      exerciseId: set.exercise.id,
      exerciseName: set.exercise.name,
      primaryMuscles: set.exercise.primaryMuscles,
      weightKg: toKg(set.weightKg),
      reps: set.reps,
    }));
  const paddingBefore = found
    .filter((set) => monthOf(set.workout.startedAt) < month)
    .flatMap((set) =>
      set.weightKg === null
        ? []
        : [
            {
              exerciseId: set.exercise.id,
              weightKg: Number(set.weightKg.toString()),
            },
          ],
    );

  return {
    month,
    sessions: workouts.filter((workout) => inMonth(workout.startedAt, month))
      .length,
    sets,
    priorBestKg: await priorBests(
      userId,
      [...new Set(sets.map((set) => set.exerciseId))],
      from,
      paddingBefore,
    ),
  };
}
