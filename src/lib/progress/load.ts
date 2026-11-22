// The only progress file that talks to the database (#16). It returns plain objects
// (types.ts), so the rest of the progress code and the components stay testable.
import { prisma } from "@/lib/prisma";
import type { ProgressWorkout } from "./types";

// The user's finished workouts since a date, oldest first. One query loads the
// sets, their exercises and each workout's plan days.
export async function loadFinishedWorkouts(
  userId: string,
  since: Date,
): Promise<ProgressWorkout[]> {
  const rows = await prisma.workout.findMany({
    where: {
      userId,
      startedAt: { gte: since },
      finishedAt: { not: null },
    },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      startedAt: true,
      finishedAt: true,
      distanceKm: true,
      durationSeconds: true,
      planDay: { select: { name: true } },
      plan: { select: { days: { select: { kind: true } } } },
      sets: {
        orderBy: [{ loggedAt: "asc" }, { setNumber: "asc" }],
        select: {
          setNumber: true,
          reps: true,
          weightKg: true,
          exercise: {
            select: {
              name: true,
              category: true,
              primaryMuscles: true,
              secondaryMuscles: true,
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    startedAt: row.startedAt,
    // The query only returns finished workouts.
    finishedAt: row.finishedAt as Date,
    dayName: row.planDay?.name ?? null,
    planDays: row.plan?.days.filter((day) => day.kind !== "REST").length ?? 0,
    distanceKm: row.distanceKm === null ? null : Number(row.distanceKm),
    runSeconds: row.durationSeconds,
    sets: row.sets.map((set) => ({
      exerciseName: set.exercise.name,
      category: set.exercise.category,
      primaryMuscles: set.exercise.primaryMuscles,
      secondaryMuscles: set.exercise.secondaryMuscles,
      setNumber: set.setNumber,
      reps: set.reps,
      weightKg: set.weightKg === null ? null : Number(set.weightKg),
    })),
  }));
}
