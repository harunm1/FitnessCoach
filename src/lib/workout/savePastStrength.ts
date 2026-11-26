// Saves a strength workout logged after the fact as one finished Workout with its sets, in a
// single nested create so both are written or neither is (D49, #194). It belongs to the user
// passed in, is marked source "manual-strength" and is not tied to a plan day, so it never
// moves the plan on or collides with the one-open-workout-per-plan index.
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  MANUAL_STRENGTH_SOURCE,
  MANUAL_STRENGTH_STORED_HOUR_UTC,
} from "./manualSources";
import type { PastStrengthEntry } from "./pastStrength";

const MS_PER_MINUTE = 60_000;
const SECONDS_PER_MINUTE = 60;

// Sets numbered 1, 2, 3 per exercise, in the order typed.
export function setRows(entry: PastStrengthEntry, loggedAt: Date) {
  return entry.exercises.flatMap(({ exerciseId, sets }) =>
    sets.map((set, index) => ({
      exerciseId,
      setNumber: index + 1,
      reps: set.reps,
      weightKg: set.weightKg ?? null,
      loggedAt,
    })),
  );
}

export async function savePastStrength(
  userId: string,
  entry: PastStrengthEntry,
): Promise<void> {
  const startedAt = new Date(`${entry.date}${MANUAL_STRENGTH_STORED_HOUR_UTC}`);
  // No minutes given: finished at the start, which the app reads as "Not timed".
  const finishedAt = new Date(
    startedAt.getTime() + (entry.minutes ?? 0) * MS_PER_MINUTE,
  );
  await prisma.workout.create({
    data: {
      userId,
      source: MANUAL_STRENGTH_SOURCE,
      startedAt,
      finishedAt,
      durationSeconds:
        entry.minutes === null ? null : entry.minutes * SECONDS_PER_MINUTE,
      // A finished workout has no running clock (D39).
      activeSince: null,
      notes: entry.note,
      sets: { create: setRows(entry, startedAt) },
    },
    select: { id: true },
  });
}
