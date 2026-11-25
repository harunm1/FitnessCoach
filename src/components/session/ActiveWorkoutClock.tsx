"use client";

// The live workout clock (D34): active time only, manual Pause and Resume, and an automatic
// pause after 30 idle minutes that starts at the last activity. The screen turning off or the
// tab being hidden does NOT pause it, because that is when the user is resting.
import { useEffect, useRef, useState } from "react";
import { finishWorkout } from "@/app/session/actions";
import {
  pauseWorkoutClock,
  resumeWorkoutClock,
  type ClockResult,
} from "@/app/session/pauseActions";
import {
  activeSeconds,
  idlePauseAt,
  lastActivityMs,
  type ActiveClock,
} from "@/lib/workout/activeTime";

type ActiveWorkoutClockProps = {
  workoutId: number;
  bankedSeconds: number;
  activeSinceIso: string | null; // null while paused
  lastSetAtIso: string | null; // newest saved set, server clock
  serverNowIso: string; // the server's clock when the page was built
};

const TICK_MS = 1000;
const STORE_EVERY_MS = 5000;
const INTERACTION_EVENTS = ["pointerdown", "keydown", "touchstart", "input"];
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

const interactionKey = (workoutId: number) => `fc.lastInteraction.${workoutId}`;

function readStoredInteraction(workoutId: number): number | null {
  try {
    const stored = window.localStorage.getItem(interactionKey(workoutId));
    const value = stored === null ? NaN : Number(stored);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function storeInteraction(workoutId: number, atMs: number): void {
  try {
    window.localStorage.setItem(interactionKey(workoutId), String(atMs));
  } catch {
    // Storage blocked: the idle rule falls back to the last set.
  }
}

function clockFromProps(props: ActiveWorkoutClockProps): ActiveClock {
  return {
    bankedSeconds: props.bankedSeconds,
    activeSinceMs:
      props.activeSinceIso === null ? null : Date.parse(props.activeSinceIso),
  };
}

function clockFromResult(result: Extract<ClockResult, { status: "ok" }>) {
  return {
    bankedSeconds: result.bankedSeconds,
    activeSinceMs:
      result.activeSinceIso === null ? null : Date.parse(result.activeSinceIso),
  };
}

export default function ActiveWorkoutClock(props: ActiveWorkoutClockProps) {
  const { workoutId, lastSetAtIso, serverNowIso } = props;
  const [clock, setClock] = useState<ActiveClock>(() => clockFromProps(props));
  // null until mounted: the server render has no device clock to show.
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [pausedByIdle, setPausedByIdle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The gap between the server's clock and this device's, so a wrong device clock does not
  // shift the time shown. Read once, in the mount effect.
  const offsetMs = useRef(0);
  const lastInteraction = useRef<number | null>(null);
  const lastStored = useRef(0);
  const pausing = useRef(false);
  const clockRef = useRef(clock);
  // The ref moves with the state, at once, so a tick that runs before React commits does not
  // see the old clock and ask the server for the same pause again.
  const applyClock = (next: ActiveClock) => {
    clockRef.current = next;
    setClock(next);
  };

  const serverNow = () => Date.now() + offsetMs.current;

  // Judges the idle rule at `atMs` and, past the limit, pauses at the last activity.
  const checkIdle = (atMs: number) => {
    const current = clockRef.current;
    if (current.activeSinceMs === null || pausing.current) return;
    const lastActivity = lastActivityMs({
      activeSinceMs: current.activeSinceMs,
      lastSetMs: lastSetAtIso === null ? null : Date.parse(lastSetAtIso),
      lastInteractionMs: lastInteraction.current,
    });
    const pauseAt = idlePauseAt(lastActivity, atMs);
    if (pauseAt === null) return;
    void pauseForIdle(pauseAt);
  };

  // Pauses at the last activity. Guarded so a slow answer is not asked for again every tick.
  const pauseForIdle = async (pauseAt: number) => {
    pausing.current = true;
    try {
      const result = await pauseWorkoutClock(new Date(pauseAt).toISOString());
      if (result.status === "ok") {
        applyClock(clockFromResult(result));
        setPausedByIdle(true);
      } else {
        setError(result.message);
      }
    } catch {
      setError("The pause could not be saved. Try again.");
    } finally {
      pausing.current = false;
    }
  };

  // Mount: learn the server/device offset, restore this device's last tap, first idle check.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      offsetMs.current = Date.parse(serverNowIso) - Date.now();
      lastInteraction.current = readStoredInteraction(workoutId);
      const now = serverNow();
      setNowMs(now);
      checkIdle(now);
    }, 0);
    return () => window.clearTimeout(timeout);
    // Runs once per mount; the page remounts this component when the clock changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Taps, keys and typing are activity. The newest is kept on this device so a reload or a
  // phone that slept is judged by the same rule.
  useEffect(() => {
    const onActivity = () => {
      const now = serverNow();
      lastInteraction.current = now;
      if (now - lastStored.current >= STORE_EVERY_MS) {
        lastStored.current = now;
        storeInteraction(workoutId, now);
      }
    };
    INTERACTION_EVENTS.forEach((name) =>
      document.addEventListener(name, onActivity, { passive: true }),
    );
    return () =>
      INTERACTION_EVENTS.forEach((name) =>
        document.removeEventListener(name, onActivity),
      );
  }, [workoutId]);

  // While running: tick, and look again whenever the page becomes visible (a hidden tab's
  // timers are throttled; the clock is arithmetic on timestamps, so it is still right).
  const running = clock.activeSinceMs !== null;
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const now = serverNow();
      setNowMs(now);
      checkIdle(now);
    };
    const interval = window.setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, lastSetAtIso]);

  async function run(action: () => Promise<ClockResult>, onOk: () => void) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result.status === "ok") {
        applyClock(clockFromResult(result));
        onOk();
      } else {
        setError(result.message);
      }
    } catch {
      setError("That did not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const pause = () =>
    run(
      () => pauseWorkoutClock(new Date(serverNow()).toISOString()),
      () => setPausedByIdle(false),
    );
  const resume = () =>
    run(resumeWorkoutClock, () => {
      lastInteraction.current = serverNow();
      setPausedByIdle(false);
    });

  const seconds = nowMs === null ? null : activeSeconds(clock, nowMs);
  const hours = Math.floor((seconds ?? 0) / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    ((seconds ?? 0) % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
  );
  const remainder = (seconds ?? 0) % SECONDS_PER_MINUTE;
  const text = [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  const buttonClass =
    "min-h-8 border border-foreground/20 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5";

  return (
    <div className="grid gap-2">
      <span className="inline-flex flex-wrap items-baseline gap-2 text-sm">
        <span>
          {running ? "Elapsed workout time" : "Workout time (paused)"}
        </span>
        <time
          aria-label={
            seconds === null
              ? "Loading elapsed time"
              : `${hours} hours ${minutes} minutes ${remainder} seconds`
          }
          className="inline-block w-[8ch] font-mono text-lg font-semibold tabular-nums"
          dateTime={`PT${seconds ?? 0}S`}
          role="timer"
        >
          {seconds === null ? "--:--:--" : text}
        </time>
        <button
          className={buttonClass}
          disabled={busy || seconds === null}
          onClick={running ? pause : resume}
          type="button"
        >
          {running ? "Pause clock" : "Resume clock"}
        </button>
      </span>
      {!running && (
        <div
          className="flex flex-wrap items-center gap-3 text-sm"
          role="status"
        >
          <span>
            {pausedByIdle
              ? "No set or tap for 30 minutes, so the workout was paused at your last activity. Resume or finish?"
              : "The workout is paused. Resume or finish?"}
          </span>
          <form action={finishWorkout}>
            <button className={buttonClass} type="submit">
              Finish workout now
            </button>
          </form>
        </div>
      )}
      {error && (
        <p className="m-0 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
