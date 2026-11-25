import "server-only";
import { prisma } from "@/lib/prisma";
import type { ActiveClock } from "./activeTime";

// The user's open workout with its clock (D36), found the same way Finish finds it: the user's
// own, unfinished, on an active plan of theirs.
export type OpenClockWorkout = {
  id: number;
  activeBankedSeconds: number;
  activeSince: Date | null;
  durationSeconds: number | null;
};

export function findOpenClockWorkout(
  userId: string,
): Promise<OpenClockWorkout | null> {
  return prisma.workout.findFirst({
    where: {
      userId,
      finishedAt: null,
      plan: { userId, active: true },
    },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      activeBankedSeconds: true,
      activeSince: true,
      durationSeconds: true,
    },
  });
}

// When the newest set of this workout was logged (any exercise), or null with none.
export async function latestSetMs(workoutId: number): Promise<number | null> {
  const newest = await prisma.setLog.findFirst({
    where: { workoutId },
    orderBy: { loggedAt: "desc" },
    select: { loggedAt: true },
  });
  return newest ? newest.loggedAt.getTime() : null;
}

export function clockOf(workout: OpenClockWorkout): ActiveClock {
  return {
    bankedSeconds: workout.activeBankedSeconds,
    activeSinceMs: workout.activeSince ? workout.activeSince.getTime() : null,
  };
}
