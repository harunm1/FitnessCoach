"use client";

import { useSyncExternalStore } from "react";
import {
  MAX_WORKOUT_SECONDS,
  NOT_TIMED_LABEL,
  workoutSeconds,
} from "@/lib/workout/duration";

const currentSecond = () => Math.floor(Date.now() / 1000) * 1000;
const serverSecond = () => null;
const subscribe = (notify: () => void) => {
  const interval = window.setInterval(notify, 1000);
  return () => window.clearInterval(interval);
};
const noSubscription = () => () => undefined;

export default function WorkoutElapsedTime({
  startedAt,
  finishedAt,
  durationSeconds,
}: {
  startedAt: string;
  finishedAt?: string;
  // A run's own recorded time, which wins over the gap between Start and Finish.
  durationSeconds?: number | null;
}) {
  const now = useSyncExternalStore(
    finishedAt ? noSubscription : subscribe,
    currentSecond,
    serverSecond,
  );

  // A finished workout is timed by the shared rule; a live one by the clock.
  const finishedSeconds = finishedAt
    ? workoutSeconds({
        startedAt: new Date(startedAt),
        finishedAt: new Date(finishedAt),
        durationSeconds: durationSeconds ?? null,
      })
    : null;
  const seconds = finishedAt
    ? (finishedSeconds ?? 0)
    : Math.max(
        0,
        Math.floor(
          ((now ?? Date.parse(startedAt)) - Date.parse(startedAt)) / 1000,
        ),
      );
  const label = (
    <span>{finishedAt ? "Workout duration" : "Elapsed workout time"}</span>
  );
  // A workout left open, or with no usable time, has no workout time (B1).
  if (finishedAt ? finishedSeconds === null : seconds > MAX_WORKOUT_SECONDS) {
    return (
      <span className="inline-flex items-baseline gap-2 text-sm">
        {label}
        <span className="text-lg font-semibold">{NOT_TIMED_LABEL}</span>
      </span>
    );
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const clock = [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  return (
    <span className="inline-flex items-baseline gap-2 text-sm">
      {label}
      <time
        aria-label={
          !finishedAt && now === null
            ? "Loading elapsed time"
            : `${hours} hours ${minutes} minutes ${remainder} seconds`
        }
        className="inline-block w-[8ch] font-mono text-lg font-semibold tabular-nums"
        dateTime={`PT${seconds}S`}
        role="timer"
      >
        {!finishedAt && now === null ? "--:--:--" : clock}
      </time>
    </span>
  );
}
