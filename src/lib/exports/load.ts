import "server-only";
import { prisma } from "@/lib/prisma";
import { MAX_ROWS } from "./limits";
import type { CoachMessageRow, WorkoutSetRow } from "./rows";

// Every set the user logged, oldest first; one more than a file holds is read, so the caller can
// refuse instead of silently cutting the oldest.  Only this user's: the filter is on the workout's owner.
export async function loadWorkoutSets(
  userId: string,
): Promise<WorkoutSetRow[]> {
  const found = await prisma.setLog.findMany({
    where: { workout: { userId } },
    orderBy: [
      { workout: { startedAt: "desc" } },
      { workoutId: "desc" },
      { loggedAt: "desc" },
      { id: "desc" },
    ],
    take: MAX_ROWS + 1,
    select: {
      setNumber: true,
      reps: true,
      weightKg: true,
      rpe: true,
      exercise: { select: { name: true } },
      workout: { select: { startedAt: true, notes: true } },
    },
  });
  return found.reverse().map((set) => ({
    startedAt: set.workout.startedAt,
    exerciseName: set.exercise.name,
    setNumber: set.setNumber,
    weightKg: set.weightKg === null ? null : Number(set.weightKg.toString()),
    reps: set.reps,
    rpe: set.rpe,
    notes: set.workout.notes,
  }));
}

// Every message in the user's conversations, oldest first. Only this user's conversations.
export async function loadCoachMessages(
  userId: string,
): Promise<CoachMessageRow[]> {
  const found = await prisma.message.findMany({
    where: { conversation: { userId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_ROWS + 1,
    select: { createdAt: true, role: true, content: true },
  });
  return found.reverse();
}
