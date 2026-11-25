"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  pauseClock,
  resumeClock,
  type ActiveClock,
} from "@/lib/workout/activeTime";
import {
  clockOf,
  findOpenClockWorkout,
  latestSetMs,
} from "@/lib/workout/openClock";

// Pause and resume of the workout clock (D34). Called from the browser, by the Pause and Resume
// buttons and by the idle check, which passes the time of the last activity so the pause starts
// there and not when the page noticed.
export type ClockResult =
  | { status: "ok"; bankedSeconds: number; activeSinceIso: string | null }
  | { status: "error"; message: string };

const NO_WORKOUT: ClockResult = {
  status: "error",
  message: "There is no workout in progress.",
};

function report(clock: ActiveClock): ClockResult {
  return {
    status: "ok",
    bankedSeconds: clock.bankedSeconds,
    activeSinceIso:
      clock.activeSinceMs === null
        ? null
        : new Date(clock.activeSinceMs).toISOString(),
  };
}

// The clock as it is now, after another tab or device won a race.
async function currentState(userId: string): Promise<ClockResult> {
  const workout = await findOpenClockWorkout(userId);
  return workout ? report(clockOf(workout)) : NO_WORKOUT;
}

export async function pauseWorkoutClock(
  lastActivityIso: string,
): Promise<ClockResult> {
  const user = await requireUser();
  const workout = await findOpenClockWorkout(user.id);
  if (!workout) return NO_WORKOUT;
  const clock = clockOf(workout);
  if (clock.activeSinceMs === null) return report(clock);

  const nowMs = Date.now();
  const requestedMs = Date.parse(lastActivityIso);
  // Never earlier than the newest set, which another device may have logged, and never before
  // the running stretch began or after now (pauseClock holds both).
  const newestSetMs = await latestSetMs(workout.id);
  const wantedMs = Math.max(
    Number.isFinite(requestedMs) ? requestedMs : nowMs,
    newestSetMs ?? 0,
  );
  const paused = pauseClock(clock, wantedMs, nowMs);

  // Compare and set on the stretch this call read, so two tabs pausing together bank once.
  const { count } = await prisma.workout.updateMany({
    where: {
      id: workout.id,
      userId: user.id,
      finishedAt: null,
      activeSince: workout.activeSince,
    },
    data: { activeBankedSeconds: paused.bankedSeconds, activeSince: null },
  });
  if (count === 0) return currentState(user.id);
  revalidatePath("/session");
  return report(paused);
}

export async function resumeWorkoutClock(): Promise<ClockResult> {
  const user = await requireUser();
  const workout = await findOpenClockWorkout(user.id);
  if (!workout) return NO_WORKOUT;
  const clock = clockOf(workout);
  if (clock.activeSinceMs !== null) return report(clock);

  const resumed = resumeClock(clock, Date.now());
  const { count } = await prisma.workout.updateMany({
    where: {
      id: workout.id,
      userId: user.id,
      finishedAt: null,
      activeSince: null,
    },
    data: { activeSince: new Date(resumed.activeSinceMs ?? Date.now()) },
  });
  if (count === 0) return currentState(user.id);
  revalidatePath("/session");
  return report(resumed);
}
