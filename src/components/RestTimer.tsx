"use client";

import { useEffect, useState } from "react";

type RestTimerProps = {
  restSeconds: number;
  exerciseName: string;
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function RestTimer({
  restSeconds,
  exerciseName,
}: RestTimerProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(restSeconds);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsHydrated(true), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return;

    const timeout = window.setTimeout(() => {
      if (secondsLeft === 1) {
        setSecondsLeft(0);
        setIsRunning(false);
      } else {
        setSecondsLeft(secondsLeft - 1);
      }
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [isRunning, secondsLeft]);

  function startOrResume() {
    if (secondsLeft === 0) setSecondsLeft(restSeconds);
    setIsRunning(true);
  }

  function reset() {
    setIsRunning(false);
    setSecondsLeft(restSeconds);
  }

  const buttonClassName =
    "min-h-8 border border-foreground/20 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5";

  return (
    <div
      aria-label={`${exerciseName} rest timer`}
      className={`mt-3 flex flex-wrap items-center gap-3 border px-3 py-2 ${isRunning ? "border-emerald-700/40 bg-emerald-50" : "border-foreground/15 bg-white"}`}
    >
      <div className="min-w-20">
        <p
          aria-live="polite"
          className={`m-0 text-[9px] font-semibold tracking-[0.1em] uppercase ${isRunning ? "text-emerald-800" : "text-foreground/50"}`}
        >
          {isRunning
            ? "Resting"
            : secondsLeft === 0
              ? "Rest complete"
              : secondsLeft === restSeconds
                ? "Rest timer"
                : "Paused"}
        </p>
        <time
          aria-label={`${Math.floor(secondsLeft / 60)} minutes ${secondsLeft % 60} seconds remaining`}
          className={`font-mono text-lg font-semibold tabular-nums ${isRunning ? "text-emerald-900" : "text-foreground"}`}
        >
          {formatTime(secondsLeft)}
        </time>
      </div>
      <button
        className={`${buttonClassName} ${isRunning ? "border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-900" : ""}`}
        disabled={!isHydrated}
        onClick={isRunning ? () => setIsRunning(false) : startOrResume}
        type="button"
      >
        {!isHydrated
          ? "Loading timer..."
          : isRunning
            ? "Pause timer"
            : secondsLeft === restSeconds
              ? "Start rest"
              : secondsLeft === 0
                ? "Restart rest"
                : "Resume timer"}
      </button>
      {secondsLeft !== restSeconds && (
        <button className={buttonClassName} onClick={reset} type="button">
          Reset
        </button>
      )}
    </div>
  );
}
