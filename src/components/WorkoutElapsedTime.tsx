"use client";

import { useSyncExternalStore } from "react";

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
}: {
  startedAt: string;
  finishedAt?: string;
}) {
  const now = useSyncExternalStore(
    finishedAt ? noSubscription : subscribe,
    currentSecond,
    serverSecond,
  );

  const seconds = Math.max(
    0,
    Math.floor(
      ((finishedAt ? Date.parse(finishedAt) : (now ?? Date.parse(startedAt))) -
        Date.parse(startedAt)) /
        1000,
    ),
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const clock = [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  return (
    <span className="inline-flex items-baseline gap-2 text-sm">
      <span>{finishedAt ? "Workout duration" : "Elapsed workout time"}</span>
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
