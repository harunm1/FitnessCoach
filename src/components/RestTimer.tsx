"use client";

import { useEffect, useRef, useState } from "react";
import { alertRestEnded, unlockAudio } from "@/lib/alerts/browserAlert";
import {
  ADJUST_SECONDS,
  adjustRestEnd,
  restEndFromRemaining,
  restSecondsLeft,
} from "@/lib/workout/restClock";
import { restSecondsRemaining } from "@/lib/workout/restRemaining";

type RestTimerProps = {
  restSeconds: number;
  exerciseName: string;
  // When the newest set of this exercise was logged. A set logged within the rest time
  // starts the countdown by itself; an older one (a page reload) does not.
  lastLoggedAtIso: string;
  // The server's clock when the page was built. The set time is the server's too, so the
  // elapsed time does not depend on this device's clock being right.
  serverNowIso: string;
};

// The countdown is a deadline (D37): `running` holds the end time, so a sleeping screen or a
// throttled background tab cannot slow it down, and the next look at the clock is right.
type Phase =
  | { kind: "idle" }
  | { kind: "running"; endsAtMs: number }
  | { kind: "paused"; secondsLeft: number }
  | { kind: "done" };

const CHECK_MS = 250;
// A rest that ended longer ago than this (the page was asleep) is shown as complete but does
// not play a tone for a rest the user has already left behind.
const LATE_ALERT_MS = 10_000;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function RestTimer({
  restSeconds,
  exerciseName,
  lastLoggedAtIso,
  serverNowIso,
}: RestTimerProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [nowMs, setNowMs] = useState(() => Date.now());

  // The newest server time, read when a set is logged. Keeping it out of the effect's inputs
  // means a page refresh for another exercise does not restart a timer the user paused.
  const serverNow = useRef(serverNowIso);
  useEffect(() => {
    serverNow.current = serverNowIso;
  }, [serverNowIso]);

  // The end time that has already alerted, so a rest alerts once however many checks see it.
  const alertedEnd = useRef<number | null>(null);

  // Runs after mount and whenever a new set is logged: starts the rest by itself.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsHydrated(true);
      const remaining = restSecondsRemaining(
        Date.parse(lastLoggedAtIso),
        Date.parse(serverNow.current),
        restSeconds,
      );
      if (remaining !== null) {
        const now = Date.now();
        setNowMs(now);
        setPhase({
          kind: "running",
          endsAtMs: restEndFromRemaining(remaining, now),
        });
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [lastLoggedAtIso, restSeconds]);

  // While resting: look at the clock a few times a second, and again whenever the tab
  // becomes visible (timers in a hidden tab are throttled, the deadline is not).
  const endsAtMs = phase.kind === "running" ? phase.endsAtMs : null;
  useEffect(() => {
    if (endsAtMs === null) return;
    const check = () => {
      const now = Date.now();
      setNowMs(now);
      if (now < endsAtMs) return;
      setPhase({ kind: "done" });
      if (alertedEnd.current !== endsAtMs) {
        alertedEnd.current = endsAtMs;
        if (now - endsAtMs <= LATE_ALERT_MS) alertRestEnded();
      }
    };
    const interval = window.setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [endsAtMs]);

  const isRunning = phase.kind === "running";
  const secondsLeft =
    phase.kind === "running"
      ? restSecondsLeft(phase.endsAtMs, nowMs)
      : phase.kind === "paused"
        ? phase.secondsLeft
        : phase.kind === "done"
          ? 0
          : restSeconds;

  function startRest() {
    unlockAudio();
    const now = Date.now();
    setNowMs(now);
    const seconds = phase.kind === "paused" ? phase.secondsLeft : restSeconds;
    setPhase({ kind: "running", endsAtMs: restEndFromRemaining(seconds, now) });
  }

  function pause() {
    if (phase.kind !== "running") return;
    setPhase({
      kind: "paused",
      secondsLeft: restSecondsLeft(phase.endsAtMs, Date.now()),
    });
  }

  function reset() {
    setPhase({ kind: "idle" });
  }

  // +15 / -15 move the end time; taking off more than is left ends the rest like Skip.
  function adjust(deltaSeconds: number) {
    if (phase.kind !== "running") return;
    const now = Date.now();
    const next = adjustRestEnd(phase.endsAtMs, deltaSeconds, now);
    setNowMs(now);
    setPhase(
      next <= now ? { kind: "idle" } : { kind: "running", endsAtMs: next },
    );
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
        onClick={isRunning ? pause : startRest}
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
      {isRunning && (
        <>
          <button
            aria-label={`Subtract ${ADJUST_SECONDS} seconds`}
            className={buttonClassName}
            onClick={() => adjust(-ADJUST_SECONDS)}
            type="button"
          >
            -{ADJUST_SECONDS} s
          </button>
          <button
            aria-label={`Add ${ADJUST_SECONDS} seconds`}
            className={buttonClassName}
            onClick={() => adjust(ADJUST_SECONDS)}
            type="button"
          >
            +{ADJUST_SECONDS} s
          </button>
          <button className={buttonClassName} onClick={reset} type="button">
            Skip rest
          </button>
        </>
      )}
      {!isRunning && secondsLeft !== restSeconds && (
        <button className={buttonClassName} onClick={reset} type="button">
          Reset
        </button>
      )}
    </div>
  );
}
